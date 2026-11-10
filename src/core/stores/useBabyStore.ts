import { create } from 'zustand';

import { api, apiRequest } from '../api/client';
import { endpoints } from '../api/endpoints';
import { getDb } from '../db';
import { uuidv4 } from '../utils/uuid';
import type { Baby, BloodType, Gender, Permission } from '../types';

type Row = {
  id: number;
  server_id: number | null;
  sync_uuid: string;
  first_name: string;
  last_name: string | null;
  gender: string;
  birth_date: string;
  birth_time: string | null;
  birth_weight_g: number | null;
  birth_height_cm: number | null;
  head_circumference_cm: number | null;
  is_premature: number;
  gestational_age_weeks: number | null;
  blood_type: string | null;
  note: string | null;
  photo_path: string | null;
  photo_url: string | null;
  is_selected: number;
  is_owner: number;
  my_permission: string | null;
  owner_name: string | null;
  member_count: number | null;
  sort_order: number;
};

/** GET /babies yanıtındaki tek bebek (TEKNIK_DOKUMAN.md §14.0). */
type ServerBaby = {
  id: number;
  sync_uuid: string;
  first_name: string;
  last_name: string | null;
  gender: string;
  birth_date: string;
  birth_time: string | null;
  birth_weight_g: number | null;
  birth_height_cm: number | null;
  head_circumference_cm: number | null;
  is_premature: boolean;
  gestational_age_weeks: number | null;
  blood_type: string | null;
  note: string | null;
  photo_path: string | null;
  photo_url: string | null;
  owner_id: number;
  owner_name: string | null;
  member_count: number;
  my_permission: string;
  is_owner: boolean;
  is_selected: boolean;
};

const toBaby = (r: Row): Baby => ({
  id: r.server_id ?? r.id,
  syncUuid: r.sync_uuid,
  firstName: r.first_name,
  lastName: r.last_name,
  gender: r.gender as Gender,
  birthDate: r.birth_date,
  birthTime: r.birth_time,
  birthWeightG: r.birth_weight_g,
  birthHeightCm: r.birth_height_cm,
  headCircumferenceCm: r.head_circumference_cm,
  isPremature: r.is_premature === 1,
  gestationalAgeWeeks: r.gestational_age_weeks,
  bloodType: (r.blood_type as BloodType | null) ?? null,
  note: r.note,
  photoPath: r.photo_path,
  photoUrl: r.photo_url,
  isSelected: r.is_selected === 1,
  isOwner: r.is_owner === 1,
  // Eski kayıtlarda sütun yoktu; göç varsayılanı 'owner' ve burada da
  // aynı yedek kullanılır ki tanımsız bir yetki ortaya çıkmasın.
  myPermission: (r.my_permission as Permission | null) ?? 'owner',
  ownerName: r.owner_name ?? null,
  memberCount: r.member_count ?? 1,
  sortOrder: r.sort_order,
});

/** Form alanları — hem oluşturma hem güncelleme için. */
export type BabyInput = {
  firstName: string;
  lastName?: string | null;
  gender: Gender;
  birthDate: string;
  birthTime?: string | null;
  birthWeightG?: number | null;
  birthHeightCm?: number | null;
  headCircumferenceCm?: number | null;
  isPremature: boolean;
  gestationalAgeWeeks?: number | null;
  bloodType?: BloodType | null;
  note?: string | null;
};

const trimmed = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

/** Form girdisini sunucunun beklediği gövdeye çevirir. */
function toPayload(input: BabyInput): Record<string, unknown> {
  return {
    first_name: input.firstName.trim(),
    last_name: trimmed(input.lastName),
    gender: input.gender,
    birth_date: input.birthDate,
    birth_time: trimmed(input.birthTime),
    birth_weight_g: input.birthWeightG ?? null,
    birth_height_cm: input.birthHeightCm ?? null,
    head_circumference_cm: input.headCircumferenceCm ?? null,
    is_premature: input.isPremature,
    // Prematüre değilken bu alanı DOLU göndermek sunucuda 422 üretir;
    // tutarlılık istemcide de korunur.
    gestational_age_weeks: input.isPremature ? (input.gestationalAgeWeeks ?? null) : null,
    blood_type: input.bloodType ?? null,
    note: trimmed(input.note),
  };
}

export type PhotoFile = { uri: string; name: string; type: string };

/**
 * Kayıt alanlarını ve fotoğrafı TEK multipart gövdede toplar.
 *
 * Önceden fotoğraf ayrı bir istekle yükleniyordu ve bu, oluşturmada iki tura
 * zorluyordu: önce kayıt (kimliği öğren), sonra fotoğraf. Ağ zayıfken ikinci
 * istek düşerse kayıt fotoğrafsız kalıyor ve kullanıcı bunu ancak listeye
 * bakınca fark ediyordu. Sunucu artık her iki uçta da multipart kabul ediyor
 * (TEKNIK_DOKUMAN §22.14).
 *
 * Alanlar dizgeye çevrilir — multipart başka bir şey taşıyamaz — ve
 * `null`/boş olanlar hiç eklenmez: sunucudaki çevrim katmanı boş alanı
 * "gönderilmedi" sayıyor, `"null"` metnini de. İkisinden birini göndermek
 * aynı kapıya çıkıyor ama atlamak gövdeyi küçük tutuyor.
 */
function toFormData(input: BabyInput, photo: PhotoFile, syncUuid?: string): FormData {
  const form = new FormData();
  if (syncUuid) form.append('sync_uuid', syncUuid);

  for (const [key, value] of Object.entries(toPayload(input))) {
    if (value === null || value === undefined || value === '') continue;
    form.append(key, typeof value === 'boolean' ? String(value) : String(value));
  }
  form.append('photo', photo as unknown as Blob);
  return form;
}

type BabyStore = {
  babies: Baby[];
  selectedId: number | null;
  hydrated: boolean;

  /** Yerel aynadan okur (ağ beklemeden). */
  hydrate: () => Promise<void>;
  /** GET /babies ile sunucudan çekip aynayı tazeler. */
  sync: () => Promise<void>;
  /** Oluşturulan bebeğin sunucu id'si döner — fotoğraf ancak kayıt var olunca yüklenebilir. */
  /** Fotoğraf verilirse kayıtla AYNI multipart istekte gider. */
  addBaby: (input: BabyInput, photo?: PhotoFile | null) => Promise<number>;
  updateBaby: (id: number, input: BabyInput, photo?: PhotoFile | null) => Promise<void>;
  /** Yalnızca fotoğrafı değiştirmek için; kayıt alanlarına dokunmaz. */
  uploadPhoto: (id: number, file: PhotoFile) => Promise<void>;
  selectBaby: (id: number) => Promise<void>;
  removeBaby: (id: number) => Promise<void>;
  selected: () => Baby | null;
};

/**
 * Bebekler giriş yapan kullanıcının hesabına aittir: kaynak sunucudur,
 * yerel SQLite yalnızca çevrimdışı aynadır (TEKNIK_DOKUMAN.md §2.1, §5.7).
 */
export const useBabyStore = create<BabyStore>((set, get) => ({
  babies: [],
  selectedId: null,
  hydrated: false,

  hydrate: async () => {
    const db = await getDb();
    const rows = await db.getAllAsync<Row>(
      'SELECT * FROM babies WHERE deleted_at IS NULL ORDER BY sort_order, id',
    );
    const babies = rows.map(toBaby);
    const selected = babies.find((b) => b.isSelected) ?? babies[0] ?? null;
    set({ babies, selectedId: selected?.id ?? null, hydrated: true });
  },

  sync: async () => {
    const data = await api.get<{ babies: ServerBaby[] }>(endpoints.babies.list);
    const db = await getDb();
    const now = new Date().toISOString();

    await db.withExclusiveTransactionAsync(async (txn) => {
      // Sunucu tek doğruluk kaynağı: ayna tamamen yeniden kurulur, böylece
      // sunucuda silinen ya da yetkisi alınan bebek cihazda kalmaz.
      await txn.runAsync('DELETE FROM babies');
      for (let i = 0; i < data.babies.length; i += 1) {
        const b = data.babies[i];
        await txn.runAsync(
          `INSERT INTO babies (server_id, sync_uuid, first_name, last_name, gender,
                               birth_date, birth_time, birth_weight_g, birth_height_cm,
                               head_circumference_cm, is_premature, gestational_age_weeks,
                               blood_type, note, photo_path, photo_url,
                               is_selected, is_owner, my_permission,
                               owner_name, member_count, sort_order,
                               owner_user_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            b.id, b.sync_uuid, b.first_name, b.last_name, b.gender,
            b.birth_date, b.birth_time, b.birth_weight_g, b.birth_height_cm,
            b.head_circumference_cm, b.is_premature ? 1 : 0, b.gestational_age_weeks,
            b.blood_type, b.note, b.photo_path, b.photo_url,
            b.is_selected ? 1 : 0, b.is_owner ? 1 : 0, b.my_permission ?? 'owner',
            b.owner_name ?? null, b.member_count ?? 1, i,
            b.owner_id, now, now,
          ],
        );
      }
    });

    await get().hydrate();
  },

  addBaby: async (input, photo) => {
    const syncUuid = uuidv4();
    // multipart gövdede sınır (boundary) değerini fetch'in kendisi üretmeli,
    // bu yüzden Content-Type başlığı elle SET EDİLMEZ.
    const data = photo
      ? await apiRequest<{ baby: { id: number } }>(endpoints.babies.create, {
          method: 'POST',
          body: toFormData(input, photo, syncUuid),
        })
      : await api.post<{ baby: { id: number } }>(endpoints.babies.create, {
          sync_uuid: syncUuid,
          ...toPayload(input),
        });
    await get().sync();
    return data.baby.id;
  },

  updateBaby: async (id, input, photo) => {
    if (photo) {
      await apiRequest(endpoints.babies.detail(id), {
        method: 'PUT',
        body: toFormData(input, photo),
      });
    } else {
      await api.put(endpoints.babies.detail(id), toPayload(input));
    }
    await get().sync();
  },

  uploadPhoto: async (id, file) => {
    // multipart gövde: sınır (boundary) değerini fetch'in kendisi üretmeli,
    // bu yüzden Content-Type başlığı elle SET EDİLMEZ.
    const form = new FormData();
    form.append('photo', file as unknown as Blob);

    await apiRequest(endpoints.babies.photo(id), { method: 'POST', body: form });
    await get().sync();
  },

  selectBaby: async (id) => {
    // Seçim sunucuda da tutulur (baby_members.is_selected), diğer cihazlar da görsün.
    await api.post(endpoints.babies.select(id));
    const db = await getDb();
    await db.runAsync('UPDATE babies SET is_selected = 0');
    await db.runAsync('UPDATE babies SET is_selected = 1 WHERE server_id = ?', [id]);
    set({
      selectedId: id,
      babies: get().babies.map((b) => ({ ...b, isSelected: b.id === id })),
    });
  },

  removeBaby: async (id) => {
    await api.delete(endpoints.babies.detail(id));
    await get().sync();
  },

  selected: () => {
    const { babies, selectedId } = get();
    return babies.find((b) => b.id === selectedId) ?? null;
  },
}));
