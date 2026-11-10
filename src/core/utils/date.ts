import dayjs from 'dayjs';
import 'dayjs/locale/tr';

dayjs.locale('tr');

/** Olaylar UTC saklanır; gösterimde cihaz saat dilimine çevrilir. */
export const toIsoUtc = (d: Date = new Date()): string => d.toISOString();

export const clockOf = (iso: string): string => dayjs(iso).format('HH:mm');
export const clockSecOf = (iso: string): string => dayjs(iso).format('HH:mm:ss');
export const dayKeyOf = (iso: string): string => dayjs(iso).format('YYYY-MM-DD');
export const prettyDate = (key: string): string => dayjs(key).format('D MMMM YYYY, dddd');

export const todayKey = (): string => dayjs().format('YYYY-MM-DD');

/** Cihazın UTC'ye göre dakika cinsinden farkı (kayıtla birlikte saklanır). */
export const tzOffsetMin = (): number => -new Date().getTimezoneOffset();

export { dayjs };
