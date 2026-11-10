import * as SQLite from 'expo-sqlite';

import { DB_NAME } from '../config';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  return dbPromise;
}

/** Şema sürümü `PRAGMA user_version` içinde tutulur. */
const SCHEMA_VERSION = 7;

/**
 * Yerel offline ayna. Sunucu şemasının alt kümesi — giriş sonrası API'den
 * çekilen kayıtlar buraya yansıtılır, ekranlar buradan okur
 * (bkz. TEKNIK_DOKUMAN.md §2.1 ve §5.7).
 */
export async function migrate(): Promise<void> {
  const db = await getDb();
  await db.execAsync('PRAGMA journal_mode = WAL;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  // v1 — ilk şema. Mevcut kurulumlarda tablolar zaten var, IF NOT EXISTS ile geçilir.
  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS babies (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        sync_uuid   TEXT NOT NULL UNIQUE,
        first_name  TEXT NOT NULL,
        last_name   TEXT,
        gender      TEXT NOT NULL DEFAULT 'belirtilmedi',
        birth_date  TEXT NOT NULL,
        photo_path  TEXT,
        is_selected INTEGER NOT NULL DEFAULT 0,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        deleted_at  TEXT
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        entity     TEXT NOT NULL,
        sync_uuid  TEXT NOT NULL,
        operation  TEXT NOT NULL,
        payload    TEXT NOT NULL,
        tries      INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);
    version = 1;
  }

  // v2 — hesap bağlama + modül aktifliğinin sistem geneline taşınması.
  if (version < 2) {
    // Modül durumu artık cihazda tutulmaz; yalnızca sunucudan gelenin önbelleği var.
    await db.execAsync('DROP TABLE IF EXISTS module_states;');

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS module_catalog (
        module_key  TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        description TEXT,
        is_core     INTEGER NOT NULL DEFAULT 0,
        is_enabled  INTEGER NOT NULL DEFAULT 1,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        fetched_at  TEXT NOT NULL
      );
    `);

    // Yerel ayna artık hangi hesaba ve hangi sunucu kaydına ait olduğunu bilir.
    await addColumnIfMissing(db, 'babies', 'server_id', 'INTEGER');
    await addColumnIfMissing(db, 'babies', 'owner_user_id', 'INTEGER');
    await db.execAsync(
      'CREATE UNIQUE INDEX IF NOT EXISTS ux_babies_server ON babies(server_id) WHERE server_id IS NOT NULL;',
    );

    version = 2;
  }

  // v3 — yönetim panelinden yüklenen logoların önbelleği.
  if (version < 3) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS branding_cache (
        slot       TEXT PRIMARY KEY,
        url        TEXT,
        fetched_at TEXT NOT NULL
      );
    `);
    version = 3;
  }

  // v4 — Modül 1 profil alanları (TEKNIK_DOKUMAN.md §14.0).
  if (version < 4) {
    for (const [column, type] of [
      ['birth_time', 'TEXT'],
      ['birth_weight_g', 'INTEGER'],
      ['birth_height_cm', 'REAL'],
      ['head_circumference_cm', 'REAL'],
      ['is_premature', 'INTEGER NOT NULL DEFAULT 0'],
      ['gestational_age_weeks', 'INTEGER'],
      ['blood_type', 'TEXT'],
      ['note', 'TEXT'],
      ['photo_url', 'TEXT'],
      ['is_owner', 'INTEGER NOT NULL DEFAULT 0'],
    ] as const) {
      await addColumnIfMissing(db, 'babies', column, type);
    }
    version = 4;
  }

  /*
   * v5 — paylaşılan bebeklerde yetki ve sahip bilgisi.
   *
   * `is_owner` tek başına yetmiyordu: davet koduyla katılan kullanıcı
   * "sahip değil" olarak işaretleniyor ama **editor mü viewer mı** olduğu
   * cihazda hiç tutulmuyordu. Liste ekranı bu yüzden salt okuyan bir üyeye de
   * "Düzenle" düğmesi gösterirdi; düğme sunucuda reddedilirdi ama kullanıcıya
   * yapabileceği bir şey vaat edilmiş olurdu.
   */
  if (version < 5) {
    for (const [column, type] of [
      ['my_permission', "TEXT NOT NULL DEFAULT 'owner'"],
      ['owner_name', 'TEXT'],
      ['member_count', 'INTEGER NOT NULL DEFAULT 1'],
    ] as const) {
      await addColumnIfMissing(db, 'babies', column, type);
    }
    version = 5;
  }

  /*
   * v6 — yerel kronometre durumu (canlı sayaç bildirimi).
   *
   * Emzirme ve uyku sayaçları **sunucuda** yaşıyor (§10.1, §22.3); orada
   * saklanacak bir şey yok. Sağma kronometresinin ise sunucu karşılığı yok:
   * kayıt ancak miktar girilince oluşuyor. Uygulama sayaç sürerken
   * öldürülürse geçen süre kaybolurdu ve bildirimdeki düğmeler hiçbir şeye
   * bağlı olmayan bir sayacı durdurmaya çalışırdı. Tablo bu yüzden tür
   * başına tek satır tutar.
   */
  if (version < 6) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS local_timer (
        kind               TEXT PRIMARY KEY,
        baby_id            INTEGER,
        baby_name          TEXT,
        started_at         TEXT NOT NULL,
        segment_started_at TEXT,
        base_sec           INTEGER NOT NULL DEFAULT 0,
        status             TEXT NOT NULL DEFAULT 'running',
        detail             TEXT
      );
    `);
    version = 6;
  }

  /*
   * v7 — sistem geneli uzak yapılandırma önbelleği (şu an: reklam ayarları).
   *
   * Sütun yerine tek bir JSON hücresi tutulur. Gerekçe: bu yapılandırma
   * sunucuda büyüyen bir küme (Reklam.md §1'deki her yeni madde bir alan
   * demek) ve istemci onu **bütün olarak** okuyup olduğu gibi kullanıyor.
   * Her alanı sütuna açmak, sunucuya eklenen her alan için bir SQLite
   * migration'ı gerektirirdi; oysa önbellek yalnızca "ağ yoksa son bilinen
   * değeri göster" işini yapıyor.
   *
   * `branding_cache` gibi HESABA DEĞİL SİSTEME ait: çıkışta silinmiyor
   * (bkz. clearLocalMirror).
   */
  if (version < 7) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS remote_config_cache (
        key        TEXT PRIMARY KEY,
        payload    TEXT NOT NULL,
        fetched_at TEXT NOT NULL
      );
    `);
    version = 7;
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

/** SQLite'ta "ADD COLUMN IF NOT EXISTS" yok; sütun listesi okunup karar verilir. */
async function addColumnIfMissing(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  type: string,
): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (cols.some((c) => c.name === column)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
}

/**
 * Çıkışta çağrılır: önceki hesabın yerel aynası silinir, böylece aynı cihazda
 * başka bir hesap açıldığında eski kullanıcının bebekleri görünmez (§5.7).
 */
export async function clearLocalMirror(): Promise<void> {
  const db = await getDb();
  // branding_cache ve remote_config_cache KASITLI olarak korunur: logolar ve
  // reklam ayarları hesaba değil SİSTEME aittir, giriş ekranında da geçerli (§7.5).
  // `local_timer` silinir: çalışan sağma kronometresi o kullanıcıya aitti,
  // yeni hesap onu devralmamalı.
  await db.execAsync(
    'DELETE FROM babies; DELETE FROM sync_queue; DELETE FROM module_catalog; DELETE FROM local_timer;',
  );
}
