/**
 * client.ts ile useAuthStore arasındaki tek yönlü köprü.
 *
 * client'ın auth store'u doğrudan import etmesi döngüsel bağımlılık yaratırdı
 * (store -> client -> store). Store açılışta kancalarını buraya kaydeder.
 */
export type SessionHooks = {
  /** Bellekteki access token; yoksa null. */
  getAccessToken: () => string | null;
  /** Refresh dener; yeni access token döner, başarısızsa null. */
  refresh: () => Promise<string | null>;
  /** Refresh de başarısız olduğunda oturumu kapatır. */
  onSessionExpired: () => void;
};

let hooks: SessionHooks | null = null;

export function setSessionHooks(next: SessionHooks | null): void {
  hooks = next;
}

export function sessionHooks(): SessionHooks | null {
  return hooks;
}
