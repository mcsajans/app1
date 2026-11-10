/**
 * Kayıtlar istemcide UUID ile üretilir; sunucu tarafında sync_uuid idempotent
 * INSERT ... ON DUPLICATE KEY UPDATE için kullanılır.
 * TODO(v1): expo-crypto eklendiğinde Crypto.randomUUID() ile değiştir.
 */
export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
