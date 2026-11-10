import type { Task, TaskDetails, TaskType } from '../../core/api/modules';

/**
 * Görev sunum yardımcıları — React'e bağımlı değil, bu yüzden ayrı dosyada:
 * tarif satırının kuruluşu modülün en kolay yanlış yapılan kısmı ve düz Node
 * altında doğrulanabilir olması işe yarıyor.
 */

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  formula_prep: 'Mama hazırla',
  breast_milk_feed: 'Sağılmış süt ver',
  medicine: 'İlaç içir',
  care: 'Bakım',
  vaccine: 'Aşı',
  custom: 'Diğer',
};

/**
 * Görev türünün ikonu — `components/Icon.tsx` sözlüğündeki semantik ad.
 *
 * Bu dosya React'siz kalmalı (düz Node ile test ediliyor), o yüzden burada
 * yalnızca **ad** durur; çizimi ekran yapar.
 */
export const TASK_TYPE_ICONS = {
  formula_prep: 'taskFormula',
  breast_milk_feed: 'taskBreastMilk',
  medicine: 'taskMedicine',
  care: 'taskCare',
  vaccine: 'taskVaccine',
  custom: 'taskCustom',
} as const satisfies Record<TaskType, string>;

export const TASK_STATUS_LABELS = {
  pending: 'Bekliyor',
  in_progress: 'Başlandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal edildi',
} as const;

/** Ondalığı gereksizse kırpar: 150.00 → "150", 7.50 → "7,5". */
export function num(value: number | undefined): string | null {
  if (value === undefined || value === null || !Number.isFinite(value)) return null;
  return String(Number(value.toFixed(2))).replace('.', ',');
}

/**
 * Hazırlama adımlarını tek satırda, bakıcının okuyup uygulayabileceği sırada
 * kurar: *"150 ml • 5 ölçek • 90 ml sıcak + 60 ml soğuk su"*.
 *
 * Eksik alanlar atlanır — kısmi tarif de işe yarar bilgi taşır; eksik alan
 * yerine "0" yazmak bakıcıyı yanıltırdı.
 */
export function recipeLine(type: TaskType, d: TaskDetails | null): string | null {
  if (!d) return null;

  const parts: string[] = [];
  const amount = num(d.formula_amount_ml);
  const scoops = num(d.formula_scoops);
  const hot = num(d.hot_water_ml);
  const cold = num(d.cold_water_ml);

  if (amount) parts.push(`${amount} ml`);
  if (type === 'formula_prep' && scoops) parts.push(`${scoops} ölçek mama`);

  if (hot && cold) parts.push(`${hot} ml sıcak + ${cold} ml soğuk su`);
  else if (hot) parts.push(`${hot} ml sıcak su`);
  else if (cold) parts.push(`${cold} ml soğuk su`);

  if (type === 'breast_milk_feed' && d.pumping_stash_id) {
    parts.push(`sağılmış süt #${d.pumping_stash_id}`);
  }
  if (d.dose) parts.push(d.dose);

  return parts.length ? parts.join(' • ') : null;
}

/** Görev zamanı geçti mi? Tamamlanan/iptal edilen görevler gecikmiş sayılmaz. */
export function isOverdue(task: Task, now = Date.now()): boolean {
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  const due = Date.parse(task.due_time);
  return Number.isFinite(due) && due < now;
}

/**
 * Tamamlandığında beslenme kaydına dönüşebilen görevler. Yalnızca miktar
 * bilgisi taşıyanlar: miktarsız bir "süt ver" görevi kayda dönüşemez.
 */
export function canBecomeRecord(task: Task): boolean {
  if (task.task_type !== 'formula_prep' && task.task_type !== 'breast_milk_feed') return false;
  return Number(task.instruction_details?.formula_amount_ml ?? 0) > 0;
}
