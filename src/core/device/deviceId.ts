import * as SecureStore from 'expo-secure-store';

import { uuidv4 } from '../utils/uuid';

/**
 * Kalıcı cihaz kimliği.
 *
 * Cihaz takvimine yazılan etkinliklerin kimlikleri **cihaza özgüdür**: aynı
 * hesabın telefonu ve tableti ayrı etkinlikler oluşturur. Sunucuda hangi
 * kaydın hangi cihaza ait olduğu bu kimlikle ayırt edilir, yoksa telefon
 * tabletin etkinliğini silmeye çalışır ve sessizce başarısız olurdu
 * (`tasks.device_alarm_ids`, bkz. migrations/013).
 *
 * SecureStore seçildi çünkü uygulama verisi temizlenmedikçe kalıcıdır ve
 * oturumdan bağımsızdır — çıkış yapıp tekrar giren kullanıcı aynı cihazda
 * aynı kimliği görmeli, yoksa eski takvim etkinlikleri sahipsiz kalırdı.
 */
const KEY = 'bebiqa.device_uuid';

/** Süreç boyunca tek okuma yeter; SecureStore her çağrıda diske gider. */
let cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;

  try {
    const stored = await SecureStore.getItemAsync(KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
  } catch {
    // Okuma başarısızsa yeni kimlik üretilir; en kötü ihtimalle bu cihazın
    // eski takvim etkinlikleri sahipsiz kalır — alarm kurmayı engellemez.
  }

  const fresh = uuidv4();
  try {
    await SecureStore.setItemAsync(KEY, fresh, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  } catch {
    // Yazılamazsa kimlik yalnızca bu oturum boyunca yaşar.
  }
  cached = fresh;
  return fresh;
}
