import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  Building2,
  Calendar,
  MapPin,
  Pencil,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react-native';

import { useAppTheme } from '@/src/context/ThemeContext';
import {
  deleteAdminEvent,
  fetchAdminEventDetail,
  updateAdminEventStatus,
  uploadEventMedia,
} from '@/src/api/endpoints';
import { EventItem, EventStatus } from '@/src/types';
import { formatEventSchedule, formatRupiah } from '@/src/utils/formatters';
import {
  getMediaPickerErrorMessage,
  validateAdminMediaAsset,
} from '@/src/utils/mediaValidation';
import { Header } from '@/src/components/common/Header';
import { Badge } from '@/src/components/common/Badge';
import { Button } from '@/src/components/common/Button';
import { Skeleton } from '@/src/components/common/Skeleton';
import { Typography } from '@/src/constants/Typography';
import { FALLBACK_EVENT_IMAGE } from '@/src/constants/Config';

const STATUS_TRANSITIONS: EventStatus[] = [
  'published',
  'on_sale',
  'sales_closed',
  'ongoing',
  'finished',
  'archived',
];

export default function AdminEventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, brand } = useAppTheme();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const hasLoadedRef = useRef(false);

  const refreshDetail = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetchAdminEventDetail(id);
      setEvent(res.data || null);
    } catch {
      setEvent(null);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let ignore = false;
    fetchAdminEventDetail(id)
      .then((res) => {
        if (!ignore) {
          setEvent(res.data || null);
        }
      })
      .catch(() => {
        if (!ignore) {
          setEvent(null);
        }
      })
      .finally(() => {
        if (!ignore) {
          hasLoadedRef.current = true;
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) return;
      refreshDetail();
    }, [refreshDetail])
  );

  const handleUploadMedia = async (type: 'poster' | 'banner') => {
    if (!id) return;
    setFeedback(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setFeedback({ type: 'error', text: 'Aplikasi memerlukan izin akses galeri foto untuk mengunggah gambar.' });
      return;
    }

    let picked: ImagePicker.ImagePickerResult;
    try {
      picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
    } catch (err) {
      const msg = `${type === 'poster' ? 'Poster' : 'Banner'}: ${getMediaPickerErrorMessage(err)}`;
      setFeedback({ type: 'error', text: msg });
      if (Platform.OS !== 'web') Alert.alert('Format / Ukuran Tidak Valid', msg);
      return;
    }

    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0] as any;
    const validation = validateAdminMediaAsset({
      fileName: asset.fileName ?? asset.file?.name,
      mimeType: asset.mimeType ?? asset.file?.type,
      fileSize: asset.fileSize ?? asset.file?.size,
      uri: asset.uri,
    });
    if (!validation.valid) {
      const msg = `${type === 'poster' ? 'Poster' : 'Banner'}: ${validation.error}`;
      setFeedback({ type: 'error', text: msg });
      if (Platform.OS !== 'web') Alert.alert('Format / Ukuran Tidak Valid', msg);
      return;
    }

    setUploading(true);
    try {
      await uploadEventMedia(id, type, asset.uri);
      const msg = `${type === 'poster' ? 'Poster' : 'Banner'} berhasil diunggah.`;
      setFeedback({ type: 'success', text: msg });
      if (Platform.OS !== 'web') Alert.alert('Sukses', msg);
      await refreshDetail();
    } catch (err: any) {
      const msg = `Gagal mengunggah ${type}: ${err?.message || 'Gagal memproses media.'}`;
      setFeedback({ type: 'error', text: msg });
      if (Platform.OS !== 'web') Alert.alert('Gagal Upload', msg);
    } finally {
      setUploading(false);
    }
  };

  const handleStatusChange = async (st: EventStatus) => {
    if (!id) return;
    setFeedback(null);
    try {
      await updateAdminEventStatus(id, st);
      const msg = `Status event diubah menjadi "${st}".`;
      setFeedback({ type: 'success', text: msg });
      if (Platform.OS !== 'web') Alert.alert('Status Diperbarui', msg);
      await refreshDetail();
    } catch (err: any) {
      const msg = err?.message || 'Gagal mengubah status.';
      setFeedback({ type: 'error', text: msg });
      if (Platform.OS !== 'web') Alert.alert('Error', msg);
    }
  };

  const performDelete = async () => {
    if (!event) return;
    setFeedback(null);
    try {
      await deleteAdminEvent(event.id);
      router.replace('/admin/events' as any);
    } catch (err: any) {
      const msg = err?.message || 'Event yang sudah terjual tidak dapat dihapus.';
      setFeedback({ type: 'error', text: msg });
      if (Platform.OS !== 'web') Alert.alert('Gagal', msg);
    }
  };

  const handleDelete = () => {
    if (!event) return;
    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        !window.confirm(`Hapus event "${event.name}" secara permanen?`)
      ) {
        return;
      }
      performDelete();
      return;
    }

    Alert.alert(
      'Hapus Event',
      `Hapus event "${event.name}" secara permanen?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => performDelete(),
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showBack title="Detail Event (Admin)" />
        <View style={{ padding: 16, gap: 14 }}>
          <Skeleton width="100%" height={170} borderRadius={20} />
          <Skeleton width="100%" height={120} borderRadius={20} />
          <Skeleton width="100%" height={140} borderRadius={20} />
        </View>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showBack title="Detail Event (Admin)" />
        <View style={styles.centerWrap}>
          <Text style={[Typography.body, { color: brand.danger, fontWeight: '700' }]}>
            Event tidak ditemukan
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        showBack
        title="Detail Event"
        subtitle={`#${event.id} • ${event.event_type.toUpperCase()}`}
        rightAction={
          <TouchableOpacity
            onPress={() => router.push(`/admin/event/${event.id}/edit` as any)}
            style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}
          >
            <Pencil size={17} color={colors.text} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {feedback && (
          <View
            style={[
              styles.feedbackBox,
              {
                backgroundColor: feedback.type === 'success' ? brand.successSoft : brand.dangerSoft,
                borderColor: feedback.type === 'success' ? brand.success : brand.danger,
              },
            ]}
          >
            <Text
              style={[
                Typography.caption,
                {
                  color: feedback.type === 'success' ? brand.success : brand.danger,
                  fontWeight: '700',
                },
              ]}
            >
              {feedback.text}
            </Text>
          </View>
        )}

        {/* Media Preview & Upload */}
        <View style={styles.mediaCard}>
          <Image
            source={{ uri: event.banner_url || event.poster_url || FALLBACK_EVENT_IMAGE }}
            style={styles.bannerImg}
          />
          <View style={styles.mediaBtnRow}>
            <Button
              title={uploading ? 'Mengunggah...' : 'Upload Poster'}
              onPress={() => handleUploadMedia('poster')}
              disabled={uploading}
              size="sm"
              variant="secondary"
              icon={<Upload size={14} color={colors.text} />}
              style={{ flex: 1 }}
            />
            <Button
              title={uploading ? 'Mengunggah...' : 'Upload Banner'}
              onPress={() => handleUploadMedia('banner')}
              disabled={uploading}
              size="sm"
              variant="secondary"
              icon={<Upload size={14} color={colors.text} />}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {/* Event Info */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.headerRow}>
            <Badge status={event.status} />
            <Badge label={event.event_type} variant="purple" />
          </View>
          <Text style={[Typography.h2, styles.evName, { color: colors.text }]}>{event.name}</Text>
          {Boolean(event.artist_name) && (
            <Text style={[Typography.body, styles.artistText, { color: brand.primary, fontWeight: '700' }]}>
              {event.artist_name}
            </Text>
          )}

          <View style={styles.metaRow}>
            <Calendar size={15} color={colors.textMuted} />
            <Text style={[Typography.caption, styles.metaText, { color: colors.textSecondary }]}>
              {formatEventSchedule(event, { includeTime: true })}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <MapPin size={15} color={colors.textMuted} />
            <Text style={[Typography.caption, styles.metaText, { color: colors.textSecondary }]}>
              {event.venue}, {event.city}
            </Text>
          </View>
          {Boolean(event.agency?.name) && (
            <View style={styles.metaRow}>
              <Building2 size={15} color={colors.textMuted} />
              <Text style={[Typography.caption, styles.metaText, { color: colors.textSecondary }]}>
                Promotor: {event.agency?.name}
              </Text>
            </View>
          )}
          {Boolean(event.description) && (
            <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 8, lineHeight: 18 }]}>
              {event.description}
            </Text>
          )}
        </View>

        {/* Poster Acara (Uncropped Portrait / Landscape) */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[Typography.h4, { color: colors.text, fontWeight: '700' }]}>
            Poster Acara
          </Text>
          <Text style={[Typography.caption, { color: colors.textMuted, marginTop: 2, marginBottom: 12 }]}>
            Poster tampil utuh tanpa crop, termasuk rasio potret.
          </Text>
          {event.poster_url ? (
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceElevated,
                padding: 10,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Image
                source={{ uri: event.poster_url }}
                style={{ width: '100%', height: 280, borderRadius: 10 }}
                resizeMode="contain"
              />
            </View>
          ) : (
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: colors.border,
                backgroundColor: colors.surfaceElevated,
                padding: 20,
                alignItems: 'center',
              }}
            >
              <Text style={[Typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
                Belum ada poster acara. Gunakan tombol Upload Poster atau Edit Event untuk menambahkan.
              </Text>
            </View>
          )}
        </View>

        {/* Festival Lineup (if festival) */}
        {event.event_type === 'festival' && (event.festival_artists || []).length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Sparkles size={16} color={brand.purple} />
              <Text style={[Typography.h3, { color: colors.text }]}>
                Lineup Festival ({event.festival_artists?.length} Artis)
              </Text>
            </View>
            {[...(event.festival_artists || [])]
              .sort((a, b) => (a.day_number || 1) - (b.day_number || 1))
              .map((fa, idx) => (
                <View key={fa.id || idx} style={[styles.lineupRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.dayBadge, { backgroundColor: brand.purpleSoft }]}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: brand.purple }}>
                      Day {fa.day_number}
                    </Text>
                  </View>
                  <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>
                    {fa.artist_name}
                  </Text>
                </View>
              ))}
          </View>
        )}

        {/* Status Transition */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[Typography.h3, styles.sectionTitle, { color: colors.text }]}>
            Transisi Status Event
          </Text>
          <View style={styles.statusGrid}>
            {STATUS_TRANSITIONS.map((st) => {
              const active = event.status === st;
              return (
                <TouchableOpacity
                  key={st}
                  onPress={() => handleStatusChange(st)}
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
        </View>

        {/* Ticket Types & Phases */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.ttHeaderRow}>
            <Text style={[Typography.h3, styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>
              Kategori Tiket &amp; Fase Harga
            </Text>
            <TouchableOpacity
              onPress={() => router.push(`/admin/event/${event.id}/phases` as any)}
            >
              <Text style={[Typography.caption, { color: brand.primary, fontWeight: '700' }]}>
                Kelola Fase
              </Text>
            </TouchableOpacity>
          </View>

          {(event.ticket_types || []).length === 0 ? (
            <Text style={[Typography.caption, { color: colors.textMuted, marginTop: 10 }]}>
              Tidak ada kategori tiket terdaftar.
            </Text>
          ) : (
            (event.ticket_types || []).map((tt) => (
              <View
                key={tt.id}
                style={[styles.ttRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.h4, styles.ttName, { color: colors.text }]}>{tt.name}</Text>
                  <Text style={[Typography.caption, styles.ttMeta, { color: colors.textSecondary }]}>
                    {formatRupiah(tt.base_price)} • Terjual {tt.sold_count}/{tt.quota}
                  </Text>
                  <Text style={[Typography.caption, styles.ttPhases, { color: brand.primary, fontWeight: '700' }]}>
                    {tt.phases?.length || 0} fase harga terdaftar
                    {tt.active_phase ? ` • Aktif: ${tt.active_phase.phase_name} (-${tt.active_phase.discount_percent}%)` : ''}
                  </Text>
                  {tt.phases && tt.phases.length > 0 && (
                    <View style={{ marginTop: 4, gap: 2 }}>
                      {tt.phases.map((p) => (
                        <Text key={p.id} style={{ fontSize: 11, color: colors.textMuted }}>
                          • {p.phase_name.toUpperCase()} ({p.start_date} s/d {p.end_date}) — Diskon {p.discount_percent}%
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
                <Button
                  title="Fase"
                  size="sm"
                  variant="outline"
                  onPress={() =>
                    router.push({
                      pathname: `/admin/event/${event.id}/phases` as any,
                      params: { ticketTypeId: String(tt.id) },
                    })
                  }
                />
              </View>
            ))
          )}
        </View>

        <Button
          title="Hapus Event Ini"
          onPress={handleDelete}
          variant="danger"
          size="md"
          icon={<Trash2 size={16} color="#FFFFFF" />}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  mediaCard: {
    marginBottom: 16,
  },
  bannerImg: {
    width: '100%',
    height: 170,
    borderRadius: 22,
    marginBottom: 10,
    backgroundColor: '#0F172A',
  },
  mediaBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  evName: {
    fontSize: 20,
    lineHeight: 26,
    marginBottom: 4,
  },
  artistText: {
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  metaText: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  ttHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ttRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  ttName: {
    fontSize: 14,
  },
  ttMeta: {
    marginTop: 2,
  },
  ttPhases: {
    marginTop: 3,
  },
  feedbackBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  lineupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  dayBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
});
