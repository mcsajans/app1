import { useCallback, useEffect, useRef, useState } from 'react';

import { errorText } from '../api/client';

export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Yeniden yükler; kaydetme sonrası çağrılır. */
  reload: () => void;
};

/**
 * Tek seferlik veri yükleme + yenileme.
 *
 * `loading` bir DURUM değil, **türetilmiş** değerdir: yüklenmiş verinin ait
 * olduğu anahtar ile şu anki anahtar farklıysa yükleme sürüyordur. Böylece
 * efekt içinde `setLoading(true)` çağırmak (ve ondan doğan zincirleme render)
 * gerekmez.
 *
 * İki ayrıntı önemli:
 *  - Sonuç, bileşen söküldükten sonra yazılmaz (`alive`); aksi hâlde ekran
 *    kapandıktan sonra gelen yanıt uyarı üretirdi.
 *  - Her yükleme bir sıra numarası taşır ve yalnızca **en son** isteğin sonucu
 *    yazılır; hızlı art arda yenilemelerde eski yanıt yenisinin üzerine
 *    yazabilirdi (yarış koşulu).
 */
export function useAsyncData<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [tick, setTick] = useState(0);
  const key = JSON.stringify([...deps, tick]);

  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null }>({
    key: null,
    data: null,
    error: null,
  });

  const alive = useRef(true);
  const seq = useRef(0);

  // `load` her render'da yeni bir kapanış; bağımlılık olarak kullanılamaz.
  // Ref render SIRASINDA yazılmaz; bu efekt yükleme efektinden önce
  // bildirildiği için her render'da ondan önce çalışır.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const mine = ++seq.current;

    loadRef
      .current()
      .then((result) => {
        if (!alive.current || mine !== seq.current) return;
        setState({ key, data: result, error: null });
      })
      .catch((err: unknown) => {
        if (!alive.current || mine !== seq.current) return;
        // Hata durumunda da anahtar işaretlenir, yoksa `loading` sonsuza dek
        // true kalır ve ekran hiç hata göstermezdi.
        setState((prev) => ({ key, data: prev.data, error: errorText(err) }));
      });
  }, [key]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  return {
    data: state.data,
    loading: state.key !== key,
    error: state.key === key ? state.error : null,
    reload,
  };
}
