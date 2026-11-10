import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '../components/Icon';
import { colors, moduleTint, radius, shadow, spacing, typography } from '../core/theme';
import {
  bottleService, breastfeedingService, localDate, sleepService, taskService, timelineService,
  type Task, type TimelineEntry,
} from '../core/api/modules';
import { MODULE_BY_KEY, isModuleActive, topLevelModules } from '../core/modules/catalog';
import type { ModuleKey } from '../core/modules/types';
import { useModuleStore } from '../core/modules/useModuleStore';
import { useAsyncData } from '../core/hooks/useAsyncData';
import { useBabyStore } from '../core/stores/useBabyStore';
import { humanDuration, clockOf, formatDuration } from '../components/records';
import { ModuleTile, StatusCard, TimelineCard, subtypeLabel } from '../components/home';
import { TASK_TYPE_ICONS, recipeLine, isOverdue } from '../modules/tasks/taskFormat';
import { Card, EmptyState, Screen } from '../components/ui';
import { MODULE_SCREENS } from '../core/navigation/moduleScreens';
import { openModule } from '../core/navigation/navigationRef';

/**
 * Gösterge üst sınırları — oran çubukları bir referans olmadan çizilemez.
 * Bunlar **hedef değil ölçek**: 0–6 ay bir bebekte günlük uyku ~14 saat,
 * uyanıklık penceresi ~2 saatte uzun sayılır. Sağlık tavsiyesi değildir,
 * yalnızca çubuğun dolum oranını anlamlı kılar.
 */
const SLEEP_SCALE_SEC = 14 * 3600;
const BOTTLE_SCALE_ML = 800;
const AWAKE_SCALE_SEC = 3 * 3600;
const AWAKE_SEGMENTS = 10;

const TRACK_OF: Record<string, string> = {
  feeding: colors.trackFeeding,
  sleep: colors.trackSleep,
  diaper: colors.trackDiaper,
  music: colors.trackOther,
  notification: colors.trackOther,
};

const TINT_OF: Record<string, string> = {
  feeding: moduleTint.bottle,
  sleep: moduleTint.sleep,
  diaper: moduleTint.diaper,
  music: moduleTint.music,
  notification: moduleTint.reminders,
};

const ICON_OF: Record<string, IconName> = {
  feeding: 'bottle', sleep: 'night', diaper: 'diaper',
  music: 'music', notification: 'reminders',
};

const LABEL_OF: Record<string, string> = {
  feeding: 'Beslenme', sleep: 'Uyku', diaper: 'Bez Değişimi',
  music: 'Müzik', notification: 'Bildirim',
};

export default function HomeScreen() {
  const states = useModuleStore((s) => s.states);
  const babies = useBabyStore((s) => s.babies);
  const selectedId = useBabyStore((s) => s.selectedId);

  const selected = babies.find((b) => b.id === selectedId) ?? null;
  const babyId = selected?.id ?? null;
  const today = localDate();

  /**
   * Izgara: açık, ekranı bulunan ve **kendi başına açılabilen** modüller.
   *
   * Alt modüller (emzirme, biberon, ek gıda, sağma) burada yok; onlar
   * Beslenme kutusunun içinde sekme olarak duruyor.
   */
  const tiles = useMemo(
    () => topLevelModules(states).filter((m) => MODULE_SCREENS[m.key]),
    [states],
  );

  /*
   * Durum kartlarının görünürlüğü ızgaradan DEĞİL, modülün kendi aktifliğinden
   * okunur. Izgaraya bakılsaydı emzirme ve biberon kartları, o modüller
   * Beslenme'nin altına taşındığı anda sessizce kaybolurdu — oysa modüller
   * hâlâ açık.
   */
  const isOn = (key: ModuleKey) => isModuleActive(key, states);

  /*
   * Dört uç paralel çekilir; hepsi küçük ve birbirinden bağımsız.
   * Uyku özeti ayrıca `awake_window_sec` verdiği için rapor özetinin yerine
   * geçmez — ikisi farklı soruları yanıtlıyor.
   */
  const data = useAsyncData(
    () =>
      babyId
        ? Promise.all([
            sleepService.summary(babyId, today),
            bottleService.summary(babyId, today),
            breastfeedingService.last(babyId),
            timelineService.feed(babyId, { date: today, limit: 4 }),
            // Bugünün açık görevleri — "Bugünün Görevleri" bölümünü besler.
            taskService.list(babyId, { status: ['pending', 'in_progress'], date: today }),
          ])
        : Promise.resolve(null),
    [babyId, today],
  );

  const [sleep, bottle, breast, feed, taskPage] = data.data ?? [null, null, null, null, null];
  const tasks = taskPage?.tasks ?? [];
  const entries = feed?.entries ?? [];

  /*
   * Modül anahtarı artık doğrudan bir rota adı DEĞİL: alt modüller (emzirme,
   * biberon) Beslenme ekranının sekmeleri ve ağaçta kendi rotaları yok.
   * `openModule` üst modülü ve sekmeyi çözüyor; doğrudan `navigate(key)`
   * çağrılsaydı durum kartlarına dokunmak sessizce hiçbir şey yapmazdı.
   */
  const open = (key: ModuleKey) => openModule(key, MODULE_BY_KEY[key]?.parent);

  if (!selected) {
    return (
      <Screen>
        <Card>
          <EmptyState
            icon="babies"
            title="Önce bir bebek profili ekle"
            detail="Üstteki bebek alanına dokunarak başlayabilirsin. Tüm kayıtlar seçili bebeğe bağlı tutulur."
          />
        </Card>

        <Text style={s.section}>Hızlı İşlemler</Text>
        <View style={s.grid}>
          {tiles.map((m) => (
            <ModuleTile
              key={m.key}
              tint={m.color}
              icon={m.key}
              label={m.title}
              onPress={() => open(m.key)}
            />
          ))}
        </View>
      </Screen>
    );
  }

  const awakeSec = sleep?.awake_window_sec ?? null;

  return (
    <Screen>
      {/* ── Anlık Durum ── */}
      <Text style={s.section}>Anlık Durum</Text>

      {data.error ? <Text style={s.error}>Durum alınamadı — {data.error}</Text> : null}

      <View style={s.statusGrid}>
        {isOn('breastfeeding') ? (
          <StatusCard
            tint={moduleTint.breastfeeding}
            icon="breastfeeding"
            title="Emzirme"
            subtitle={
              breast?.last
                ? `${clockOf(breast.last.start_time)} · ${formatDuration(breast.last.active_duration_sec)} aktif`
                : 'Bugün kayıt yok'
            }
            right={breast?.next_side ? (breast.next_side === 'left' ? 'sıra: sol' : 'sıra: sağ') : undefined}
            // Sol/sağ dağılımı ÖLÇÜLEN süreye göre; aktif süre düzeltilse bile
            // memeler arasındaki oran değişmez.
            progress={shareOf(breast?.last?.left_duration_seconds, breast?.last?.measured_active_sec)}
            progressColor={colors.trackFeeding}
            onPress={() => open('breastfeeding')}
          />
        ) : null}

        {isOn('sleep') ? (
          <StatusCard
            tint={moduleTint.sleep}
            icon="sleep"
            title="Uyku"
            subtitle={humanDuration(sleep?.total_sleep_sec)}
            progress={(sleep?.total_sleep_sec ?? 0) / SLEEP_SCALE_SEC}
            progressColor={colors.trackSleep}
            onPress={() => open('sleep')}
          />
        ) : null}

        {isOn('bottle') ? (
          <StatusCard
            tint={moduleTint.bottle}
            icon="bottle"
            title="Biberon"
            subtitle={`${bottle?.bottle_total_ml ?? 0} ml · ${bottle?.bottle_count ?? 0} öğün`}
            right={
              bottle?.since_last_bottle_sec != null
                ? humanDuration(bottle.since_last_bottle_sec)
                : undefined
            }
            progress={(bottle?.bottle_total_ml ?? 0) / BOTTLE_SCALE_ML}
            progressColor={colors.warning}
            onPress={() => open('bottle')}
          />
        ) : null}

        {isOn('sleep') ? (
          <StatusCard
            tint={moduleTint.reminders}
            icon="clock"
            title="Uyanıklık Süresi"
            // Süre ve son uyanma saati tek satıra sığmıyordu; saat sağ sütuna
            // alındı, alt başlıkta yalnızca süre kaldı.
            subtitle={awakeSec === null ? 'Henüz uyku kaydı yok' : humanDuration(awakeSec)}
            right={sleep?.last_wake_at ? clockOf(sleep.last_wake_at) : undefined}
            segments={{
              filled: Math.round(
                Math.min(1, (awakeSec ?? 0) / AWAKE_SCALE_SEC) * AWAKE_SEGMENTS,
              ),
              total: AWAKE_SEGMENTS,
              color: colors.warning,
            }}
            onPress={() => open('sleep')}
          />
        ) : null}
      </View>

      {/* ── Bugünün Görevleri ── */}
      {isOn('tasks') && tasks.length > 0 ? (
        <>
          <Text style={s.section}>Bugünün Görevleri</Text>
          <View style={s.feed}>
            {tasks.slice(0, 3).map((t) => (
              <TaskRow key={t.id} task={t} onPress={() => open('tasks')} />
            ))}
            {tasks.length > 3 ? (
              <Pressable onPress={() => open('tasks')} accessibilityRole="button">
                <Text style={s.more}>+{tasks.length - 3} görev daha</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}

      {/* ── Hızlı İşlemler ── */}
      <Text style={s.section}>Hızlı İşlemler</Text>
      <View style={s.grid}>
        {tiles.map((m) => (
          <ModuleTile
            key={m.key}
            tint={m.color}
            icon={m.key}
            label={m.title}
            onPress={() => open(m.key)}
          />
        ))}
        {tiles.length === 0 ? (
          <Text style={s.hint}>Tüm modüller pasif. Sistem yöneticisiyle iletişime geç.</Text>
        ) : null}
      </View>

      {/* ── Günlük Akış ── */}
      <Text style={s.section}>Günlük Akış</Text>
      {entries.length === 0 ? (
        <Card>
          <Text style={s.hint}>Bugün için henüz kayıt yok.</Text>
        </Card>
      ) : (
        <View style={s.feed}>
          {entries.map((e) => (
            <TimelineCard
              key={`${e.kind}-${e.ref_id}`}
              track={TRACK_OF[e.kind] ?? colors.trackOther}
              tint={TINT_OF[e.kind] ?? colors.surfaceSoft}
              icon={ICON_OF[e.kind] ?? '•'}
              title={LABEL_OF[e.kind] ?? e.kind}
              subtitle={subtypeLabel(e.subtype)}
              right={rightLines(e)}
              onPress={() => open('timeline')}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

/**
 * Ana ekrandaki görev satırı. Tarif varsa ikinci satırda belirgin gösterilir —
 * bakıcı uygulamayı açtığında ihtiyacı olan tek bilgi o.
 */
function TaskRow({ task, onPress }: { task: Task; onPress: () => void }) {
  const recipe = recipeLine(task.task_type, task.instruction_details);
  const late = isOverdue(task);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.taskCard, pressed && s.taskPressed]}
      accessibilityRole="button"
      accessibilityLabel={task.title}
    >
      <View style={[s.taskIcon, { backgroundColor: moduleTint.tasks }]}>
        <Icon name={TASK_TYPE_ICONS[task.task_type]} size={22} color={colors.text} />
      </View>
      <View style={s.taskBody}>
        <Text style={s.taskTitle} numberOfLines={1}>
          {task.title}
        </Text>
        {recipe ? (
          <Text style={s.taskRecipe} numberOfLines={2}>
            {recipe}
          </Text>
        ) : null}
      </View>
      <Text style={[s.taskTime, late && s.taskLate]}>
        {late ? 'gecikti' : clockOf(task.due_time)}
      </Text>
    </Pressable>
  );
}

/** Sol memenin toplam içindeki payı; seans yoksa çubuk hiç çizilmez. */
function shareOf(part: number | undefined, total: number | undefined): number | undefined {
  if (!total) return undefined;
  return (part ?? 0) / total;
}

/** Akış kartının sağındaki iki satırlık özet. */
function rightLines(e: TimelineEntry): string[] {
  const lines = [clockOf(e.started_at)];
  // Emzirmede bebeğin gerçek beslenme süresi öne çıkar.
  if (e.duration_sec) {
    const isBreast = e.subtype === 'breast';
    lines.push(isBreast ? `${formatDuration(e.duration_sec)} aktif` : formatDuration(e.duration_sec));
  } else if (e.amount_ml) {
    lines.push(`${e.amount_ml} ml`);
  }
  return lines;
}

const s = StyleSheet.create({
  section: { ...typography.h2, color: colors.text, marginTop: spacing.sm },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, rowGap: spacing.lg },
  feed: { gap: spacing.sm },
  more: { ...typography.small, color: colors.primary, fontWeight: '700', textAlign: 'center' },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  taskPressed: { opacity: 0.7 },
  taskIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskBody: { flex: 1 },
  taskTitle: { ...typography.h3, color: colors.text },
  taskRecipe: { ...typography.tiny, color: colors.textSoft, marginTop: 1, fontWeight: '600' },
  taskTime: { ...typography.small, color: colors.textSoft, fontWeight: '700' },
  taskLate: { color: colors.danger },
  hint: { ...typography.small, color: colors.textSoft },
  error: { ...typography.small, color: colors.danger },
});
