import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  BarcodeScanningResult,
  CameraType,
  CameraView,
  scanFromURLAsync,
  useCameraPermissions,
} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import jsQR from 'jsqr';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Flashlight,
  History,
  RotateCcw,
  ScanLine,
  Search,
  ShieldAlert,
  ShieldCheck,
  SwitchCamera,
  Ticket,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react-native';

import { useAppTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { executeCheckIn, inspectTicketCodeAsync } from '../../src/api/endpoints';
import {
  formatTanggalSingkat,
  formatWibDateTime,
  formatWibTime,
  getOfficerStatusBadgeVariant,
} from '../../src/utils/formatters';
import { Header } from '../../src/components/common/Header';
import { Button } from '../../src/components/common/Button';
import { Badge } from '../../src/components/common/Badge';
import { Input } from '../../src/components/common/Input';
import { Typography } from '../../src/constants/Typography';

export default function OfficerScanScreen() {
  const router = useRouter();
  const { colors, brand } = useAppTheme();
  const { user } = useAuth();

  // Camera permissions hook from expo-camera
  const [permission, requestPermission] = useCameraPermissions();

  // Scanner state
  const [facing, setFacing] = useState<CameraType>('back');
  const [torchOn, setTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scannedLocked, setScannedLocked] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string>('');

  // Input & validation state
  const [inputCode, setInputCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [decodingFile, setDecodingFile] = useState(false);
  const [fileScanError, setFileScanError] = useState<string | null>(null);
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [inlineNotice, setInlineNotice] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  // Concurrency & debounce ref
  const lastScanTimestampRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const checkInLockRef = useRef<boolean>(false);

  // Perform validation on ticket code (MUST NOT uppercase qr_token; preserve exact case)
  const handleValidate = useCallback(
    async (targetCode?: string) => {
      const code = (targetCode ?? inputCode).trim();
      if (!code) {
        setInlineNotice({
          type: 'warning',
          text: 'Masukkan kode tiket atau token QR terlebih dahulu.',
        });
        return;
      }

      setValidating(true);
      setResult(null);
      setInlineNotice(null);

      try {
        const res = await inspectTicketCodeAsync(code);
        setResult(res);
        setRecentScans((prev) => [
          {
            code: res.ticket?.ticket_code || res.code || code,
            rawCode: code,
            status: res.status,
            time: formatWibTime(new Date()),
          },
          ...prev
            .filter((item) => item.rawCode !== code && item.code !== code)
            .slice(0, 4),
        ]);
      } catch (err: any) {
        setResult({
          success: false,
          status: 'GAGAL MEMERIKSA',
          code,
          server_verified: false,
          message: err?.message || 'Gagal menghubungi server backend.',
        });
      } finally {
        setValidating(false);
      }
    },
    [inputCode]
  );

  // Barcode scanned event from real camera
  const handleBarcodeScanned = useCallback(
    async (scanResult: BarcodeScanningResult) => {
      if (scannedLocked || isProcessingRef.current) return;

      const rawData = scanResult.data?.trim() || '';
      if (!rawData) return;

      const now = Date.now();
      // Debounce: prevent duplicate scan within 3 seconds for same code
      if (now - lastScanTimestampRef.current < 3000 && lastScannedCode === rawData) {
        return;
      }

      lastScanTimestampRef.current = now;
      isProcessingRef.current = true;
      setScannedLocked(true);
      setLastScannedCode(rawData);
      setInputCode(rawData);

      try {
        await handleValidate(rawData);
      } finally {
        isProcessingRef.current = false;
      }
    },
    [scannedLocked, lastScannedCode, handleValidate]
  );

  // Reset scanner to scan the next attendee
  const handleResetScanner = () => {
    setScannedLocked(false);
    setResult(null);
    setInputCode('');
    setInlineNotice(null);
    setFileScanError(null);
  };

  const decodeQrFromImageUri = useCallback(async (uri: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || typeof document === 'undefined') return null;
      return await new Promise<string | null>((resolve) => {
        const ImgCtor = (window as any).Image;
        if (!ImgCtor) {
          resolve(null);
          return;
        }
        const img = new ImgCtor();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const natW = img.naturalWidth || img.width || 0;
            const natH = img.naturalHeight || img.height || 0;
            if (!natW || !natH) {
              resolve(null);
              return;
            }
            const maxDim = 1600;
            const scale = Math.min(1, maxDim / Math.max(natW, natH));
            const width = Math.max(1, Math.round(natW * scale));
            const height = Math.max(1, Math.round(natH * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(null);
              return;
            }
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);
            const decoded = jsQR(imageData.data, width, height, {
              inversionAttempts: 'attemptBoth',
            });
            resolve(decoded?.data ? decoded.data.trim() : null);
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = uri;
      });
    }

    const scanned = await scanFromURLAsync(uri, ['qr']);
    const first = Array.isArray(scanned) ? scanned[0] : null;
    return typeof first?.data === 'string' && first.data.trim() ? first.data.trim() : null;
  }, []);

  const handleScanImageFile = async () => {
    if (decodingFile || validating) return;
    setFileScanError(null);

    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setFileScanError('Izin akses galeri diperlukan untuk memindai gambar QR.');
          return;
        }
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });

      if (picked.canceled || !picked.assets?.[0]?.uri) return;

      setDecodingFile(true);
      const decodedText = await decodeQrFromImageUri(picked.assets[0].uri);
      if (!decodedText) {
        setFileScanError(
          'QR tidak terbaca dari gambar tersebut. Pastikan gambar QR TicketWave utuh dan kontras jelas.'
        );
        return;
      }

      setInputCode(decodedText);
      await handleValidate(decodedText);
    } catch {
      setFileScanError(
        'QR tidak terbaca dari gambar tersebut. Pastikan gambar QR TicketWave utuh dan kontras jelas.'
      );
    } finally {
      setDecodingFile(false);
    }
  };

  const performCheckIn = async () => {
    if ((!result?.ticket && !result?.code) || checkInLockRef.current || submittingCheckIn) {
      return;
    }
    checkInLockRef.current = true;
    setSubmittingCheckIn(true);
    setInlineNotice(null);

    try {
      const ticketParam = result.ticket || result.code;
      const res = await executeCheckIn(ticketParam);
      if (res.success) {
        const nextTicket = {
          ...(result?.ticket || {}),
          ...(res.ticket || {}),
          status: 'used',
        };
        setResult((prev: any) => ({
          ...prev,
          success: true,
          status: 'CHECK-IN SELESAI',
          server_verified: true,
          message: res.message || 'Check-in berhasil dikonfirmasi oleh sistem.',
          ticket: nextTicket,
        }));
        setInlineNotice({
          type: 'success',
          text: 'Check-in tiket berhasil diverifikasi. Pengunjung diizinkan masuk.',
        });
        if (Platform.OS !== 'web') {
          Alert.alert(
            'Sukses Masuk Gate',
            'Check-in tiket berhasil diverifikasi. Pengunjung diizinkan masuk.'
          );
        }
      } else {
        setResult((prev: any) => ({
          ...prev,
          ...res,
        }));
        setInlineNotice({
          type: 'error',
          text: res.message || 'Check-in ditolak sistem.',
        });
        if (Platform.OS !== 'web') {
          Alert.alert('Check-In Ditolak', res.message || 'Gagal mengonfirmasi check-in.');
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Terjadi kesalahan sistem saat check-in.';
      setInlineNotice({ type: 'error', text: msg });
      if (Platform.OS !== 'web') {
        Alert.alert('Gagal Check-In', msg);
      }
    } finally {
      checkInLockRef.current = false;
      setSubmittingCheckIn(false);
    }
  };

  // Confirm and execute check-in with prompt (cross-platform web + native)
  const handleConfirmCheckInPrompt = () => {
    if ((!result?.ticket && !result?.code) || checkInLockRef.current || submittingCheckIn) {
      return;
    }
    const buyer = result.ticket?.buyer_name || result.ticket?.attendee_name || 'Pengunjung';
    const code = result.ticket?.ticket_code || result.code || inputCode;

    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        !window.confirm(
          `Konfirmasi Check-In Tiket\n\nIzinkan check-in untuk:\n• Kode: ${code}\n• Nama: ${buyer}\n\nTiket akan ditandai SUDAH DIGUNAKAN di database backend.`
        )
      ) {
        return;
      }
      performCheckIn();
      return;
    }

    Alert.alert(
      'Konfirmasi Check-In Tiket',
      `Izinkan check-in untuk:\n• Kode: ${code}\n• Nama: ${buyer}\n\nTiket akan ditandai SUDAH DIGUNAKAN di database backend.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Konfirmasi Masuk Gate',
          style: 'default',
          onPress: () => performCheckIn(),
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        showBack
        title="Scanner QR Tiket"
        subtitle="Verifikasi & check-in tiket event"
        rightAction={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              onPress={() => router.push('/officer/history' as any)}
              accessibilityLabel="Riwayat check-in"
              style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}
            >
              <History size={16} color={brand.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setTorchOn((v) => !v)}
              accessibilityLabel="Lampu senter kamera"
              style={[
                styles.iconBtn,
                { backgroundColor: torchOn ? brand.primary : colors.surfaceElevated },
              ]}
            >
              <Flashlight size={16} color={torchOn ? '#FFFFFF' : colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFacing((curr) => (curr === 'back' ? 'front' : 'back'))}
              accessibilityLabel="Ganti kamera"
              style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}
            >
              <SwitchCamera size={16} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSoundEnabled((v) => !v)}
              accessibilityLabel="Suara notifikasi"
              style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}
            >
              {soundEnabled ? (
                <Volume2 size={16} color={brand.primary} />
              ) : (
                <VolumeX size={16} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Real CameraView Box */}
        <View style={styles.cameraContainer}>
          {!permission ? (
            <View style={styles.permissionBox}>
              <Text style={{ color: '#FFFFFF', fontSize: 13 }}>Memeriksa izin kamera perangkat...</Text>
            </View>
          ) : !permission.granted ? (
            <View style={styles.permissionBox}>
              <ShieldAlert size={40} color={brand.warning} />
              <Text style={styles.permissionTitle}>Izin Kamera Diperlukan</Text>
              <Text style={styles.permissionDesc}>
                Untuk membaca QR code tiket secara otomatis, berikan izin akses kamera perangkat Anda.
              </Text>
              <Button
                title="Berikan Izin Kamera"
                onPress={requestPermission}
                size="md"
                variant="gradient"
                style={{ marginTop: 14 }}
                icon={<Camera size={16} color="#FFFFFF" />}
              />
              <Text style={styles.permissionSub}>
                Jika izin ditolak permanen, gunakan form input kode tiket manual di bawah.
              </Text>
            </View>
          ) : (
            <View style={styles.cameraWrap}>
              <CameraView
                facing={facing}
                enableTorch={torchOn}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
                onBarcodeScanned={scannedLocked ? undefined : handleBarcodeScanned}
                style={StyleSheet.absoluteFill}
              />

              {/* Viewfinder Overlay Frame */}
              <View style={styles.overlayMask}>
                <View style={styles.viewfinderInner}>
                  <View style={styles.cornerTL} />
                  <View style={styles.cornerTR} />
                  <View style={styles.cornerBL} />
                  <View style={styles.cornerBR} />

                  {!scannedLocked && <View style={styles.laserLine} />}

                  <View style={styles.viewfinderCenter}>
                    {scannedLocked ? (
                      <View style={styles.lockedBadge}>
                        <CheckCircle2 size={32} color="#10B981" />
                        <Text style={styles.lockedText}>QR Code Terdeteksi!</Text>
                      </View>
                    ) : (
                      <ScanLine size={36} color="rgba(255,255,255,0.7)" />
                    )}
                  </View>
                </View>

                {/* Bottom Bar Controls inside camera */}
                <View style={styles.cameraBottomBar}>
                  <Text style={styles.cameraMetaText}>
                    Gate: {user?.assigned_gate || 'Belum terverifikasi'} • Mode: Kamera Aktif
                  </Text>
                  {scannedLocked && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleResetScanner}
                      style={[styles.resetScanBtn, { backgroundColor: brand.primary }]}
                    >
                      <RotateCcw size={14} color="#FFFFFF" />
                      <Text style={styles.resetScanText}>Scan Tiket Berikutnya</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* QR Image Upload Fallback (Web & Native) */}
        <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[Typography.h4, styles.inputTitle, { color: colors.text }]}>
            Pindai Gambar QR dari Perangkat
          </Text>
          <Text style={[Typography.caption, styles.inputSub, { color: colors.textSecondary }]}>
            Unggah tangkapan layar atau foto QR e-ticket untuk validasi read-only sebelum check-in
          </Text>

          <Button
            title={decodingFile ? 'Membaca Gambar QR...' : 'Pilih & Pindai Gambar QR'}
            onPress={handleScanImageFile}
            loading={decodingFile}
            disabled={validating || decodingFile}
            variant="secondary"
            size="md"
            icon={<Upload size={16} color={colors.text} />}
          />

          {fileScanError ? (
            <View
              style={[
                styles.inlineNoticeBox,
                {
                  backgroundColor: brand.dangerSoft,
                  borderColor: brand.danger,
                  marginTop: 10,
                },
              ]}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: brand.danger }}>
                {fileScanError}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Manual Code Input Box (Fallback) */}
        <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[Typography.h4, styles.inputTitle, { color: colors.text }]}>
            Input Kode Tiket / Token QR Manual
          </Text>
          <Text style={[Typography.caption, styles.inputSub, { color: colors.textSecondary }]}>
            Masukkan kode tiket (TKT-...) atau tempel token QR persis tanpa mengubah huruf besar/kecil
          </Text>

          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <Input
                placeholder="Contoh: TKT-XXXXXXXX atau token QR"
                value={inputCode}
                onChangeText={(txt) => {
                  setInputCode(txt);
                  if (inlineNotice) setInlineNotice(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon={<Ticket size={18} color={brand.primary} />}
              />
            </View>
          </View>

          {inlineNotice && (
            <View
              style={[
                styles.inlineNoticeBox,
                {
                  backgroundColor:
                    inlineNotice.type === 'success'
                      ? brand.successSoft
                      : inlineNotice.type === 'warning'
                      ? brand.warningSoft
                      : brand.dangerSoft,
                  borderColor:
                    inlineNotice.type === 'success'
                      ? brand.success
                      : inlineNotice.type === 'warning'
                      ? brand.warning
                      : brand.danger,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color:
                    inlineNotice.type === 'success'
                      ? brand.success
                      : inlineNotice.type === 'warning'
                      ? brand.warning
                      : brand.danger,
                }}
              >
                {inlineNotice.text}
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Button
              title="Periksa Tiket"
              onPress={() => handleValidate()}
              loading={validating}
              size="md"
              style={{ flex: 1 }}
              icon={<Search size={16} color="#FFFFFF" />}
            />
            {inputCode.trim() ? (
              <Button
                title="Buka Validator"
                onPress={() =>
                  router.push({
                    pathname: '/officer/validation' as any,
                    params: { code: inputCode.trim() },
                  })
                }
                variant="outline"
                size="md"
              />
            ) : null}
          </View>
        </View>

        {/* Result Inspection Card */}
        {result && (
          <View
            style={[
              styles.resultCard,
              {
                backgroundColor: colors.surface,
                borderColor:
                  result.status === 'VALID'
                    ? brand.success
                    : result.status === 'CHECK-IN SELESAI'
                    ? brand.cyan
                    : result.status === 'SUDAH DIGUNAKAN'
                    ? brand.warning
                    : brand.danger,
              },
            ]}
          >
            <View style={styles.resultHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.resultCode, { color: colors.text }]}>
                  {result.ticket?.ticket_code || result.code || inputCode}
                </Text>
                <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  Hasil verifikasi backend
                </Text>
              </View>
              <Badge label={result.status} variant={getOfficerStatusBadgeVariant(result.status)} />
            </View>

            <View style={styles.serverPillRow}>
              {result.server_verified ? (
                <View style={[styles.serverPill, { backgroundColor: brand.successSoft }]}>
                  <ShieldCheck size={13} color={brand.success} />
                  <Text style={[styles.serverPillText, { color: brand.success }]}>
                    Diverifikasi Server Backend
                  </Text>
                </View>
              ) : (
                <View style={[styles.serverPill, { backgroundColor: brand.warningSoft }]}>
                  <AlertTriangle size={13} color={brand.warning} />
                  <Text style={[styles.serverPillText, { color: brand.warning }]}>
                    Belum Terkonfirmasi Server
                  </Text>
                </View>
              )}
            </View>

            {result.message ? (
              <Text style={[styles.resultMsg, { color: colors.textSecondary }]}>
                {result.message}
              </Text>
            ) : null}

            {(result.first_checked_in_at || result.first_checked_in_by) && (
              <View style={[styles.duplicateBox, { backgroundColor: brand.warningSoft, borderColor: brand.warning }]}>
                <Clock size={14} color={brand.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: brand.warning }}>
                    Riwayat Check-In Sebelumnya
                  </Text>
                  <Text style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 2 }}>
                    Waktu: {formatWibDateTime(result.first_checked_in_at)}
                    {result.first_checked_in_by ? ` • Petugas: ${result.first_checked_in_by}` : ''}
                  </Text>
                </View>
              </View>
            )}

            {result.ticket && (
              <View style={[styles.ticketDetails, { borderTopColor: colors.border }]}>
                <Text style={[styles.detailRow, { color: colors.text }]}>
                  Nama: <Text style={{ fontWeight: '700' }}>{result.ticket.buyer_name || result.ticket.attendee_name || 'Pembeli'}</Text>
                </Text>
                {result.ticket.booking_code && (
                  <Text style={[styles.detailRow, { color: colors.text }]}>
                    Booking: <Text style={{ fontWeight: '700' }}>{result.ticket.booking_code}</Text>
                  </Text>
                )}
                <Text style={[styles.detailRow, { color: colors.text }]}>
                  Event: <Text style={{ fontWeight: '700' }}>{result.ticket.event_name || '-'}</Text>
                </Text>
                <Text style={[styles.detailRow, { color: colors.text }]}>
                  Kategori: <Text style={{ fontWeight: '700' }}>{result.ticket.ticket_type_name || result.ticket.ticket_type || '-'}</Text>
                </Text>
                {result.ticket.event_date && (
                  <Text style={[styles.detailRow, { color: colors.text }]}>
                    Tanggal: <Text style={{ fontWeight: '700' }}>{formatTanggalSingkat(result.ticket.event_date)}</Text>
                  </Text>
                )}
                {result.ticket.venue && (
                  <Text style={[styles.detailRow, { color: colors.text }]}>
                    Venue: <Text style={{ fontWeight: '700' }}>{result.ticket.venue}</Text>
                  </Text>
                )}
                {result.ticket.checked_in_at && result.status === 'CHECK-IN SELESAI' && (
                  <Text style={[styles.detailRow, { color: brand.success }]}>
                    Waktu Check-In: <Text style={{ fontWeight: '700' }}>{formatWibDateTime(result.ticket.checked_in_at)}</Text>
                  </Text>
                )}
              </View>
            )}

            {/* Check-In CTA Button with Confirmation */}
            {result.status === 'VALID' && (
              <Button
                title="Konfirmasi Check-In Sekarang"
                onPress={handleConfirmCheckInPrompt}
                loading={submittingCheckIn}
                size="lg"
                variant="gradient"
                style={{ marginTop: 14 }}
                icon={<CheckCircle2 size={18} color="#FFFFFF" />}
              />
            )}

            {result.status === 'CHECK-IN SELESAI' && (
              <Button
                title="Scan Pengunjung Berikutnya"
                onPress={handleResetScanner}
                size="md"
                variant="outline"
                style={{ marginTop: 12 }}
                icon={<RotateCcw size={16} color={brand.primary} />}
              />
            )}
          </View>
        )}

        {/* Recent Scans in this session */}
        {recentScans.length > 0 && (
          <View style={[styles.recentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[Typography.h4, styles.recentTitle, { color: colors.text }]}>
              Kode Terakhir Diperiksa
            </Text>
            {recentScans.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.7}
                onPress={() => {
                  const target = item.rawCode || item.code;
                  setInputCode(target);
                  handleValidate(target);
                }}
                style={[
                  styles.recentItem,
                  idx < recentScans.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
              >
                <View>
                  <Text style={[styles.recentCode, { color: colors.text }]}>{item.code}</Text>
                  <Text style={[Typography.caption, { color: colors.textMuted }]}>{item.time}</Text>
                </View>
                <Badge label={item.status} variant={getOfficerStatusBadgeVariant(item.status)} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  cameraContainer: {
    height: 280,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cameraWrap: {
    flex: 1,
    position: 'relative',
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  permissionDesc: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  permissionSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  overlayMask: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinderInner: {
    width: 200,
    height: 200,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 28,
    height: 28,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#0080F2',
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#0080F2',
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 28,
    height: 28,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#0080F2',
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#0080F2',
  },
  laserLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: '50%',
    height: 2.5,
    backgroundColor: '#00D4FF',
    shadowColor: '#00D4FF',
    shadowRadius: 8,
    shadowOpacity: 0.9,
  },
  viewfinderCenter: {
    alignItems: 'center',
    gap: 8,
  },
  lockedBadge: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  lockedText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  cameraBottomBar: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cameraMetaText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },
  resetScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  resetScanText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  inputCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  inputTitle: {
    marginBottom: 2,
  },
  inputSub: {
    marginBottom: 12,
  },
  inputRow: {
    marginBottom: 4,
  },
  resultCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  resultCode: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  resultMsg: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  inlineNoticeBox: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  serverPillRow: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 4,
  },
  serverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  serverPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  duplicateBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  ticketDetails: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 4,
  },
  detailRow: {
    fontSize: 13,
  },
  recentCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  recentTitle: {
    marginBottom: 12,
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  recentCode: {
    fontSize: 13,
    fontWeight: '700',
  },
});
