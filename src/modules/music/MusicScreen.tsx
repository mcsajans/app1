import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { errorText } from '../../core/api/client';
import { musicService, type Track } from '../../core/api/modules';
import { FADE_MS, useMusicStore } from '../../core/music/useMusicStore';
import { useAsyncData } from '../../core/hooks/useAsyncData';
import { Chips, formatDuration } from '../../components/records';
import { Button, Card, EmptyState, FormError, Loading, Screen, SectionTitle } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { colors, radius, spacing, typography } from '../../core/theme';

const CATEGORY_LABELS: Record<string, string> = {
  ninni: 'Ninni', beyaz_gurultu: 'Beyaz gürültü', doga: 'Doğa',
  klasik: 'Klasik', kalp_atisi: 'Kalp atışı', dua: 'Dua', diger: 'Diğer',
};

const SLEEP_TIMERS = ['0', '15', '30', '45', '60'] as const;
const TIMER_LABELS: Record<string, string> = {
  '0': 'Kapalı', '15': '15 dk', '30': '30 dk', '45': '45 dk', '60': '60 dk',
};

/**
 * Modül 7 — Ninni & Müzik.
 *
 * **Bu ekran çaları sahiplenmez.** Çalma oturumu `core/music/useMusicStore`
 * içinde, ekranlardan bağımsız yaşıyor; burası yalnızca onu çiziyor ve
 * komut veriyor. Gerekçe: çalar önce bu bileşende `useAudioPlayer` ile
 * kuruluyordu, o kanca nesneyi bileşen söküldüğünde serbest bırakıyor ve
 * ebeveyn ana sayfaya döndüğü anda ninni susuyordu (logda
 * `ExoPlayerImpl: Release`). Oysa uyutma müziğinin tek işi, telefon bırakılıp
 * odadan çıkıldıktan sonra çalmaya devam etmek.
 *
 * Çalma artık yalnızca şunlarla durur: ekrandaki **Durdur**, bildirim
 * çubuğundan kapatma, uyku zamanlayıcısı ya da oturumun kapanması.
 */
export default function MusicScreen() {
  const [category, setCategory] = useState<string | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = useMusicStore((st) => st.current);
  const status = useMusicStore((st) => st.status);
  const loop = useMusicStore((st) => st.loop);
  const timerMin = useMusicStore((st) => st.timerMin);
  const fading = useMusicStore((st) => st.fading);

  const list = useAsyncData(
    () => (onlyFavorites ? musicService.favorites() : musicService.list(category ?? undefined)),
    [category, onlyFavorites],
  );
  const tracks = list.data?.tracks ?? [];

  const pick = (track: Track) => {
    setError(null);
    useMusicStore.getState().play(track);
  };

  const toggleFavorite = (t: Track) => {
    void musicService
      .toggleFavorite(t.id)
      .then(() => list.reload())
      .catch((e) => setError(errorText(e)));
  };

  /*
   * Çalma hatası **türetilir**, mağazaya ikinci kez kopyalanmaz. Önceden
   * `status.error` hiç okunmuyordu: başarısız çalma, sessiz bir çalardan
   * ayırt edilemiyordu.
   */
  const playbackError = status.error ? `Parça çalınamadı: ${status.error}` : null;

  return (
    <Screen>
      <SectionTitle hint="Ses, uygulamadan çıksan da durdurana kadar çalmaya devam eder.">
        Ninni & Müzik
      </SectionTitle>

      {error ? <FormError message={error} /> : null}
      {playbackError ? <FormError message={playbackError} /> : null}
      {list.error ? <FormError message={list.error} /> : null}

      {/* ── Çalar ── */}
      {current ? (
        <Card>
          {/*
            Durum satırı sesin gerçek hâlini yazar. Önceden sabit "Çalıyor"
            yazıyordu; dosya indirilirken de, çalma hiç başlamadığında da aynı
            metin duruyordu ve kullanıcı bekleyen bir çaları bozuk bir çalardan
            ayırt edemiyordu.
          */}
          <Text style={s.nowLabel}>
            {status.error
              ? 'Çalınamadı'
              : fading
                ? 'Kısılıyor…'
                : status.playing
                  ? 'Çalıyor'
                  : status.isBuffering || !status.isLoaded
                    ? 'Yükleniyor…'
                    : 'Duraklatıldı'}
          </Text>
          <Text style={s.nowTitle} numberOfLines={1}>
            {current.title}
          </Text>
          {current.artist ? <Text style={s.nowArtist}>{current.artist}</Text> : null}

          <Text style={s.time}>
            {formatDuration(status.currentTime)} / {formatDuration(status.duration || current.duration_seconds)}
          </Text>

          {/*
            Ağ üzerinden akan uzun bir parçada ilk ses birkaç saniye
            gecikebilir; bu satır olmasa bekleme "çalmıyor" gibi görünür.
          */}
          {!status.error && !status.playing && (status.isBuffering || !status.isLoaded) ? (
            <Text style={s.hint}>Parça sunucudan indiriliyor, ilk ses birazdan başlayacak.</Text>
          ) : null}

          <View style={s.controls}>
            <View style={s.controlCol}>
              <Button
                label={status.playing ? '⏸ Duraklat' : '▶ Çal'}
                onPress={() => useMusicStore.getState().toggle()}
              />
            </View>
            <View style={s.controlCol}>
              <Button
                label={loop ? 'Döngü açık' : 'Döngü kapalı'}
                variant="ghost"
                onPress={() => useMusicStore.getState().setLoop(!loop)}
              />
            </View>
          </View>

          {/*
            Durdur, duraklatmadan ayrı bir eylem: oturumu tamamen kapatır,
            çaları bırakır ve bildirim çubuğundaki denetimleri kaldırır.
            Duraklatılmış bir ninni bildirimde durmaya devam ediyor — onu
            oradan da kaldırmanın yolu bu düğme ya da bildirimi kaydırmak.
          */}
          <Button
            label="■ Durdur"
            variant="ghost"
            onPress={() => useMusicStore.getState().stop()}
          />

          <Text style={s.label}>Uyku zamanlayıcı</Text>
          <Chips
            options={SLEEP_TIMERS}
            value={String(timerMin)}
            onChange={(v) => v && useMusicStore.getState().setTimerMin(Number(v))}
            labels={TIMER_LABELS}
          />
          {timerMin > 0 ? (
            <Text style={s.hint}>
              Süre dolunca ses {Math.round(FADE_MS / 1000)} saniyede kısılarak durur.
            </Text>
          ) : null}

          <Text style={s.hint}>
            Uygulamayı kapatsan da çalmaya devam eder; bildirim çubuğundan
            duraklatabilir ya da kapatabilirsin.
          </Text>
        </Card>
      ) : null}

      {/* ── Filtreler ── */}
      <View style={s.filterRow}>
        <Pressable
          onPress={() => {
            setOnlyFavorites((v) => !v);
            setCategory(null);
          }}
          style={[s.favBtn, onlyFavorites && s.favBtnOn]}
        >
          <Text style={[s.favText, onlyFavorites && s.favTextOn]}>
            Favoriler
          </Text>
        </Pressable>
      </View>

      {!onlyFavorites ? (
        <Chips
          options={Object.keys(CATEGORY_LABELS)}
          value={category}
          onChange={setCategory}
          labels={CATEGORY_LABELS}
          allowClear
        />
      ) : null}

      {/* ── Liste ── */}
      <Card>
        {list.loading && tracks.length === 0 ? (
          <Loading label="Kütüphane yükleniyor…" />
        ) : tracks.length === 0 ? (
          <EmptyState
            icon="music"
            title={onlyFavorites ? 'Favori yok' : 'Kütüphane boş'}
            detail="Parçalar yönetim panelinden yüklenir."
          />
        ) : (
          tracks.map((t) => {
            const active = current?.id === t.id;
            return (
              <View key={t.id} style={s.trackRow}>
                <Pressable style={s.trackMain} onPress={() => pick(t)}>
                  <Text style={[s.trackTitle, active && s.trackActive]} numberOfLines={1}>
                    {active && status.playing ? '▶ ' : ''}
                    {t.title}
                  </Text>
                  <Text style={s.trackMeta} numberOfLines={1}>
                    {[CATEGORY_LABELS[t.category] ?? t.category, t.artist, formatDuration(t.duration_seconds)]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </Pressable>
                <Pressable onPress={() => toggleFavorite(t)} hitSlop={10}>
                  <Icon
                    name={t.is_favorite ? 'star' : 'starOutline'}
                    size={20}
                    color={t.is_favorite ? colors.warning : colors.textFaint}
                  />
                </Pressable>
              </View>
            );
          })
        )}
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { ...typography.small, color: colors.textSoft, fontWeight: '600', marginTop: spacing.sm },
  hint: { ...typography.tiny, color: colors.textFaint, marginTop: spacing.xs },
  nowLabel: { ...typography.tiny, color: colors.primary, fontWeight: '700' },
  nowTitle: { ...typography.h3, color: colors.text },
  nowArtist: { ...typography.small, color: colors.textSoft },
  time: { ...typography.small, color: colors.textFaint, fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  controlCol: { flex: 1 },
  filterRow: { flexDirection: 'row' },
  favBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  favBtnOn: { borderColor: colors.warning, backgroundColor: '#FFF6E6' },
  favText: { ...typography.small, color: colors.textSoft },
  favTextOn: { color: colors.warning, fontWeight: '700' },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  trackMain: { flex: 1 },
  trackTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  trackActive: { color: colors.primary },
  trackMeta: { ...typography.tiny, color: colors.textSoft, marginTop: 1 },
  star: { fontSize: 20, color: colors.warning },
});
