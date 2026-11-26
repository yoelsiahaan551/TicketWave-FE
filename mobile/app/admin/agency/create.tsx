import React, { useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Building2, Upload } from 'lucide-react-native';

import { useAppTheme } from '@/src/context/ThemeContext';
import { createAdminAgency, uploadAgencyLogo } from '@/src/api/endpoints';
import {
  getMediaPickerErrorMessage,
  validateAdminMediaAsset,
} from '@/src/utils/mediaValidation';
import { Header } from '@/src/components/common/Header';
import { Input } from '@/src/components/common/Input';
import { Button } from '@/src/components/common/Button';
import { Typography } from '@/src/constants/Typography';

export default function AdminCreateAgencyScreen() {
  const router = useRouter();
  const { colors, brand } = useAppTheme();

  const [name, setName] = useState('');
  const [picName, setPicName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const createdAgencyIdRef = useRef<number | null>(null);

  const handlePickLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin Galeri', 'Aplikasi memerlukan izin untuk memilih foto logo.');
      return;
    }
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!res.canceled && res.assets?.[0]) {
        const asset = res.assets[0] as any;
        const check = validateAdminMediaAsset({
          fileName: asset.fileName ?? asset.file?.name,
          mimeType: asset.mimeType ?? asset.file?.type,
          fileSize: asset.fileSize ?? asset.file?.size,
          uri: asset.uri,
        });
        if (!check.valid) {
          setLogoError(check.error);
          return;
        }
        setLogoError(null);
        if (asset.uri) setLogoUri(asset.uri);
      }
    } catch (err) {
      setLogoError(getMediaPickerErrorMessage(err));
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setWarning(null);

    if (createdAgencyIdRef.current) {
      router.replace(`/admin/agency/${createdAgencyIdRef.current}` as any);
      return;
    }

    const cleanName = name.trim();
    const cleanPic = picName.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();

    if (cleanName.length < 2 || cleanName.length > 150) {
      setError('Nama agency wajib diisi (2–150 karakter).');
      return;
    }
    if (cleanPic.length < 2 || cleanPic.length > 120) {
      setError('Nama PIC wajib diisi (2–120 karakter).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Format email agency tidak valid.');
      return;
    }
    if (cleanPhone.length < 8 || cleanPhone.length > 20) {
      setError('Nomor telepon wajib diisi (8–20 karakter).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createAdminAgency({
        name: cleanName,
        pic_name: cleanPic,
        email: cleanEmail,
        phone: cleanPhone,
        address: address.trim() || undefined,
      });

      const agencyId = res.data?.id;
      if (agencyId) {
        createdAgencyIdRef.current = agencyId;
      }

      if (agencyId && logoUri) {
        try {
          await uploadAgencyLogo(agencyId, logoUri);
          setLogoUri(null);
        } catch (uploadErr: any) {
          const warnMsg = `Agency "${cleanName}" berhasil dibuat (#${agencyId}), namun unggah logo gagal: ${uploadErr?.message || 'Gagal mengunggah media'}.`;
          setWarning(warnMsg);
          if (Platform.OS !== 'web') {
            Alert.alert('Agency Dibuat (Logo Gagal)', warnMsg, [
              { text: 'Lihat Detail', onPress: () => router.replace(`/admin/agency/${agencyId}` as any) },
            ]);
          }
          return;
        }
      }

      if (Platform.OS === 'web') {
        router.replace((agencyId ? `/admin/agency/${agencyId}` : '/admin/agencies') as any);
      } else {
        Alert.alert('Sukses', `Agency "${cleanName}" berhasil ditambahkan!`, [
          {
            text: 'OK',
            onPress: () =>
              router.replace((agencyId ? `/admin/agency/${agencyId}` : '/admin/agencies') as any),
          },
        ]);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal menambahkan agency.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showBack title="Tambah Agency" subtitle="Daftarkan promotor event resmi" />

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
              <Button
                title="Buka Detail Agency"
                onPress={() => router.replace(`/admin/agency/${createdAgencyIdRef.current}` as any)}
                size="sm"
                variant="outline"
                style={{ marginTop: 10 }}
              />
            </View>
          )}

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Logo Picker */}
            <Text style={[Typography.caption, styles.label, { color: colors.textSecondary }]}>
              Logo Agency (Opsional)
            </Text>
            <View style={styles.logoRow}>
              <View style={[styles.logoPreview, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                {logoUri ? (
                  <Image source={{ uri: logoUri }} style={styles.logoImg} />
                ) : (
                  <Building2 size={28} color={brand.primary} />
                )}
              </View>
              <Button
                title={logoUri ? 'Ganti Logo' : 'Pilih Logo'}
                onPress={handlePickLogo}
                size="sm"
                variant="secondary"
                icon={<Upload size={14} color={colors.text} />}
              />
            </View>
            {logoError ? (
              <Text style={[Typography.caption, { color: brand.danger, marginBottom: 12, fontWeight: '600' }]}>
                {logoError}
              </Text>
            ) : null}

            <Input
              label="Nama Agency *"
              placeholder="Contoh: Ismaya Live"
              value={name}
              onChangeText={setName}
            />

            <Input
              label="Nama PIC / Penanggung Jawab *"
              placeholder="Nama penanggung jawab"
              value={picName}
              onChangeText={setPicName}
            />

            <Input
              label="Email Agency *"
              placeholder="agency@domain.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Input
              label="Nomor Telepon *"
              placeholder="081234567890"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Input
              label="Alamat Kantor (Opsional)"
              placeholder="Alamat lengkap promotor"
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
            />

            <Button
              title="Simpan Agency"
              onPress={handleSubmit}
              loading={submitting}
              variant="gradient"
              size="lg"
              style={{ marginTop: 10 }}
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
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  logoPreview: {
    width: 60,
    height: 60,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
});
