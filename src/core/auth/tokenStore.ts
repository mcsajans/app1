import * as SecureStore from 'expo-secure-store';

/**
 * Refresh token SecureStore'da saklanır (Android'de Keystore destekli
 * EncryptedSharedPreferences). Access token'ın ömrü 15 dakika olduğu için
 * yalnızca bellekte tutulur, diske hiç yazılmaz — bkz. TEKNIK_DOKUMAN.md §5.7.
 *
 * Anahtar adı yalnızca harf, rakam, nokta, tire ve alt çizgi içerebilir.
 */
const REFRESH_KEY = 'bebiqa.refresh_token';

export async function saveRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_KEY, token, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}

export async function readRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_KEY);
  } catch {
    // Anahtar geçersizleştiyse (ör. cihaz kilidi değişti) oturumu yok sayarız.
    return null;
  }
}

export async function clearRefreshToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  } catch {
    // Zaten yoksa sorun değil.
  }
}
