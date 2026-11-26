import React, { useEffect, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Building2, Upload } from 'lucide-react-native';

import { useAppTheme } from '@/src/context/ThemeContext';
import {
  fetchAdminAgencyDetail,
  updateAdminAgency,
  uploadAgencyLogo,
} from '@/src/api/endpoints';
import {
  getMediaPickerErrorMessage,
  validateAdminMediaAsset,
} from '@/src/utils/mediaValidation';
import { Header } from '@/src/components/common/Header';
import { Input } from '@/src/components/common/Input';
import { Button } from '@/src/components/common/Button';
import { Skeleton } from '@/src/components/common/Skeleton';
import { Typography } from '@/src/constants/Typography';

export default function AdminEditAgencyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, brand } = useAppTheme();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [picName, setPicName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [newLogoUri, setNewLogoUri] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchAdminAgencyDetail(id)
      .then((res) => {
        const a = res.data;
        if (a) {
          setName(a.name || '');
          setPicName(a.pic_name || '');
          setEmail(a.email || '');
          setPhone(a.phone || '');
          setAddress(a.address || '');
          setLogoUrl(a.logo_url || null);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

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
        if (asset.uri) setNewLogoUri(asset.uri);
      }
    } catch (err) {
      setLogoError(getMediaPickerErrorMessage(err));
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setError(null);
    setWarning(null);
    setSubmitting(true);

    try {
      await updateAdminAgency(id, {
        name: name.trim(),
        pic_name: picName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim() || null,
      });

      if (newLogoUri) {
        try {
          const uploadRes = await uploadAgencyLogo(id, newLogoUri);
          if (uploadRes.data?.logo_url) setLogoUrl(uploadRes.data.logo_url);
          setNewLogoUri(null);
        } catch (uploadErr: any) {
          const warnMsg = `Data agency tersimpan, namun unggah logo gagal: ${uploadErr?.message || 'Gagal mengunggah media'}.`;
          setWarning(warnMsg);
          if (Platform.OS !== 'web') {
            Alert.alert('Data Tersimpan (Logo Gagal)', warnMsg);
          }
          return;
        }
      }

      if (Platform.OS === 'web') {
        router.back();
      } else {
        Alert.alert('Tersimpan', 'Data agency berhasil diperbarui.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memperbarui data agency.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showBack title="Edit Agency" />
        <View style={{ padding: 16, gap: 14 }}>
          <Skeleton width={60} height={60} borderRadius={18} />
          <Skeleton width="100%" height={52} borderRadius={16} />
          <Skeleton width="100%" height={52} borderRadius={16} />
          <Skeleton width="100%" height={52} borderRadius={16} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showBack title="Edit Agency" subtitle={`PUT /api/agencies/${id}`} />

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
            <Text style={[Typography.caption, styles.label, { color: colors.textSecondary }]}>Logo Agency</Text>
            <View style={styles.logoRow}>
              <View style={[styles.logoPreview, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                {newLogoUri || logoUrl ? (
                  <Image source={{ uri: newLogoUri || logoUrl! }} style={styles.logoImg} />
                ) : (
                  <Building2 size={28} color={brand.primary} />
                )}
              </View>
              <Button
                title="Ganti Logo"
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

            <Input label="Nama Agency" value={name} onChangeText={setName} />
            <Input label="Nama PIC" value={picName} onChangeText={setPicName} />
            <Input
              label="Email Agency"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Nomor Telepon"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Input
              label="Alamat Kantor"
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
            />

            <Button
              title="Simpan Perubahan"
              onPress={handleSave}
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
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
});
