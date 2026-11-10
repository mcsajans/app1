import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Chips } from '../../components/records';
import { DateField, TimeField, TimeListField } from '../../components/DateTimeField';
import { Button, Card, EmptyState, FormError, Loading, Screen, SectionTitle } from '../../components/ui';
import { ReadOnlyBanner, useCanEdit } from '../../components/permission';
import { errorText } from '../../core/api/client';
import {
  QUIET_DAYS_ALL, REMINDER_CATEGORIES, REMINDER_DESCRIPTION_MAX, localDate,
  quietHourService, reminderService,
  type QuietHour, type RecurrenceType, type Reminder, type ReminderCategory,
} from '../../core/api/modules';
import { useAsyncData } from '../../core/hooks/useAsyncData';
import { EVENT_OFFSETS, offsetsSummary } from '../../core/notifications/alarmPlan';
import { onReminderClosed, onReminderSaved } from '../../core/notifications/reminderAlarms';
import { useNotificationStore } from '../../core/notifications/useNotificationStore';
import { usePermissionStore } from '../../core/permissions/usePermissionStore';
import { useBabyStore } from '../../core/stores/useBabyStore';
import { type IconName } from '../../components/Icon';
import { colors, radius, spacing, typography } from '../../core/theme';
import { withSaveFeedback } from '../../core/feedback/withSaveFeedback';

const CATEGORY_LABELS: Record<string, string> = {
  feeding: 'Besleme', breastfeeding: 'Emzirme', sleep: 'Uyku',
  diaper: 'Bez', pumping: 'Sağma', medicine: 'İlaç',
  vaccine: 'Aşı', doctor: 'Doktor', event: 'Etkinlik', custom: 'Diğer',
};

/**
 * Kategori simgeleri — `components/Icon.tsx` sözlüğündeki semantik adlar.
 *
 * Şartname etkinlik için emoji öneriyor (🎉 / 🎈); uygulamanın geri kalanı
 * vektör ikon setine geçtiği için `calendar-star` kullanılıyor
 * (`components/Icon.tsx` başındaki gerekçe). Chip'lerde ikon olması on
 * seçenekli listeyi gözle taranabilir kılıyor: etiketler kısa ve birbirine
 * benziyor.
 */
const CATEGORY_ICONS = {
  feeding: 'bottle', breastfeeding: 'breastfeeding', sleep: 'sleep',
  diaper: 'diaper', pumping: 'pumping', medicine: 'taskMedicine',
  vaccine: 'vaccines', doctor: 'doctor', event: 'event', custom: 'note',
} as const satisfies Record<ReminderCategory, IconName>;

/** Tekrar kipi etiketleri. `weekly` formda sunulmuyor — gerekçe aşağıda. */
const RECURRENCE_LABELS = {
  daily: 'Her gün',
  custom_days: 'Belirli günler',
  none: 'Tek seferlik',
} as const;

/**
 * Formda sunulan tekrar kipleri.
 *
 * `weekly` **bilinçli olarak yok**: "her hafta Salı" ile "belirli günler =
 * [Salı]" aynı şey ve iki ayrı seçenek sunmak kullanıcıyı farkı aramaya
 * iterdi. Sunucu `weekly` değerini kabul etmeye devam ediyor (başka bir
 * istemci gönderebilir) ve liste satırında doğru etiketleniyor.
 */
const RECURRENCE_CHOICES = ['daily', 'custom_days', 'none'] as const;

/** ISO gün numarası (1 = Pazartesi … 7 = Pazar) → kısa ad. */
const WEEKDAYS = [
  { day: 1, label: 'Pzt' }, { day: 2, label: 'Sal' }, { day: 3, label: 'Çar' },
  { day: 4, label: 'Per' }, { day: 5, label: 'Cum' }, { day: 6, label: 'Cmt' },
  { day: 7, label: 'Paz' },
] as const;
const MODE_LABELS = { interval: 'Her X dakikada', fixed_times: 'Belirli saatlerde' } as const;

/**
 * Ön uyarı seçenekleri. Görevlerdekinden kısa: her seçenek her sabit saat için
 * ayrı bir günlük tetikleyici demek ve planlayıcı zaten ilk üçle sınırlıyor
 * (scheduler.ts, reminderOffsets).
 */
const REMINDER_OFFSETS = [30, 15, 5, 0];

/**
 * Etkinlikte "Ne zaman uyarılsın" seçenekleri — **gün** bazlı.
 *
 * Etkinlik haftalar öncesinden planlanıyor; "30 dk önce" burada işe yaramıyor.
 * Değerler dakika cinsinden saklanır (14 gün = 20160 dk), çünkü alan tüm
 * modüllerde ortak (`notification_offsets`).
 */
const EVENT_OFFSET_LABELS: Record<number, string> = {
  20160: '14 gün önce',
  10080: '7 gün önce',
  2880: '2 gün önce',
  1440: '1 gün önce',
  0: 'Aynı gün',
};
const ANCHOR_LABELS = { last_record: 'Son kayıttan sonra', last_fired: 'Son alarmdan sonra' } as const;
const QUIET_BEHAVIOR_LABELS = {
  postpone: 'Sessiz saat sonuna ertele',
  silent: 'Sessizce göster',
  skip: 'Hiç gösterme',
} as const;

const TR_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

/** 'YYYY-AA-GG' → "4 Haziran 2027". Bozuk girdi olduğu gibi döner. */
function prettyDay(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  return `${Number(m[3])} ${TR_MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/**
 * 'YYYY-AA-GG' → ISO gün numarası (1 = Pazartesi … 7 = Pazar).
 *
 * `quietHours.ts`'teki `isoDay` ile aynı düzen; orası bir `Date` alıyor,
 * burada elimizde dizge var. İki ayrı çevrim gibi görünse de kural tek:
 * `getDay()`in 0 = Pazar düzeni 7'ye taşınır.
 */
function isoDayOf(value: string): number {
  const d = new Date(`${value}T12:00:00`);
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Bit 0 = Pazartesi — `days_mask` ile aynı sıra (bkz. scheduler.dayBit). */
const DAY_SHORT = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'] as const;

function describeDays(mask: number): string {
  if (mask === QUIET_DAYS_ALL) return 'Her gün';
  const names = DAY_SHORT.filter((_, i) => (mask & (1 << i)) !== 0);
  return names.length ? names.join(', ') : 'Hiçbir gün';
}

/**
 * Modül 8 — Hatırlatıcılar.
 *
 * Tanım sunucuda, **alarm cihazda**. Ekran üç şeyi bir arada tutar: hatırlatıcı
 * tanımları, sessiz saat pencereleri ve işletim sistemine kaç bildirimin
 * yazıldığı. Son kısım olmadan "neden çalmadı?" sorusu kör bir soruydu;
 * planlama raporu izin durumunu ve sessiz saat nedeniyle atlanan tekrarları
 * açıkça gösterir.
 */
export default function RemindersScreen() {
  const baby = useBabyStore((s) => s.selected());
  const babyId = baby?.id ?? null;

  const permission = useNotificationStore((s) => s.permission);
  const report = useNotificationStore((s) => s.report);
  const syncing = useNotificationStore((s) => s.syncing);
  const syncError = useNotificationStore((s) => s.error);
  const checkPermission = useNotificationStore((s) => s.check);
  const requestPermission = useNotificationStore((s) => s.request);
  const syncNotifications = useNotificationStore((s) => s.sync);
  /*
   * Kesin alarm izni (Android 12+). Bildirim izninden ayrı: bildirim izni
   * uyarının **görünmesini**, bu izin **dakikasında çalmasını** sağlıyor.
   * İkisini tek satırda birleştirmek, "izin verdim ama hatırlatıcım geç
   * çalıyor" durumunu açıklanamaz bırakırdı.
   */
  const exactAlarm = usePermissionStore((s) => s.statuses.exactAlarm);
  const refreshPermissions = usePermissionStore((s) => s.refresh);
  const askPermission = usePermissionStore((s) => s.ask);

  const canEdit = useCanEdit();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  /** Etkinlik açıklaması; diğer kategorilerde form bu alanı göstermiyor. */
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ReminderCategory>('custom');
  const [mode, setMode] = useState<'interval' | 'fixed_times'>('interval');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('daily');
  const [days, setDays] = useState<number[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  /**
   * Ön uyarılar — yalnızca "belirli saatlerde" modunda anlamlı, çünkü
   * aralıklı tekrarın sabit bir hedef anı yok (scheduler.ts, reminderOffsets).
   */
  const [offsets, setOffsets] = useState<number[]>([0]);
  const [minutes, setMinutes] = useState('180');
  const [anchor, setAnchor] = useState<'last_record' | 'last_fired'>('last_record');
  const [times, setTimes] = useState<string[]>(['09:00', '21:00']);
  const [respectQuiet, setRespectQuiet] = useState(true);
  const [quietBehavior, setQuietBehavior] = useState<'postpone' | 'silent' | 'skip'>('postpone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Düzenlenen hatırlatıcı; null ise form "yeni hatırlatıcı" kipindedir. */
  const [editing, setEditing] = useState<Reminder | null>(null);

  /**
   * Etkinlik kipi.
   *
   * Etkinlik takvimdeki tek bir ana bağlı: bir adı, bir tarihi, bir saati ve
   * gün bazlı ön uyarıları var. Periyodik hatırlatıcının alanları (aralık,
   * haftanın günleri, bitiş tarihi) burada anlamsız olduğu için gizlenir —
   * form, kullanıcının dolduramayacağı kutuları göstermemeli.
   */
  const isEvent = category === 'event';

  const [quietOpen, setQuietOpen] = useState(false);
  const [qStart, setQStart] = useState('22:00');
  const [qEnd, setQEnd] = useState('07:00');
  const [qLabel, setQLabel] = useState('');
  const [qMask, setQMask] = useState(QUIET_DAYS_ALL);

  const list = useAsyncData(
    () => (babyId ? reminderService.list(babyId) : Promise.resolve({ reminders: [] })),
    [babyId],
  );
  const quiet = useAsyncData(
    () => (babyId ? quietHourService.list(babyId) : Promise.resolve({ quiet_hours: [] })),
    [babyId],
  );
  const reminders = list.data?.reminders ?? [];
  const windows = quiet.data?.quiet_hours ?? [];

  // Ekran açıldığında izin durumu okunur — kullanıcı arada sistem
  // ayarlarından izni kapatmış olabilir ve ekran bunu göstermeliydi.
  useEffect(() => {
    void checkPermission();
    // Kesin alarm izni ayar ekranından verilip geri dönülmüş olabilir.
    void refreshPermissions();
  }, [checkPermission, refreshPermissions]);

  /** Sunucu tarafı değiştikten sonra listeyi ve cihaz planını birlikte tazeler. */
  const reloadAndReschedule = () => {
    list.reload();
    quiet.reload();
    void syncNotifications(babyId);
  };

  const save = async () => {
    if (!babyId) return;
    if (!title.trim()) return setError('Başlık zorunlu.');

    if (mode === 'interval') {
      const m = Number(minutes);
      if (!Number.isInteger(m) || m < 5 || m > 1440) {
        return setError('Tekrar süresi 5–1440 dakika arası tam sayı olmalı.');
      }
    } else {
      if (times.length === 0) return setError('En az bir saat seç.');
    }

    /*
     * Tekrar kuralları sunucuda da denetleniyor; burada erken söylemek bir ağ
     * turunu önlüyor ve kullanıcı hangi alanın eksik olduğunu formu terk
     * etmeden görüyor.
     */
    if (recurrence === 'custom_days' && days.length === 0) {
      return setError('Hangi günlerde çalacağını seç.');
    }
    if (recurrence === 'none' && !startDate) {
      return setError(
        isEvent ? 'Etkinlik tarihi zorunlu.' : 'Tek seferlik hatırlatıcıda tarih zorunlu.',
      );
    }
    if (isEvent && offsets.length === 0) {
      return setError('En az bir uyarı zamanı seç.');
    }
    if (startDate && endDate && endDate < startDate) {
      return setError('Bitiş tarihi başlangıçtan önce olamaz.');
    }

    setBusy(true);
    setError(null);
    try {
      const target = editing;
      const body: Record<string, unknown> = {
        title: title.trim(),
        /*
         * Açıklama yalnızca etkinlikte GÖNDERİLİR. Diğer kategorilerde alan
         * hiç çizilmiyor; yine de göndermek, sunucunun tanımadığı bir anahtarı
         * her hatırlatıcı isteğine eklemek olurdu.
         *
         * Düzenlemede kural tersine çevriliyor: alan açıkça `null` gider.
         * Yoksa kullanıcı açıklamayı silse ya da kategoriyi etkinlikten
         * çıkarsa sunucudaki eski metin olduğu yerde kalırdı — kısmi
         * güncellemede "gönderilmedi" demek "dokunma" demek.
         */
        ...(isEvent
          ? { description: description.trim() || null }
          : target
            ? { description: null }
            : {}),
        category,
        schedule_mode: mode,
        // Karşı modun alanı gönderilmez; sunucu uyumsuz veriyi reddediyor.
        interval_minutes: mode === 'interval' ? Number(minutes) : null,
        anchor,
        fixed_times: mode === 'fixed_times' ? times : null,
        /*
         * Aralık modunda tekrar biçiminin karşılığı yok ("son kayıttan 3 saat
         * sonra" kuralı günlere değil son kayda bağlı) ve sunucu ikisini
         * birlikte reddediyor; o yüzden hep 'daily' gider.
         */
        recurrence_type: mode === 'fixed_times' ? recurrence : 'daily',
        repeat_days: mode === 'fixed_times' && recurrence === 'custom_days' ? days : null,
        start_date: mode === 'fixed_times' ? startDate : null,
        end_date: mode === 'fixed_times' ? endDate : null,
        respect_quiet_hours: respectQuiet,
        quiet_behavior: quietBehavior,
        notification_offsets: mode === 'fixed_times' && offsets.length ? offsets : null,
      };

      const { reminder } = await withSaveFeedback(() => (target
        ? reminderService.update(target.id, body)
        : reminderService.create(babyId, body)));
      /*
       * Takvim kaydı kaydın başarısını etkilemez: izin yoksa ya da aralıklı
       * moddaysa sessizce atlanır (reminderAlarms.ts). Düzenlemede
       * `onReminderSaved` eski bildirimleri iptal edip yenilerini kurar ve
       * takvim etkinliğini **günceller** — ikinci bir etkinlik açılmaz.
       */
      await onReminderSaved(reminder);
      setEditing(null);
      setTitle('');
      setDescription('');
      // Tekrar ayarları yerinde kalır: arka arkaya benzer hatırlatıcı kurmak
      // olağan ("Pzt/Çar/Cum D vitamini", sonra aynı günlere demir şurubu").
      setOpen(false);
      reloadAndReschedule();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Hatırlatıcıyı forma yükler.
   *
   * **Tüm** alanlar doldurulur. Yalnızca başlığı taşıyıp gerisini formun
   * varsayılanında bırakmak, kullanıcı sadece saati değiştirse bile haftalık
   * bir hatırlatıcıyı sessizce günlüğe çevirirdi (§22.0'daki tuzağın
   * arayüzdeki karşılığı).
   */
  const startEdit = (r: Reminder) => {
    setEditing(r);
    setTitle(r.title);
    setDescription(r.description ?? '');
    setCategory(r.category);
    setMode(r.schedule_mode);
    setRecurrence(r.recurrence_type);
    setDays(r.repeat_days ?? []);
    setStartDate(r.start_date);
    setEndDate(r.end_date);
    setOffsets(r.notification_offsets ?? []);
    setMinutes(String(r.interval_minutes ?? 180));
    setAnchor(r.anchor);
    setTimes(r.fixed_times ?? ['09:00']);
    setRespectQuiet(r.respect_quiet_hours);
    setQuietBehavior(r.quiet_behavior);
    setError(null);
    setOpen(true);
  };

  /** Formu kapatır; düzenleme kipinden de çıkar. */
  const closeForm = () => {
    setOpen(false);
    setEditing(null);
    setError(null);
  };

  const toggle = (r: Reminder) => {
    void reminderService
      .toggle(r.id)
      // Kapatılan hatırlatıcının takvim kaydı da kalkar; açılınca geri kurulur.
      .then(({ reminder }) => onReminderSaved(reminder))
      .then(reloadAndReschedule)
      .catch((e) => setError(errorText(e)));
  };

  const onDelete = (r: Reminder) => {
    Alert.alert('Hatırlatıcıyı sil', `"${r.title}" silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          // Önce takvim kaydı silinir: silinmiş hatırlatıcıyı güncellemeye
          // çalışmak 404 verirdi (persist: false).
          void onReminderClosed(r, false)
            .then(() => reminderService.remove(r.id))
            .then(reloadAndReschedule)
            .catch((e) => setError(errorText(e)));
        },
      },
    ]);
  };

  const saveQuiet = async () => {
    if (!babyId) return;
    if (!TIME_RE.test(qStart) || !TIME_RE.test(qEnd)) {
      return setError('Sessiz saat SS:DD biçiminde olmalı.');
    }
    if (qStart === qEnd) return setError('Başlangıç ve bitiş saati aynı olamaz.');
    if (qMask === 0) return setError('En az bir gün seç.');

    setBusy(true);
    setError(null);
    try {
      await withSaveFeedback(() => quietHourService.create(babyId, {
        label: qLabel.trim() || null,
        start_time: qStart,
        end_time: qEnd,
        days_mask: qMask,
      }));
      setQLabel('');
      setQuietOpen(false);
      reloadAndReschedule();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteQuiet = (w: QuietHour) => {
    Alert.alert('Sessiz saati sil', `${w.start_time}–${w.end_time} silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void quietHourService.remove(w.id).then(reloadAndReschedule).catch((e) => setError(errorText(e)));
        },
      },
    ]);
  };

  /** "Pzt, Çar, Cum" / "Her gün" / "4 Haziran 2027" — tekrar özeti. */
  const repeatLabel = (r: Reminder): string => {
    switch (r.recurrence_type) {
      case 'none':
        return r.start_date ? prettyDay(r.start_date) : 'Tek seferlik';
      case 'custom_days': {
        const picked = (r.repeat_days ?? [])
          .map((d) => WEEKDAYS.find((w) => w.day === d)?.label)
          .filter(Boolean);
        return picked.length ? picked.join(', ') : 'Gün seçilmedi';
      }
      case 'weekly':
        return r.start_date
          ? `Her ${WEEKDAYS.find((w) => w.day === isoDayOf(r.start_date!))?.label ?? 'hafta'}`
          : 'Haftalık';
      default:
        return 'Her gün';
    }
  };

  const describe = (r: Reminder): string => {
    if (r.schedule_mode === 'fixed_times') {
      const times = (r.fixed_times ?? []).join(' · ');
      /*
       * Ek YOK: "31 Aralık 2026'e kadar" yanlış, doğrusu "2026'ya". Ek,
       * yılın OKUNUŞUNDAKİ son ünlüye bağlı (2026 "altı" → ya, 2027 "yedi"
       * → ye) ve bunu doğru üretmek sayıyı yazıya çevirmeyi gerektiriyor.
       * "son" öneki her tarihle çalışıyor ve aynı bilgiyi veriyor.
       */
      const until = r.end_date ? ` · son ${prettyDay(r.end_date)}` : '';
      return `${repeatLabel(r)} · ${times}${until}`;
    }
    const h = Math.floor((r.interval_minutes ?? 0) / 60);
    const m = (r.interval_minutes ?? 0) % 60;
    const every = h > 0 ? `${h} sa${m ? ` ${m} dk` : ''}` : `${m} dk`;
    return `Her ${every} · ${ANCHOR_LABELS[r.anchor]}`;
  };

  if (!baby) {
    return (
      <Screen>
        <EmptyState icon="reminders" title="Önce bir bebek profili ekle" detail="Hatırlatıcılar seçili bebeğe bağlı tutulur." />
      </Screen>
    );
  }

  /*
   * Form tek yerde tanımlanır, iki yerde çizilir: yeni hatırlatıcı listenin
   * ALTINDA, düzenleme listenin ÜSTÜNDE açılır. Düzenleme de altta açılsaydı
   * çok hatırlatıcısı olan kullanıcıda ekranın dışında kalır ve "Düzenle"
   * hiçbir şey yapmamış gibi görünürdü.
   */
  const form = (
    <Card>
      <Text style={s.label}>{isEvent ? 'Etkinlik adı *' : 'Başlık *'}</Text>
      <TextInput
        style={s.input}
        value={title}
        onChangeText={setTitle}
        placeholder={isEvent ? 'Doktor kontrolü' : 'Vitamin D'}
        placeholderTextColor={colors.textFaint}
        editable={!busy}
      />

      {isEvent ? (
        <>
          <View style={s.labelRow}>
            <Text style={s.label}>Açıklama</Text>
            {/*
              Sayaç her zaman görünür, yalnızca sınıra yaklaşınca değil:
              kullanıcı uzun bir metni yazdıktan SONRA kesildiğini fark
              ederse yazdığının bir kısmını kaybetmiş olur.
            */}
            <Text style={[s.counter, description.length >= REMINDER_DESCRIPTION_MAX && s.counterFull]}>
              {description.length}/{REMINDER_DESCRIPTION_MAX}
            </Text>
          </View>
          <TextInput
            style={[s.input, s.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Yanına defter ve aşı kartını al."
            placeholderTextColor={colors.textFaint}
            editable={!busy}
            multiline
            numberOfLines={3}
            /*
             * Kesme işini `maxLength` yapıyor, elle `slice` değil: imleç
             * metnin ortasındayken yazılan karakter de doğru yerde
             * engelleniyor ve girdi kutusu kendi geçmişini kaybetmiyor.
             */
            maxLength={REMINDER_DESCRIPTION_MAX}
            textAlignVertical="top"
          />
        </>
      ) : null}

      <Text style={s.label}>Kategori</Text>
      <Chips
        options={REMINDER_CATEGORIES}
        value={category}
        onChange={(v) => {
          if (!v) return;
          setCategory(v);
          /*
           * Etkinlik seçilince form tek seferlik bir ana kurulur: belirli
           * saat kipi, tekrar yok, bugünün tarihi ve tek saat. Kullanıcı
           * dört ayrı kutuyu elle doğru duruma getirmek zorunda kalmasın.
           * Ön uyarılar da gün bazlı varsayılanla dolar.
           */
          if (v === 'event') {
            setMode('fixed_times');
            setRecurrence('none');
            setEndDate(null);
            if (!startDate) setStartDate(localDate());
            setTimes((prev) => [prev[0] ?? '09:00']);
            setOffsets(EVENT_OFFSETS);
          }
        }}
        labels={CATEGORY_LABELS}
        icons={CATEGORY_ICONS}
        disabled={busy || !canEdit}
      />

      {isEvent ? null : (
        <>
          <Text style={s.label}>Zamanlama</Text>
          <Chips options={['interval', 'fixed_times'] as const} value={mode} onChange={(v) => v && setMode(v)} labels={MODE_LABELS} disabled={busy || !canEdit} />
        </>
      )}

      {mode === 'interval' ? (
        <>
          <Text style={s.label}>Kaç dakikada bir (5–1440)</Text>
          <TextInput
            style={s.input}
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="number-pad"
            placeholderTextColor={colors.textFaint}
            editable={!busy}
          />
          <Text style={s.label}>Sayaç neye göre</Text>
          <Chips options={['last_record', 'last_fired'] as const} value={anchor} onChange={(v) => v && setAnchor(v)} labels={ANCHOR_LABELS} disabled={busy || !canEdit} />
        </>
      ) : (
        <>
          {isEvent ? (
            /*
             * Etkinlikte tek saat var. `TimeListField` birden çok saat
             * ekletiyor ve her saat kendi ön uyarı kümesini doğururdu;
             * "14 gün önce" o durumda hangi saate göre hesaplanacağı
             * belirsiz bir uyarıya dönüşürdü.
             */
            <TimeField
              label="Saat *"
              value={times[0] ?? null}
              onChange={(v) => setTimes([v])}
              disabled={busy || !canEdit}
            />
          ) : (
            <TimeListField
              label="Saatler"
              values={times}
              onChange={setTimes}
              disabled={busy || !canEdit}
            />
          )}

          {/* Etkinlikte tekrar yok: biçim her zaman "tek seferlik". */}
          {isEvent ? null : <Text style={s.label}>Ne sıklıkla</Text>}
          {isEvent ? null : (
          <Chips
            options={RECURRENCE_CHOICES}
            value={recurrence}
            onChange={(v) => {
              if (!v) return;
              setRecurrence(v);
              // Tek seferlikte tarih zorunlu; boşsa bugünle doldurulur ki
              // kullanıcı "tarih gerekli" hatasıyla karşılaşmasın.
              if (v === 'none' && !startDate) setStartDate(localDate());
            }}
            labels={RECURRENCE_LABELS}
            disabled={busy || !canEdit}
          />
          )}

          {recurrence === 'custom_days' ? (
            <>
              <View style={s.days}>
                {WEEKDAYS.map((w) => {
                  const on = days.includes(w.day);
                  return (
                    <Pressable
                      key={w.day}
                      onPress={() => setDays((prev) => (
                        prev.includes(w.day)
                          ? prev.filter((d) => d !== w.day)
                          : [...prev, w.day].sort((a, b) => a - b)
                      ))}
                      disabled={busy || !canEdit}
                      style={[s.dayChip, on && s.dayChipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[s.dayText, on && s.dayTextOn]}>{w.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {days.length === 0 ? (
                <Text style={s.warn}>En az bir gün seçmelisin.</Text>
              ) : null}
            </>
          ) : null}

          <View style={s.dateRow}>
            <View style={s.dateCol}>
              <DateField
                label={isEvent ? 'Etkinlik tarihi *' : recurrence === 'none' ? 'Tarih *' : 'Başlangıç'}
                value={startDate}
                onChange={setStartDate}
                onClear={recurrence === 'none' ? undefined : () => setStartDate(null)}
                disabled={busy || !canEdit}
              />
            </View>
            {recurrence === 'none' ? null : (
              <View style={s.dateCol}>
                <DateField
                  label="Bitiş"
                  value={endDate}
                  onChange={setEndDate}
                  onClear={() => setEndDate(null)}
                  disabled={busy || !canEdit}
                />
              </View>
            )}
          </View>
          <Text style={s.hint}>
            {recurrence === 'none'
              ? 'Yalnızca bu tarihte çalar.'
              : 'Tarihler boş bırakılırsa bugünden itibaren süresiz çalar.'}
          </Text>
          <Text style={s.label}>{isEvent ? 'Ne zaman uyarılsın' : 'Ön uyarı'}</Text>
          <View style={s.chipRow}>
            {(isEvent ? EVENT_OFFSETS : REMINDER_OFFSETS).map((o) => {
              const on = offsets.includes(o);
              return (
                <Pressable
                  key={o}
                  onPress={() => setOffsets((prev) => (
                    prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
                  ))}
                  disabled={busy || !canEdit}
                  style={[s.offsetChip, on && s.offsetChipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[s.offsetText, on && s.offsetTextOn]}>
                    {isEvent
                      ? EVENT_OFFSET_LABELS[o] ?? `${o} dk önce`
                      : o === 0 ? 'Tam saatinde' : `${o} dk önce`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.offsetHint}>{offsetsSummary(offsets)}</Text>
          {isEvent ? (
            <Text style={s.offsetHint}>
              Etkinlik uyarıları alarm sesiyle ve ekranın üstünde belirerek gelir;
              sessiz saatlere takılmaz.
            </Text>
          ) : null}
        </>
      )}

      {/*
        Etkinlikte sessiz saat anahtarı gösterilmez: uyarıların amacı
        kaçırılmamak ve planlayıcı da onlara sessiz saat uygulamıyor
        (scheduler.ts). Anahtarı göstermek, karşılığı olmayan bir söz
        vermek olurdu.
      */}
      {isEvent ? null : (
      <View style={s.switchRow}>
        <Text style={[s.label, s.switchText]}>Sessiz saatlere uy</Text>
        <Switch
          value={respectQuiet}
          onValueChange={setRespectQuiet}
          disabled={busy || !canEdit}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.surface}
        />
      </View>
      )}

      {respectQuiet && !isEvent ? (
        <>
          <Text style={s.label}>Sessiz saate denk gelirse</Text>
          <Chips
            options={['postpone', 'silent', 'skip'] as const}
            value={quietBehavior}
            onChange={(v) => v && setQuietBehavior(v)}
            labels={QUIET_BEHAVIOR_LABELS}
            disabled={busy || !canEdit}
          />
        </>
      ) : null}

      <View style={s.gap} />
      <Button
        label={busy ? 'Kaydediliyor…' : editing ? 'Değişiklikleri kaydet' : 'Kaydet'}
        onPress={save}
        disabled={busy || !canEdit}
      />
      <Button label="Vazgeç" variant="ghost" onPress={closeForm} disabled={busy || !canEdit} />
    </Card>
  );

  return (
    <Screen>
      <ReadOnlyBanner />
      {error ? <FormError message={error} /> : null}
      {syncError ? <FormError message={`Bildirimler planlanamadı: ${syncError}`} /> : null}

      {/* ── İzin durumu ── */}
      {permission !== 'granted' ? (
        <View style={s.warnCard}>
          <Text style={s.warnTitle}>
            {permission === 'denied' ? 'Bildirim izni kapalı' : 'Bildirim izni gerekli'}
          </Text>
          <Text style={s.warnBody}>
            {permission === 'denied'
              ? 'İzin kalıcı olarak reddedilmiş. Telefon ayarlarından Bebiqa için bildirimleri aç.'
              : 'Hatırlatıcılar ancak izin verildikten sonra cihazda çalar.'}
          </Text>
          {permission === 'undetermined' ? (
            <>
              <View style={s.gapXs} />
              <Button label="İzin ver" onPress={() => void requestPermission(babyId)} />
            </>
          ) : null}
        </View>
      ) : null}

      {/*
        ── Kesin alarm izni ──
        Bildirim izni verilmişken ayrıca gösterilir: iki uyarı üst üste
        yığılmasın, önce asıl eksik (bildirim) çözülsün.
      */}
      {permission === 'granted' && exactAlarm !== 'granted' ? (
        <View style={s.warnCard}>
          <Text style={s.warnTitle}>Hatırlatıcılar dakikasında çalmayabilir</Text>
          <Text style={s.warnBody}>
            {exactAlarm === 'denied'
              ? 'Telefon ayarlarında Bebiqa için "Alarmlar ve hatırlatıcılar" kapalı. Açılmazsa uyarılar birkaç dakika gecikerek gelir.'
              : 'Android, kesin saatli alarm için ayrı bir izin istiyor. Verilmezse uyarılar gelir ama birkaç dakika gecikebilir.'}
          </Text>
          <View style={s.gapXs} />
          <Button
            label="Alarm iznini aç"
            variant="ghost"
            onPress={() => void askPermission('exactAlarm')}
          />
        </View>
      ) : null}

      {/* ── Planlama durumu ── */}
      {permission === 'granted' ? (
        <Card>
          <View style={s.statusHead}>
            <Text style={s.label}>Cihazda planlı bildirim</Text>
            <Text style={s.statusCount}>{syncing ? '…' : (report?.scheduled ?? 0)}</Text>
          </View>
          {report ? (
            <Text style={s.hint}>
              {[
                report.repeating > 0 ? `${report.repeating} hatırlatıcı süresiz tekrar ediyor` : null,
                /*
                 * Görev ve aşı uyarıları da aynı bütçeden harcıyor; sayıları
                 * ayrı yazılmazsa "cihazda 14 bildirim var ama listede 2
                 * hatırlatıcı görüyorum" gibi açıklanamaz bir fark kalıyordu.
                 */
                report.taskAlarms > 0 ? `${report.taskAlarms} görev uyarısı` : null,
                report.vaccineAlarms > 0 ? `${report.vaccineAlarms} aşı uyarısı` : null,
                report.postponed > 0 ? `${report.postponed} alarm sessiz saat sonuna ertelendi` : null,
                report.silenced > 0 ? `${report.silenced} alarm sessize alındı` : null,
                report.skipped > 0 ? `${report.skipped} alarm sessiz saate denk geldiği için atlandı` : null,
                report.trimmed > 0 ? `${report.trimmed} alarm sınır nedeniyle planlanmadı` : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Tüm alarmlar planlandı.'}
            </Text>
          ) : null}
          <View style={s.gapXs} />
          <Button
            label={syncing ? 'Planlanıyor…' : 'Yeniden planla'}
            variant="ghost"
            // Yalnızca planlamayı tazelemek yetmiyor: tanımlar başka bir
            // cihazdan ya da diğer ebeveyn tarafından değişmiş olabilir ve
            // durum kartı 2 hatırlatıcı sayarken liste "henüz yok" diyordu.
            onPress={reloadAndReschedule}
            disabled={syncing}
          />
        </Card>
      ) : null}

      {editing ? form : null}

      <SectionTitle
        hint={canEdit
          ? 'Alarm cihazda çalar; sunucuda push altyapısı yok. Anahtar durdurur, Düzenle değiştirir.'
          : 'Alarm cihazda çalar; sunucuda push altyapısı yok.'}
      >
        Hatırlatıcılar
      </SectionTitle>

      <Card>
        {list.loading && reminders.length === 0 ? (
          <Loading label="Yükleniyor…" />
        ) : reminders.length === 0 ? (
          <Text style={s.hint}>Henüz hatırlatıcı yok.</Text>
        ) : (
          reminders.map((r) => (
            <View key={r.id} style={s.rowWrap}>
            <View style={s.row}>
              <View style={s.rowBody}>
                <Text style={[s.rowTitle, !r.is_active && s.dim]} numberOfLines={1}>
                  {CATEGORY_LABELS[r.category] ?? 'Diğer'} · {r.title}
                </Text>
                <Text style={s.rowDetail}>
                  {describe(r)}
                  {r.respect_quiet_hours && windows.length > 0
                    ? ` · sessiz saatte: ${QUIET_BEHAVIOR_LABELS[r.quiet_behavior].toLowerCase()}`
                    : ''}
                </Text>
                {/*
                  Açıklama iki satırda kesilir: 250 karakter listedeki diğer
                  satırları aşağı iter ve liste taranabilir olmaktan çıkardı.
                  Tamamı bildirimde ve takvim kaydında zaten duruyor.
                */}
                {r.description ? (
                  <Text style={s.rowNote} numberOfLines={2}>
                    {r.description}
                  </Text>
                ) : null}
              </View>
              <Switch
                value={r.is_active}
                onValueChange={() => toggle(r)}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.surface}
              />
            </View>
            {/*
              Düzenle/Sil **görünür düğmeler**. Önceden silme yalnızca uzun
              basmayla yapılabiliyordu ve bunu hiçbir yerde yazmıyorduk;
              düzenleme ise hiç yoktu — hatırlatıcının saatini değiştirmek
              için silip yeniden kurmak gerekiyordu.
            */}
            {canEdit ? (
              <View style={s.rowActions}>
                <Pressable
                  onPress={() => startEdit(r)}
                  disabled={busy}
                  style={s.linkBtn}
                  accessibilityRole="button"
                >
                  <Text style={s.linkText}>Düzenle</Text>
                </Pressable>
                <Pressable
                  onPress={() => onDelete(r)}
                  disabled={busy}
                  style={s.linkBtn}
                  accessibilityRole="button"
                >
                  <Text style={[s.linkText, s.linkDanger]}>Sil</Text>
                </Pressable>
              </View>
            ) : null}
            </View>
          ))
        )}
      </Card>

      {editing ? null : open ? form : (
        <Button label="+ Yeni hatırlatıcı" variant="ghost" onPress={() => setOpen(true)} />
      )}

      {/* ── Sessiz saatler ── */}
      <SectionTitle hint="Bu aralıklarda alarmlar ertelenir, sessize alınır veya atlanır.">
        Sessiz saatler
      </SectionTitle>

      <Card>
        {quiet.loading && windows.length === 0 ? (
          <Loading label="Yükleniyor…" />
        ) : windows.length === 0 ? (
          <Text style={s.hint}>Sessiz saat tanımlı değil — alarmlar her saatte çalar.</Text>
        ) : (
          windows.map((w) => (
            <Pressable key={w.id} onLongPress={() => deleteQuiet(w)} style={s.row}>
              <View style={s.rowBody}>
                <Text style={[s.rowTitle, !w.is_enabled && s.dim]}>
                  {w.start_time}–{w.end_time}
                  {w.label ? ` · ${w.label}` : ''}
                </Text>
                <Text style={s.rowDetail}>
                  {describeDays(w.days_mask)}
                  {/* Gece yarısını aşan aralık kullanıcıya açıkça söylenir. */}
                  {w.end_time < w.start_time ? ' · ertesi sabaha kadar' : ''}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </Card>

      {quietOpen ? (
        <Card>
          <Text style={s.label}>Etiket</Text>
          <TextInput
            style={s.input}
            value={qLabel}
            onChangeText={setQLabel}
            placeholder="Gece uykusu"
            placeholderTextColor={colors.textFaint}
            editable={!busy}
          />

          <View style={s.timeRow}>
            <View style={s.timeCol}>
              <TimeField label="Başlangıç" value={qStart} onChange={setQStart} disabled={busy || !canEdit} />
            </View>
            <View style={s.timeCol}>
              <TimeField label="Bitiş" value={qEnd} onChange={setQEnd} disabled={busy || !canEdit} />
            </View>
          </View>

          <Text style={s.label}>Günler</Text>
          <View style={s.days}>
            {DAY_SHORT.map((d, i) => {
              const bit = 1 << i;
              const on = (qMask & bit) !== 0;
              return (
                <Pressable
                  key={d}
                  disabled={busy || !canEdit}
                  onPress={() => setQMask((m) => m ^ bit)}
                  style={[s.dayChip, on && s.dayChipOn]}
                >
                  <Text style={[s.dayText, on && s.dayTextOn]}>{d}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={s.gap} />
          <Button label={busy ? 'Kaydediliyor…' : 'Sessiz saati kaydet'} onPress={saveQuiet} disabled={busy || !canEdit} />
          <Button label="Vazgeç" variant="ghost" onPress={() => setQuietOpen(false)} disabled={busy || !canEdit} />
        </Card>
      ) : (
        <Button label="+ Sessiz saat ekle" variant="ghost" onPress={() => setQuietOpen(true)} />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  // ── ön uyarı seçimi ──
  // `dayChip` / `dayChipOn` / `dayText` / `dayTextOn` aşağıda zaten tanımlı:
  // sessiz saat gün maskesi de aynı satırı kullanıyor. İkinci bir kopya
  // çıkarmak, iki gün seçicisinin zamanla farklı görünmesi demekti.
  warn: { ...typography.tiny, color: colors.danger, marginTop: spacing.xs },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  dateCol: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  offsetChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  offsetChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  offsetText: { ...typography.small, color: colors.textSoft },
  offsetTextOn: { color: '#FFFFFF', fontWeight: '700' },
  offsetHint: { ...typography.small, color: colors.textSoft, marginTop: spacing.xs },

  label: { ...typography.small, color: colors.textSoft, fontWeight: '600', marginTop: spacing.sm },
  hint: { ...typography.small, color: colors.textSoft },
  gap: { height: spacing.sm },
  gapXs: { height: spacing.xs },
  /** Satır + eylem düğmeleri; ayırıcı çizgi `row`un üst kenarlığında. */
  rowWrap: {},
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  linkBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  linkText: { ...typography.small, color: colors.primary, fontWeight: '700' },
  linkDanger: { color: colors.danger },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowBody: { flex: 1 },
  rowTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  rowDetail: { ...typography.tiny, color: colors.textSoft, marginTop: 1 },
  /** Açıklama satırı: zamanlama satırından daha soluk, ondan sonra okunsun. */
  rowNote: { ...typography.tiny, color: colors.textFaint, marginTop: 2 },
  dim: { color: colors.textFaint },
  input: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  /*
   * Çok satırlı açıklama. `height` yerine `minHeight`: `input` sabit 50 px
   * veriyor ve üç satırlık metin o kutuya sığmıyordu; kullanıcı yazdıkça
   * kutu büyüsün.
   */
  multiline: { height: undefined, minHeight: 92, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  counter: { ...typography.tiny, color: colors.textFaint },
  /** Sınıra ulaşıldığında sayaç uyarı rengine döner. */
  counterFull: { color: colors.warning, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchText: { flex: 1 },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statusCount: { ...typography.h2, color: colors.primary, marginLeft: 'auto' },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
  timeCol: { flex: 1 },
  days: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dayChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { ...typography.tiny, color: colors.textSoft, fontWeight: '600' },
  dayTextOn: { color: colors.surface },
  warnCard: {
    backgroundColor: '#FFF6E6',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  warnTitle: { ...typography.small, color: colors.warning, fontWeight: '700' },
  warnBody: { ...typography.small, color: colors.textSoft, marginTop: 2 },
});
