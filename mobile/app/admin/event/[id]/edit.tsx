import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Upload } from 'lucide-react-native';

import { useAppTheme } from '@/src/context/ThemeContext';
import {
  fetchAdminEventDetail,
  updateAdminEvent,
  uploadEventMedia,
} from '@/src/api/endpoints';
import { EventStatus } from '@/src/types';
import { Header } from '@/src/components/common/Header';
import { Input } from '@/src/components/common/Input';
import { Button } from '@/src/components/common/Button';
import { Skeleton } from '@/src/components/common/Skeleton';
import { Typography } from '@/src/constants/Typography';
import {
  getMediaPickerErrorMessage,
  validateAdminMediaAsset,
} from '@/src/utils/mediaValidation';

const ALL_STATUSES: EventStatus[] = [
  'draft',
  'published',
  'on_sale',
  'sales_closed',
  'ongoing',
  'finished',
  'archived',
];

export default function AdminEditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, brand } = useAppTheme();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [eventType, setEventType] = useState<'single' | 'festival'>('single');

  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<EventStatus>('draft');
  const [artistName, setArtistName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [daysCount, setDaysCount] = useState('');
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [newPosterUri, setNewPosterUri] = useState<string | null>(null);
  const [newBannerUri, setNewBannerUri] = useState<string | null>(null);
  const [posterError, setPosterError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchAdminEventDetail(id)
      .then((res) => {
        const ev = res.data;
        if (ev) {
          setEventType(ev.event_type);
          setName(ev.name || '');
          setVenue(ev.venue || '');
          setCity(ev.city || '');
          setDescription(ev.description || '');
          setStatus(ev.status || 'draft');
          setArtistName(ev.artist_name || '');
          setEventDate(ev.event_date || '');
          setEventTime(ev.event_time || '');
          setEventEndTime(ev.event_end_time || '');
          setDaysCount(ev.days_count ? String(ev.days_count) : '');
          setPosterUrl(ev.poster_url || null);
          setBannerUrl(ev.banner_url || null);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handlePickMedia = async (type: 'poster' | 'banner') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin Galeri', 'Aplikasi memerlukan izin untuk memilih gambar.');
      return;
    }
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!picked.canceled && picked.assets?.[0]) {
        const asset = picked.assets[0] as any;
        const check = validateAdminMediaAsset({
          fileName: asset.fileName ?? asset.file?.name,
          mimeType: asset.mimeType ?? asset.file?.type,
          fileSize: asset.fileSize ?? asset.file?.size,
          uri: asset.uri,
        });
        if (!check.valid) {
          if (type === 'poster') setPosterError(check.error);
          else setBannerError(check.error);
          return;
        }
        if (type === 'poster') {
          setPosterError(null);
          if (asset.uri) setNewPosterUri(asset.uri);
        } else {
          setBannerError(null);
          if (asset.uri) setNewBannerUri(asset.uri);
        }
      }
    } catch (err) {
      const msg = getMediaPickerErrorMessage(err);
      if (type === 'poster') setPosterError(msg);
      else setBannerError(msg);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setError(null);
    setWarning(null);

    if (name.trim().length < 3 || venue.trim().length < 3 || city.trim().length < 2) {
      setError('Nama event (min 3), venue (min 3), dan kota (min 2) wajib diisi.');
      return;
    }

    setSubmitting(true);

    try {
      const payload: any = {
        name: name.trim(),
        venue: venue.trim(),
        city: city.trim(),
        description: description.trim() || null,
        status,
      };
      if (eventType === 'single') {
        if (artistName.trim()) payload.artist_name = artistName.trim();
        if (eventDate.trim()) payload.event_date = eventDate.trim();
        if (eventTime.trim()) {
          const t = eventTime.trim();
          payload.event_time = /^\d{2}:\d{2}$/.test(t) ? `${t}:00` : t;
        }
        const rawEnd = eventEndTime.trim();
        if (rawEnd) {
          const cleanEnd = /^\d{2}:\d{2}$/.test(rawEnd) ? `${rawEnd}:00` : rawEnd;
          if (!/^\d{2}:\d{2}(:\d{2})?$/.test(cleanEnd)) {
            setError('Format Jam Selesai tidak valid. Gunakan HH:MM atau HH:MM:SS.');
            setSubmitting(false);
            return;
          }
          if (payload.event_time && cleanEnd <= payload.event_time) {
            setError('Jam Selesai harus setelah Jam Mulai.');
            setSubmitting(false);
            return;
          }
          payload.event_end_time = cleanEnd;
        } else {
          payload.event_end_time = null;
        }
      } else if (daysCount) {
        const parsedDays = Number(daysCount);
        if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 10) {
          setError('Jumlah hari festival harus 1 sampai 10.');
          setSubmitting(false);
          return;
        }
        payload.days_count = parsedDays;
      }

      await updateAdminEvent(id, payload);

      const mediaFailures: string[] = [];
      if (newPosterUri) {
        try {
          const pRes = await uploadEventMedia(id, 'poster', newPosterUri);
          if (pRes.data?.poster_url) setPosterUrl(pRes.data.poster_url);
          setNewPosterUri(null);
        } catch (err: any) {
          mediaFailures.push(`Poster: ${err?.message || 'HTTP 500'}`);
        }
      }
      if (newBannerUri) {
        try {
          const bRes = await uploadEventMedia(id, 'banner', newBannerUri);
          if (bRes.data?.banner_url) setBannerUrl(bRes.data.banner_url);
          setNewBannerUri(null);
        } catch (err: any) {
          mediaFailures.push(`Banner: ${err?.message || 'HTTP 500'}`);
        }
      }

      if (mediaFailures.length > 0) {
        const warnMsg = `Metadata event tersimpan, namun unggah media gagal: ${mediaFailures.join('; ')}`;
        setWarning(warnMsg);
        if (Platform.OS !== 'web') {
          Alert.alert('Metadata Tersimpan (Media Gagal)', warnMsg);
        }
        return;
      }

      if (Platform.OS === 'web') {
        router.back();
      } else {
        Alert.alert('Tersimpan', 'Informasi event berhasil diperbarui.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memperbarui event.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showBack title="Edit Event" />
        <View style={{ padding: 16, gap: 14 }}>
          <Skeleton width="100%" height={52} borderRadius={16} />
          <Skeleton width="100%" height={52} borderRadius={16} />
          <Skeleton width="100%" height={52} borderRadius={16} />
          <Skeleton width="100%" height={100} borderRadius={16} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showBack title="Edit Event" subtitle={`Event #${id} • ${eventType.toUpperCase()}`} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {error && (
            <View style={[styles.errorBox, { backgroundColor: brand.dangerSoft, borderColor: brand.danger }]}>
              <Text style={[Typography.caption, { color: brand.danger, fontWeight: '700' }]}>{error}</Text>
            </View>
          )}
          {warning && (
            <View style={[styles.errorBox, { backgroundColor: brand.warningSoft, borderColor: brand.warning }]}>
              <Text style={[Typography.caption, { color: brand.warning, fontWeight: '700' }]}>{warning}</Text>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Input label="Nama Event" value={name} onChangeText={setName} />
            <Input label="Venue" value={venue} onChangeText={setVenue} />
            <Input label="Kota" value={city} onChangeText={setCity} />
            <Input
              label="Deskripsi"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            <Text style={[Typography.caption, styles.label, { color: colors.textSecondary }]}>
              Status Event
            </Text>
            <View style={styles.statusGrid}>
              {ALL_STATUSES.map((st) => {
                const active = status === st;
                return (
                  <TouchableOpacity
                    key={st}
                    onPress={() => setStatus(st)}
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: active ? brand.primary : colors.surfaceElevated,
                        borderColor: active ? brand.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        Typography.caption,
                        {
                          color: active ? '#FFFFFF' : colors.textSecondary,
                          fontWeight: '700',
                          textTransform: 'capitalize',
                        },
                      ]}
                    >
                      {st}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {eventType === 'single' ? (
              <>
                <Input label="Nama Artis" value={artistName} onChangeText={setArtistName} />
                <Input
                  label="Tanggal Event (YYYY-MM-DD)"
                  value={eventDate}
                  onChangeText={setEventDate}
                />
                <Input
                  label="Waktu Event (HH:MM:SS)"
                  value={eventTime}
                  onChangeText={setEventTime}
                />
                <Input
                  label="Jam Selesai (WIB, Opsional)"
                  placeholder="22:00:00"
                  value={eventEndTime}
                  onChangeText={setEventEndTime}
                />
              </>
            ) : (
              <Input
                label="Jumlah Hari Festival (1-10)"
                value={daysCount}
                onChangeText={setDaysCount}
                keyboardType="number-pad"
              />
            )}

            {/* Media Upload Controls */}
            <Text style={[Typography.caption, styles.label, { color: colors.textSecondary, marginTop: 4 }]}>
              Poster &amp; Banner (Opsional)
            </Text>
            <View style={styles.mediaRow}>
              <View style={styles.mediaCol}>
                {(newPosterUri || posterUrl) && (
                  <Image source={{ uri: newPosterUri || posterUrl! }} style={styles.mediaPreview} resizeMode="contain" />
                )}
                <Button
                  title={newPosterUri ? 'Ganti Poster' : 'Pilih Poster'}
                  onPress={() => handlePickMedia('poster')}
                  size="sm"
                  variant="secondary"
                  icon={<Upload size={14} color={colors.text} />}
                />
                {posterError ? (
                  <Text style={{ fontSize: 11.5, color: brand.danger, fontWeight: '600' }}>
                    {posterError}
                  </Text>
                ) : null}
              </View>
              <View style={styles.mediaCol}>
                {(newBannerUri || bannerUrl) && (
                  <Image source={{ uri: newBannerUri || bannerUrl! }} style={styles.mediaPreview} resizeMode="cover" />
                )}
                <Button
                  title={newBannerUri ? 'Ganti Banner' : 'Pilih Banner'}
                  onPress={() => handlePickMedia('banner')}
                  size="sm"
                  variant="secondary"
                  icon={<Upload size={14} color={colors.text} />}
                />
                {bannerError ? (
                  <Text style={{ fontSize: 11.5, color: brand.danger, fontWeight: '600' }}>
                    {bannerError}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={[styles.infoNote, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[Typography.caption, { color: colors.textSecondary, lineHeight: 17 }]}>
                Catatan: Kategori tiket dan lineup festival dikonfigurasi saat pembuatan event. Fase harga tiket dapat dikelola langsung melalui menu Fase Harga.
              </Text>
              <Button
                title="Kelola Fase Harga Tiket"
                onPress={() => router.push(`/admin/event/${id}/phases` as any)}
                variant="outline"
                size="sm"
                style={{ marginTop: 8 }}
              />
            </View>

            <Button
              title="Simpan Perubahan"
              onPress={handleSave}
              loading={submitting}
              variant="gradient"
              size="lg"
              style={{ marginTop: 12 }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  errorBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
  },
  label: {
    fontWeight: '700',
    marginBottom: 8,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  mediaCol: {
    flex: 1,
    gap: 8,
  },
  mediaPreview: {
    width: '100%',
    height: 80,
    borderRadius: 12,
    backgroundColor: '#0F172A',
  },
  infoNote: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
  },
});
