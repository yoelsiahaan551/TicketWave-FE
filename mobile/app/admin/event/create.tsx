import React, { useEffect, useRef, useState } from 'react';
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
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Plus, Trash2, Upload } from 'lucide-react-native';

import { useAppTheme } from '../../../src/context/ThemeContext';
import {
  createAdminEvent,
  fetchAdminAgencies,
  updateAdminEventStatus,
  uploadEventMedia,
} from '../../../src/api/endpoints';
import { Agency, EventStatus } from '../../../src/types';
import { Header } from '../../../src/components/common/Header';
import { Input } from '../../../src/components/common/Input';
import { Button } from '../../../src/components/common/Button';
import { Typography } from '../../../src/constants/Typography';
import {
  getMediaPickerErrorMessage,
  validateAdminMediaAsset,
} from '../../../src/utils/mediaValidation';

interface DraftPhase {
  phase_name: 'early_bird' | 'presale' | 'normal';
  start_date: string;
  end_date: string;
  discount_percent: string;
}

interface DraftTicketType {
  name: string;
  base_price: string;
  quota: string;
  description: string;
  phases: DraftPhase[];
}

const PHASE_NAMES: ('early_bird' | 'presale' | 'normal')[] = [
  'early_bird',
  'presale',
  'normal',
];

const INITIAL_STATUS_OPTIONS: EventStatus[] = ['draft', 'published', 'on_sale'];

export default function AdminCreateEventScreen() {
  const router = useRouter();
  const { colors, brand } = useAppTheme();

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agencyId, setAgencyId] = useState<number | null>(null);

  const [eventType, setEventType] = useState<'single' | 'festival'>('single');
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [initialStatus, setInitialStatus] = useState<EventStatus>('draft');

  // Optional Media
  const [posterUri, setPosterUri] = useState<string | null>(null);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [posterError, setPosterError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Single
  const [artistName, setArtistName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('19:00:00');
  const [eventEndTime, setEventEndTime] = useState('');

  // Festival
  const [daysCount, setDaysCount] = useState('1');
  const [festivalArtists, setFestivalArtists] = useState<{ day_number: number; artist_name: string }[]>([
    { day_number: 1, artist_name: '' },
  ]);

  // Nested Ticket Types + Phases
  const [ticketTypes, setTicketTypes] = useState<DraftTicketType[]>([
    { name: 'Regular', base_price: '150000', quota: '500', description: 'General admission', phases: [] },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [createdEventId, setCreatedEventId] = useState<number | null>(null);
  const createdEventIdRef = useRef<number | null>(null);

  useEffect(() => {
    fetchAdminAgencies({ per_page: 50 })
      .then((res) => {
        const items = res.data?.items || [];
        setAgencies(items);
        if (items.length > 0) setAgencyId(items[0].id);
      })
      .catch(() => {});
  }, []);

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
          if (asset.uri) setPosterUri(asset.uri);
        } else {
          setBannerError(null);
          if (asset.uri) setBannerUri(asset.uri);
        }
      }
    } catch (err) {
      const msg = getMediaPickerErrorMessage(err);
      if (type === 'poster') setPosterError(msg);
      else setBannerError(msg);
    }
  };

  const handleAddArtist = () => {
    setFestivalArtists((prev) => [
      ...prev,
      { day_number: Math.min(Number(daysCount) || 1, prev.length + 1), artist_name: '' },
    ]);
  };

  const handleRemoveArtist = (index: number) => {
    setFestivalArtists((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddTicketType = () => {
    setTicketTypes((prev) => [
      ...prev,
      { name: 'VIP', base_price: '350000', quota: '200', description: 'Priority access', phases: [] },
    ]);
  };

  const handleRemoveTicketType = (index: number) => {
    setTicketTypes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddPhase = (ttIndex: number) => {
    setTicketTypes((prev) =>
      prev.map((tt, idx) =>
        idx === ttIndex
          ? {
              ...tt,
              phases: [
                ...tt.phases,
                {
                  phase_name: tt.phases.length === 0 ? 'early_bird' : 'presale',
                  start_date: '2026-11-25',
                  end_date: '2026-12-05',
                  discount_percent: '15',
                },
              ],
            }
          : tt
      )
    );
  };

  const handleRemovePhase = (ttIndex: number, phaseIndex: number) => {
    setTicketTypes((prev) =>
      prev.map((tt, idx) =>
        idx === ttIndex
          ? { ...tt, phases: tt.phases.filter((_, pIdx) => pIdx !== phaseIndex) }
          : tt
      )
    );
  };

  const updatePhaseField = <K extends keyof DraftPhase>(
    ttIndex: number,
    phaseIndex: number,
    field: K,
    value: DraftPhase[K]
  ) => {
    setTicketTypes((prev) =>
      prev.map((tt, idx) =>
        idx === ttIndex
          ? {
              ...tt,
              phases: tt.phases.map((p, pIdx) =>
                pIdx === phaseIndex ? { ...p, [field]: value } : p
              ),
            }
          : tt
      )
    );
  };

  const handleSubmit = async () => {
    setError(null);
    setWarning(null);

    if (createdEventIdRef.current) {
      router.replace(`/admin/event/${createdEventIdRef.current}` as any);
      return;
    }

    if (!agencyId) {
      setError('Pilih agensi penyelenggara terlebih dahulu.');
      return;
    }
    const cleanName = name.trim();
    const cleanVenue = venue.trim();
    const cleanCity = city.trim();
    if (cleanName.length < 3 || cleanName.length > 200) {
      setError('Nama event wajib diisi (3–200 karakter).');
      return;
    }
    if (cleanVenue.length < 3 || cleanVenue.length > 200) {
      setError('Venue wajib diisi (3–200 karakter).');
      return;
    }
    if (cleanCity.length < 2 || cleanCity.length > 100) {
      setError('Kota wajib diisi (2–100 karakter).');
      return;
    }

    const payload: any = {
      agency_id: Number(agencyId),
      event_type: eventType,
      name: cleanName,
      venue: cleanVenue,
      city: cleanCity,
      description: description.trim() || undefined,
    };

    if (eventType === 'single') {
      const cleanArtist = artistName.trim();
      const cleanDate = eventDate.trim();
      const rawTime = eventTime.trim();
      const cleanTime = /^\d{2}:\d{2}$/.test(rawTime) ? `${rawTime}:00` : rawTime;
      if (cleanArtist.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate) || !/^\d{2}:\d{2}(:\d{2})?$/.test(cleanTime)) {
        setError('Untuk Single event, nama artis (min 2 huruf), tanggal (YYYY-MM-DD), dan waktu (HH:MM:SS) wajib valid.');
        return;
      }
      payload.artist_name = cleanArtist;
      payload.event_date = cleanDate;
      payload.event_time = cleanTime;
      const rawEnd = eventEndTime.trim();
      if (rawEnd) {
        const cleanEnd = /^\d{2}:\d{2}$/.test(rawEnd) ? `${rawEnd}:00` : rawEnd;
        if (!/^\d{2}:\d{2}(:\d{2})?$/.test(cleanEnd)) {
          setError('Format Jam Selesai tidak valid. Gunakan HH:MM atau HH:MM:SS.');
          return;
        }
        if (cleanEnd <= cleanTime) {
          setError('Jam Selesai harus setelah Jam Mulai.');
          return;
        }
        payload.event_end_time = cleanEnd;
      }
    } else {
      const parsedDays = Number(daysCount);
      if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 10) {
        setError('Jumlah hari festival harus bilangan bulat 1 hingga 10.');
        return;
      }
      const validArtists = festivalArtists.filter((a) => a.artist_name.trim().length > 0);
      if (validArtists.length === 0) {
        setError('Untuk Festival event, minimal 1 penampil artis wajib diisi.');
        return;
      }
      for (const a of validArtists) {
        if (a.artist_name.trim().length < 2 || a.day_number < 1 || a.day_number > parsedDays) {
          setError(`Setiap artis harus memiliki nama min 2 karakter dan hari 1–${parsedDays}.`);
          return;
        }
      }
      payload.days_count = parsedDays;
      payload.festival_artists = validArtists.map((a) => ({
        day_number: Number(a.day_number) || 1,
        artist_name: a.artist_name.trim(),
      }));
    }

    if (ticketTypes.length > 0) {
      const builtTypes: any[] = [];
      for (const t of ticketTypes) {
        const tName = t.name.trim();
        const tPrice = Number(t.base_price);
        const tQuota = Number(t.quota);
        if (tName.length < 2 || !Number.isFinite(tPrice) || tPrice < 0 || !Number.isInteger(tQuota) || tQuota < 1) {
          setError('Lengkapi kategori tiket (nama min 2 karakter, harga >= 0, kuota bulat >= 1).');
          return;
        }

        const builtPhases = [...t.phases]
          .sort((a, b) => a.start_date.localeCompare(b.start_date))
          .map((p) => ({
            phase_name: p.phase_name,
            start_date: p.start_date.trim(),
            end_date: p.end_date.trim(),
            discount_percent: Number(p.discount_percent),
          }));

        for (let i = 0; i < builtPhases.length; i++) {
          const p = builtPhases[i];
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(p.start_date) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(p.end_date) ||
            p.start_date >= p.end_date ||
            !Number.isFinite(p.discount_percent) ||
            p.discount_percent < 0 ||
            p.discount_percent > 100
          ) {
            setError(`Periksa fase pada kategori "${tName}": format YYYY-MM-DD, tanggal akhir setelah mulai, diskon 0–100%.`);
            return;
          }
          if (i > 0 && builtPhases[i - 1].end_date >= p.start_date) {
            setError(`Tanggal fase pada kategori "${tName}" tidak boleh bertabrakan.`);
            return;
          }
        }

        builtTypes.push({
          name: tName,
          base_price: tPrice,
          quota: tQuota,
          description: t.description.trim() || undefined,
          ...(builtPhases.length > 0 ? { phases: builtPhases } : {}),
        });
      }
      payload.ticket_types = builtTypes;
    }

    setSubmitting(true);
    try {
      const res = await createAdminEvent(payload);
      const newEventId = res.data?.id;
      if (newEventId) {
        createdEventIdRef.current = newEventId;
        setCreatedEventId(newEventId);
      }

      const warnings: string[] = [];
      if (newEventId && initialStatus !== 'draft') {
        try {
          await updateAdminEventStatus(newEventId, initialStatus);
        } catch (stErr: any) {
          warnings.push(`Status (${initialStatus}): ${stErr?.message || 'gagal'}`);
        }
      }

      if (newEventId && posterUri) {
        try {
          await uploadEventMedia(newEventId, 'poster', posterUri);
          setPosterUri(null);
        } catch (mErr: any) {
          warnings.push(`Poster: ${mErr?.message || 'Gagal mengunggah'}`);
        }
      }

      if (newEventId && bannerUri) {
        try {
          await uploadEventMedia(newEventId, 'banner', bannerUri);
          setBannerUri(null);
        } catch (mErr: any) {
          warnings.push(`Banner: ${mErr?.message || 'Gagal mengunggah'}`);
        }
      }

      if (warnings.length > 0 && newEventId) {
        const warnText = `Event "${res.data?.name || cleanName}" (#${newEventId}) berhasil dibuat, namun langkah lanjutan gagal: ${warnings.join('; ')}`;
        setWarning(warnText);
        if (Platform.OS !== 'web') {
          Alert.alert('Event Dibuat dengan Catatan', warnText, [
            { text: 'Lihat Detail', onPress: () => router.replace(`/admin/event/${newEventId}` as any) },
          ]);
        }
        return;
      }

      if (Platform.OS === 'web') {
        router.replace((newEventId ? `/admin/event/${newEventId}` : '/admin/events') as any);
      } else {
        Alert.alert('Sukses', `Event "${res.data?.name || cleanName}" berhasil dibuat!`, [
          {
            text: 'Lihat Detail',
            onPress: () =>
              router.replace((newEventId ? `/admin/event/${newEventId}` : '/admin/events') as any),
          },
        ]);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal membuat event.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showBack title="Buat Event Baru" subtitle="Konser tunggal atau festival multi-hari" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {error && (
            <View style={[styles.errorBox, { backgroundColor: brand.dangerSoft, borderColor: brand.danger }]}>
              <Text style={[Typography.caption, styles.errorText, { color: brand.danger }]}>
                {error}
              </Text>
            </View>
          )}
          {warning && (
            <View style={[styles.errorBox, { backgroundColor: brand.warningSoft, borderColor: brand.warning }]}>
              <Text style={[Typography.caption, styles.errorText, { color: brand.warning }]}>
                {warning}
              </Text>
              <Button
                title="Lihat Detail Event"
                onPress={() => router.replace(`/admin/event/${createdEventIdRef.current}` as any)}
                size="sm"
                variant="outline"
                style={{ marginTop: 10 }}
              />
            </View>
          )}

          {/* Event Type Switcher */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[Typography.h3, styles.cardTitle, { color: colors.text }]}>Tipe Format Event</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                onPress={() => setEventType('single')}
                style={[
                  styles.typeBtn,
                  {
                    backgroundColor: eventType === 'single' ? brand.primarySoft : colors.surfaceElevated,
                    borderColor: eventType === 'single' ? brand.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    Typography.body,
                    styles.typeBtnText,
                    { color: eventType === 'single' ? brand.primary : colors.text },
                  ]}
                >
                  Single Concert
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setEventType('festival')}
                style={[
                  styles.typeBtn,
                  {
                    backgroundColor: eventType === 'festival' ? brand.purpleSoft : colors.surfaceElevated,
                    borderColor: eventType === 'festival' ? brand.purple : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    Typography.body,
                    styles.typeBtnText,
                    { color: eventType === 'festival' ? brand.purple : colors.text },
                  ]}
                >
                  Festival Musik
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* General Information */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[Typography.h3, styles.cardTitle, { color: colors.text }]}>Informasi Utama</Text>

            {/* Agency Selector */}
            <Text style={[Typography.caption, styles.inputLabel, { color: colors.textSecondary }]}>
              Pilih Agency Penyelenggara *
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.agencyScroll}>
              {agencies.map((a) => {
                const selected = agencyId === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => setAgencyId(a.id)}
                    style={[
                      styles.agencyChip,
                      {
                        backgroundColor: selected ? brand.primary : colors.surfaceElevated,
                        borderColor: selected ? brand.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        Typography.caption,
                        { color: selected ? '#FFFFFF' : colors.text, fontWeight: '700' },
                      ]}
                    >
                      {a.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Input
              label="Nama Event *"
              placeholder="Contoh: Coldplay Music of the Spheres"
              value={name}
              onChangeText={setName}
            />

            <Input
              label="Venue Lokasi *"
              placeholder="Contoh: Gelora Bung Karno"
              value={venue}
              onChangeText={setVenue}
            />

            <Input
              label="Kota *"
              placeholder="Contoh: Jakarta"
              value={city}
              onChangeText={setCity}
            />

            <Input
              label="Deskripsi Event"
              placeholder="Ceritakan tentang konser ini..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Specific Type Fields */}
          {eventType === 'single' ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[Typography.h3, styles.cardTitle, { color: colors.text }]}>Detail Single Concert</Text>
              <Input
                label="Nama Artis / Musisi *"
                placeholder="Contoh: Coldplay"
                value={artistName}
                onChangeText={setArtistName}
              />
              <Input
                label="Tanggal Event (YYYY-MM-DD) *"
                placeholder="2026-11-20"
                value={eventDate}
                onChangeText={setEventDate}
              />
              <Input
                label="Waktu Event (HH:MM:SS) *"
                placeholder="19:00:00"
                value={eventTime}
                onChangeText={setEventTime}
              />
              <Input
                label="Jam Selesai (WIB, Opsional)"
                placeholder="22:00:00"
                value={eventEndTime}
                onChangeText={setEventEndTime}
              />
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[Typography.h3, styles.cardTitle, { color: colors.text }]}>Detail Festival</Text>
              <Input
                label="Jumlah Hari (Days Count) *"
                placeholder="Contoh: 3"
                value={daysCount}
                onChangeText={setDaysCount}
                keyboardType="number-pad"
              />

              <View style={styles.subHeaderRow}>
                <Text style={[Typography.h4, styles.subTitle, { color: colors.text }]}>Lineup Artis Festival</Text>
                <TouchableOpacity onPress={handleAddArtist} style={styles.addMiniBtn}>
                  <Plus size={14} color={brand.primary} />
                  <Text style={[Typography.caption, styles.addMiniText, { color: brand.primary }]}>Tambah Artis</Text>
                </TouchableOpacity>
              </View>

              {festivalArtists.map((fa, idx) => (
                <View key={idx} style={styles.dynamicRow}>
                  <Input
                    placeholder="Hari ke"
                    value={String(fa.day_number)}
                    onChangeText={(txt) => {
                      const next = [...festivalArtists];
                      next[idx].day_number = Number(txt) || 1;
                      setFestivalArtists(next);
                    }}
                    keyboardType="number-pad"
                    containerStyle={{ width: 80, marginBottom: 0 }}
                  />
                  <Input
                    placeholder="Nama artis festival"
                    value={fa.artist_name}
                    onChangeText={(txt) => {
                      const next = [...festivalArtists];
                      next[idx].artist_name = txt;
                      setFestivalArtists(next);
                    }}
                    containerStyle={{ flex: 1, marginBottom: 0 }}
                  />
                  <TouchableOpacity onPress={() => handleRemoveArtist(idx)} hitSlop={6}>
                    <Trash2 size={16} color={brand.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Nested Ticket Types */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.subHeaderRow}>
              <Text style={[Typography.h3, styles.cardTitle, { color: colors.text }]}>Kategori Tiket Awal</Text>
              <TouchableOpacity onPress={handleAddTicketType} style={styles.addMiniBtn}>
                <Plus size={14} color={brand.primary} />
                <Text style={[Typography.caption, styles.addMiniText, { color: brand.primary }]}>Kategori</Text>
              </TouchableOpacity>
            </View>

            {ticketTypes.map((tt, idx) => (
              <View
                key={idx}
                style={[
                  styles.ttBox,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <View style={styles.ttHeader}>
                  <Text style={[Typography.h4, styles.ttNumber, { color: brand.primary }]}>
                    Kategori #{idx + 1}
                  </Text>
                  {ticketTypes.length > 1 && (
                    <TouchableOpacity onPress={() => handleRemoveTicketType(idx)}>
                      <Trash2 size={16} color={brand.danger} />
                    </TouchableOpacity>
                  )}
                </View>

                <Input
                  label="Nama Kategori"
                  value={tt.name}
                  onChangeText={(txt) => {
                    const next = [...ticketTypes];
                    next[idx].name = txt;
                    setTicketTypes(next);
                  }}
                  placeholder="VIP, Regular, Festival..."
                />
                <Input
                  label="Harga Dasar (Rp)"
                  value={tt.base_price}
                  onChangeText={(txt) => {
                    const next = [...ticketTypes];
                    next[idx].base_price = txt;
                    setTicketTypes(next);
                  }}
                  keyboardType="number-pad"
                />
                <Input
                  label="Kuota Tiket"
                  value={tt.quota}
                  onChangeText={(txt) => {
                    const next = [...ticketTypes];
                    next[idx].quota = txt;
                    setTicketTypes(next);
                  }}
                  keyboardType="number-pad"
                />

                {/* Nested Pricing Phases */}
                <View style={styles.phaseSection}>
                  <View style={styles.subHeaderRow}>
                    <Text style={[Typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
                      Fase Harga Bertingkat (Opsional)
                    </Text>
                    <TouchableOpacity onPress={() => handleAddPhase(idx)} style={styles.addMiniBtn}>
                      <Plus size={13} color={brand.primary} />
                      <Text style={[Typography.caption, styles.addMiniText, { color: brand.primary }]}>
                        Tambah Fase
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {tt.phases.map((p, pIdx) => (
                    <View
                      key={pIdx}
                      style={[
                        styles.phaseBox,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <View style={styles.phaseHeaderRow}>
                        <View style={styles.phaseChoiceRow}>
                          {PHASE_NAMES.map((pn) => {
                            const active = p.phase_name === pn;
                            return (
                              <TouchableOpacity
                                key={pn}
                                onPress={() => updatePhaseField(idx, pIdx, 'phase_name', pn)}
                                style={[
                                  styles.phaseNameChip,
                                  {
                                    backgroundColor: active ? brand.primary : colors.surfaceElevated,
                                    borderColor: active ? brand.primary : colors.border,
                                  },
                                ]}
                              >
                                <Text
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: '700',
                                    color: active ? '#FFFFFF' : colors.textSecondary,
                                  }}
                                >
                                  {pn}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <TouchableOpacity onPress={() => handleRemovePhase(idx, pIdx)}>
                          <Trash2 size={14} color={brand.danger} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.dynamicRow}>
                        <Input
                          label="Mulai"
                          placeholder="2026-11-25"
                          value={p.start_date}
                          onChangeText={(txt) => updatePhaseField(idx, pIdx, 'start_date', txt)}
                          containerStyle={{ flex: 1, marginBottom: 0 }}
                        />
                        <Input
                          label="Akhir"
                          placeholder="2026-12-05"
                          value={p.end_date}
                          onChangeText={(txt) => updatePhaseField(idx, pIdx, 'end_date', txt)}
                          containerStyle={{ flex: 1, marginBottom: 0 }}
                        />
                      </View>

                      <Input
                        label="Diskon (%)"
                        placeholder="15"
                        value={p.discount_percent}
                        onChangeText={(txt) => updatePhaseField(idx, pIdx, 'discount_percent', txt)}
                        keyboardType="number-pad"
                        containerStyle={{ marginBottom: 0 }}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* Initial Status & Optional Media */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[Typography.h3, styles.cardTitle, { color: colors.text }]}>
              Status Publikasi &amp; Media (Opsional)
            </Text>

            <Text style={[Typography.caption, styles.inputLabel, { color: colors.textSecondary }]}>
              Status Awal Event
            </Text>
            <View style={styles.typeRow}>
              {INITIAL_STATUS_OPTIONS.map((st) => {
                const active = initialStatus === st;
                return (
                  <TouchableOpacity
                    key={st}
                    onPress={() => setInitialStatus(st)}
                    style={[
                      styles.statusInitBtn,
                      {
                        backgroundColor: active ? brand.primarySoft : colors.surfaceElevated,
                        borderColor: active ? brand.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        Typography.caption,
                        {
                          fontWeight: '700',
                          textTransform: 'capitalize',
                          color: active ? brand.primary : colors.textSecondary,
                        },
                      ]}
                    >
                      {st}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.mediaRow}>
              <View style={{ flex: 1, gap: 8 }}>
                {posterUri && <Image source={{ uri: posterUri }} style={styles.mediaPreview} resizeMode="contain" />}
                <Button
                  title={posterUri ? 'Ganti Poster' : 'Pilih Poster'}
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
              <View style={{ flex: 1, gap: 8 }}>
                {bannerUri && <Image source={{ uri: bannerUri }} style={styles.mediaPreview} resizeMode="cover" />}
                <Button
                  title={bannerUri ? 'Ganti Banner' : 'Pilih Banner'}
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
          </View>

          <Button
            title={createdEventId ? 'Lihat Detail Event' : 'Simpan & Buat Event'}
            onPress={handleSubmit}
            loading={submitting}
            variant="gradient"
            size="lg"
            style={{ marginTop: 8 }}
          />
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
  errorText: {
    fontWeight: '700',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  cardTitle: {
    marginBottom: 12,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  typeBtnText: {
    fontWeight: '800',
  },
  inputLabel: {
    fontWeight: '700',
    marginBottom: 8,
  },
  agencyScroll: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  agencyChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  subTitle: {
    fontWeight: '700',
  },
  addMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addMiniText: {
    fontWeight: '700',
  },
  dynamicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  ttBox: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  ttHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ttNumber: {
    fontWeight: '800',
  },
  phaseSection: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  phaseBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  phaseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  phaseChoiceRow: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  phaseNameChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusInitBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  mediaPreview: {
    width: '100%',
    height: 80,
    borderRadius: 12,
    backgroundColor: '#0F172A',
  },
});
