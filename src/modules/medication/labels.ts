import type {
  DoseUnit, Medication, MedicationForm, MedicationRoute, ScheduleType,
} from '../../core/api/modules';

/**
 * İlaç modülünün etiketleri ve metin biçimleri — tek yerde.
 *
 * Ekran, alt sayfa ve doz sayfası aynı sözlükleri okuyor; üç kopya zamanla
 * ayrışırdı ("Şurup" / "şurup" / "Surup"). Dosya saf: React bilmez, bu yüzden
 * ileride düz Node ile test edilebilir.
 */

export const FORM_LABEL: Record<MedicationForm, string> = {
  syrup: 'Şurup',
  drops: 'Damla',
  tablet: 'Tablet',
  suppository: 'Fitil',
  cream: 'Krem',
  spray: 'Sprey',
  other: 'Diğer',
};

export const ROUTE_LABEL: Record<MedicationRoute, string> = {
  oral: 'Ağızdan',
  rectal: 'Makat',
  topical: 'Cilde',
  nasal: 'Burun',
  other: 'Diğer',
};

export const UNIT_LABEL: Record<DoseUnit, string> = {
  ml: 'ml',
  mg: 'mg',
  damla: 'damla',
  adet: 'adet',
  olcek: 'ölçek',
  doz: 'doz',
};

export const SCHEDULE_LABEL: Record<ScheduleType, string> = {
  as_needed: 'Gerektikçe',
  interval: 'X saatte bir',
  fixed_times: 'Sabit saatler',
};

export const STATUS_LABEL: Record<Medication['status'], string> = {
  active: 'Sürüyor',
  finished: 'Tamamlandı',
  stopped: 'Bırakıldı',
};

/** 4 → "4", 4.5 → "4,5" — ondalık ayırıcı Türkçe. */
export function amountLabel(amount: number | null | undefined, unit: DoseUnit): string | null {
  if (amount === null || amount === undefined) return null;
  const rounded = Math.round(amount * 100) / 100;
  return `${String(rounded).replace('.', ',')} ${UNIT_LABEL[unit]}`;
}

/** "6 saatte bir" / "08:00, 20:00" / "Gerektikçe" */
export function scheduleLabel(m: Medication): string {
  if (m.schedule_type === 'interval' && m.interval_hours) {
    const hours = String(Math.round(m.interval_hours * 10) / 10).replace('.', ',');
    return `${hours} saatte bir`;
  }
  if (m.schedule_type === 'fixed_times' && m.fixed_times?.length) {
    return m.fixed_times.join(', ');
  }
  return SCHEDULE_LABEL.as_needed;
}

/**
 * "19:40'ta" / "35 dk sonra" / "şimdi verilebilir".
 *
 * Geçmişte kalan bir "sonraki doz" gecikmedir ve öyle okunmalı: saati
 * göstermek "19:40'ta verilecek" gibi okunur, oysa saat 21:00 olmuştur.
 */
export function dueLabel(nextDueAt: string | null | undefined, nowMs: number): string | null {
  if (!nextDueAt) return null;
  const ms = Date.parse(nextDueAt);
  if (!Number.isFinite(ms)) return null;

  const diffMin = Math.round((ms - nowMs) / 60_000);
  if (diffMin <= 0) return 'şimdi verilebilir';
  if (diffMin < 60) return `${diffMin} dk sonra`;

  const hours = Math.floor(diffMin / 60);
  const minutes = diffMin % 60;
  if (hours < 24) return minutes === 0 ? `${hours} sa sonra` : `${hours} sa ${minutes} dk sonra`;
  return `${Math.round(hours / 24)} gün sonra`;
}
