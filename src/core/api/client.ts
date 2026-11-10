import { API_BASE_URL, API_HEADERS, REQUEST_TIMEOUT_MS } from '../config';
import { sessionHooks } from './session';

/** Sunucunun döndürdüğü hata kodları (TEKNIK_DOKUMAN.md §8). */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'SERVER_ERROR';

type Envelope<T> =
  | { success: true; data: T; meta?: { server_time?: string } }
  | { success: false; error: { code: string; message: string; fields?: Record<string, string> } };

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(code: ApiErrorCode, message: string, status = 0, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

/** Kullanıcıya gösterilebilir tek satırlık mesaj. */
export function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Beklenmeyen bir hata oluştu.';
}

export type QueryValue = string | number | boolean | null | undefined;

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON gövdesi; `GET` ile birlikte verilmez. */
  body?: unknown;
  query?: Record<string, QueryValue>;
  /**
   * false ise Authorization başlığı eklenmez ve 401'de refresh denenmez.
   * Giriş, kayıt ve refresh uçları için kullanılır.
   */
  auth?: boolean;
  /** Oturum token'ını geçersiz kılar (ör. refresh akışının kendisi). */
  token?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
};

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = `${API_BASE_URL}${path}`;
  if (!query) return url;

  const parts = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);

  return parts.length ? `${url}?${parts.join('&')}` : url;
}

type SendResult<T> = { data: T } | { error: ApiError };

/**
 * Tek bir HTTP turu. 401'i hata olarak döndürür ama fırlatmaz — çağıran
 * katman refresh deneyip isteği tekrarlayabilsin diye.
 */
async function send<T>(path: string, options: RequestOptions, token: string | null): Promise<SendResult<T>> {
  const { method = 'GET', body, query, signal, timeoutMs = REQUEST_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort);

  // Dosya yüklemede gövde FormData'dır: Content-Type'ı fetch kendisi üretmeli,
  // çünkü multipart sınır (boundary) değeri başlığın içinde taşınır. Elle
  // 'application/json' yazmak gövdeyi ayrıştırılamaz hâle getirirdi.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body === undefined || isForm ? null : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : null),
        ...API_HEADERS,
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    if (controller.signal.aborted && !signal?.aborted) {
      return { error: new ApiError('TIMEOUT', `Sunucu ${timeoutMs} ms içinde yanıt vermedi.`) };
    }
    return { error: new ApiError('NETWORK_ERROR', 'Sunucuya ulaşılamadı. Bağlantını kontrol et.') };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onOuterAbort);
  }

  const text = await response.text();
  let envelope: Envelope<T> | null = null;
  try {
    envelope = text ? (JSON.parse(text) as Envelope<T>) : null;
  } catch {
    // Zarf dışı yanıt (ör. Apache'nin kendi hata sayfası) — aşağıda ele alınır.
  }

  if (envelope && envelope.success === false) {
    return {
      error: new ApiError(
        envelope.error.code as ApiErrorCode,
        envelope.error.message,
        response.status,
        envelope.error.fields,
      ),
    };
  }

  if (!response.ok) {
    return {
      error: new ApiError('SERVER_ERROR', `Beklenmeyen yanıt (HTTP ${response.status}).`, response.status),
    };
  }

  if (!envelope) {
    return { error: new ApiError('SERVER_ERROR', 'Yanıt JSON olarak ayrıştırılamadı.', response.status) };
  }

  return { data: envelope.data };
}

const isAuthFailure = (e: ApiError) => e.code === 'UNAUTHENTICATED' || e.code === 'TOKEN_EXPIRED';

/**
 * Tek istek noktası. `data` alanını çözer, hata zarfını `ApiError`'a çevirir.
 *
 * Access token süresi dolmuşsa isteği **bir kez** askıya alır, refresh ile
 * çifti yeniler ve tekrarlar. Eşzamanlı isteklerde yalnızca ilki refresh
 * çağırır; diğerleri aynı sözü bekler (bkz. useAuthStore.refresh) — token
 * rotation'da yarış koşulu oluşmaz (§5.7).
 *
 * `API_HEADERS`, isme dayalı sanal konağı seçen `Host` başlığını taşır; IP'ye
 * bağlanıldığında bu başlık olmadan Apache 404 döner (bkz. core/config.ts).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const useAuth = options.auth !== false;
  const hooks = sessionHooks();

  const firstToken =
    options.token !== undefined ? options.token : useAuth ? (hooks?.getAccessToken() ?? null) : null;

  const first = await send<T>(path, options, firstToken);
  if ('data' in first) return first.data;

  const canRetry = useAuth && options.token === undefined && hooks !== null && isAuthFailure(first.error);
  if (!canRetry) throw first.error;

  const renewed = await hooks!.refresh();
  if (!renewed) {
    hooks!.onSessionExpired();
    throw first.error;
  }

  const second = await send<T>(path, options, renewed);
  if ('data' in second) return second.data;
  if (isAuthFailure(second.error)) hooks!.onSessionExpired();
  throw second.error;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
