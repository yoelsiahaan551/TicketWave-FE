import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  QrCode,
  RefreshCw,
  ShieldAlert,
  User,
  XCircle,
} from 'lucide-react-native';

import { useAppTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import {
  cancelBooking,
  fetchBookingDetail,
  syncBookingPaymentStatus,
} from '../../src/api/endpoints';
import {
  getGuestTokenForBooking,
  saveBookingEntry,
} from '../../src/utils/storage';
import { BookingDetailResponse, TicketItem } from '../../src/types';
import {
  formatEventSchedule,
  formatRupiah,
  formatWibDateTime,
  getStatusLabel,
  isTicketQrEligible,
  normalizeUtcIso,
} from '../../src/utils/formatters';
import {
  canUserSyncBookingPayment,
  getMobilePaymentReturnUrl,
  getPaymentMethodLabel,
  openMidtransPaymentBrowser,
  resolveOrderPaymentState,
  resolveTicketDisplayStatus,
} from '../../src/utils/payment';
import { Header } from '../../src/components/common/Header';
import { Badge } from '../../src/components/common/Badge';
import { Button } from '../../src/components/common/Button';
import { Input } from '../../src/components/common/Input';
import { QRCodeModal } from '../../src/components/ticket/QRCodeModal';
import { Skeleton } from '../../src/components/common/Skeleton';

type PaymentFeedbackState = {
  type: 'info' | 'success' | 'error';
  text: string;
} | null;

export default function OrderDetailScreen() {
  const { id, fromPayment } = useLocalSearchParams<{
    id: string;
    fromPayment?: string;
  }>();
  const router = useRouter();
  const { colors, brand, isDark } = useAppTheme();
  const { user, isAuthenticated, isOfficer, loading: authLoading, logout } = useAuth();

  const [detail, setDetail] = useState<BookingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationMode, setVerificationMode] = useState<
    null | 'login' | 'guest_email' | 'forbidden' | 'not_found'
  >(null);
  const [guestEmailInput, setGuestEmailInput] = useState('');
  const [verifyingGuest, setVerifyingGuest] = useState(false);
  const [guestVerifyError, setGuestVerifyError] = useState<string | null>(null);
  const [hasGuestToken, setHasGuestToken] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [paymentFeedback, setPaymentFeedback] =
    useState<PaymentFeedbackState>(null);
  const [copied, setCopied] = useState(false);
  const [selectedQR, setSelectedQR] = useState<TicketItem | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const syncLockRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  const initialFromPaymentFeedback: PaymentFeedbackState = useMemo(() => {
    if (detail?.booking?.status !== 'pending_payment') {
      return null;
    }
    if (
      fromPayment === 'opened' ||
      fromPayment === 'returned' ||
      fromPayment === 'dismissed' ||
      fromPayment === 'cancelled'
    ) {
      return {
        type: 'info',
        text: 'Anda kembali dari halaman pembayaran Midtrans. Jika sudah menyelesaikan transaksi, tekan "Periksa Status Pembayaran".',
      };
    }
    if (fromPayment === 'error') {
      return {
        type: 'error',
        text: 'Browser pembayaran tidak dapat dibuka otomatis. Gunakan tombol "Bayar Sekarang (Midtrans Sandbox)" di bawah.',
      };
    }
    if (fromPayment === 'invalid_url') {
      return {
        type: 'error',
        text: 'Tautan pembayaran resmi Midtrans Sandbox belum tersedia atau tidak valid.',
      };
    }
    return null;
  }, [detail?.booking?.status, fromPayment]);

  const activeFeedback = paymentFeedback ?? initialFromPaymentFeedback;

  const persistBookingFromResponse = useCallback(
    async (data: BookingDetailResponse, existingToken?: string | null) => {
      const booking = data.booking;
      const nextToken = data.guest_access_token || existingToken || null;
      if (nextToken) setHasGuestToken(true);
      await saveBookingEntry({
        booking_code: booking.booking_code,
        guest_token: nextToken,
        recipient_email: booking.recipient_email || booking.buyer_email,
        event_name: data.event?.name,
      });
    },
    []
  );

  // Strictly read-only GET detail refresh; never mutates payment status.
  const refreshOrder = useCallback(async (): Promise<BookingDetailResponse | null> => {
    if (!id) return null;
    try {
      const guestToken = await getGuestTokenForBooking(id);
      if (guestToken) setHasGuestToken(true);
      const res = await fetchBookingDetail(id, { guestToken, silent: true });
      if (res.success && res.data?.booking) {
        setDetail(res.data);
        setVerificationMode(null);
        setError(null);
        await persistBookingFromResponse(res.data, guestToken);
        return res.data;
      }
      return null;
    } catch (err: any) {
      const reqMode = err?.data?.errors?.requires_verification;
      if (err?.status === 404) {
        setVerificationMode('not_found');
      } else if (reqMode === 'login') {
        setVerificationMode('login');
      } else if (reqMode === 'guest_email') {
        setVerificationMode('guest_email');
      } else if (err?.status === 403) {
        setVerificationMode('forbidden');
      }
      setError(err?.message || 'Gagal memuat detail pesanan.');
      return null;
    } finally {
      setRefreshing(false);
    }
  }, [id, persistBookingFromResponse]);

  useEffect(() => {
    let ignore = false;
    if (!id || authLoading || (isAuthenticated && isOfficer)) return;

    (async () => {
      try {
        const guestToken = await getGuestTokenForBooking(id);
        if (!ignore && guestToken) setHasGuestToken(true);
        const res = await fetchBookingDetail(id, { guestToken, silent: true });
        if (!ignore && res.success && res.data?.booking) {
          setDetail(res.data);
          setVerificationMode(null);
          setError(null);
          await persistBookingFromResponse(res.data, guestToken);
        }
      } catch (err: any) {
        if (!ignore) {
          const reqMode = err?.data?.errors?.requires_verification;
          if (err?.status === 404) {
            setVerificationMode('not_found');
          } else if (reqMode === 'login') {
            setVerificationMode('login');
          } else if (reqMode === 'guest_email') {
            setVerificationMode('guest_email');
          } else if (err?.status === 403) {
            setVerificationMode('forbidden');
          }
          setError(err?.message || 'Gagal memuat detail pesanan.');
        }
      } finally {
        if (!ignore) {
          hasLoadedOnceRef.current = true;
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [id, authLoading, isAuthenticated, isOfficer, persistBookingFromResponse]);

  useEffect(() => {
    if (authLoading || !id || (isAuthenticated && isOfficer)) return;
    if (verificationMode === 'login') {
      router.replace({
        pathname: '/login',
        params: { next: `/order/${encodeURIComponent(String(id))}` },
      } as any);
    }
  }, [authLoading, id, isAuthenticated, isOfficer, router, verificationMode]);

  const handleGuestVerifySubmit = async () => {
    const email = guestEmailInput.trim();
    if (!email || !id) {
      setGuestVerifyError('Masukkan alamat email pembeli terlebih dahulu.');
      return;
    }
    setVerifyingGuest(true);
    setGuestVerifyError(null);
    try {
      const res = await fetchBookingDetail(id, { buyerEmail: email, silent: true });
      if (res.success && res.data?.booking) {
        setDetail(res.data);
        setVerificationMode(null);
        setError(null);
        await persistBookingFromResponse(res.data);
      } else {
        setGuestVerifyError(res.message || 'Verifikasi email gagal.');
      }
    } catch (err: any) {
      setGuestVerifyError(err?.message || 'Email pembeli tidak cocok dengan pesanan ini.');
    } finally {
      setVerifyingGuest(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnceRef.current || (isAuthenticated && isOfficer)) return;
      refreshOrder();
    }, [isAuthenticated, isOfficer, refreshOrder])
  );

  const activeBookingStatus = detail?.booking?.status;
  const activeBookingExpiredAt = detail?.booking?.expired_at;

  // Live 15-minute reservation countdown tick while booking is pending_payment
  useEffect(() => {
    if (activeBookingStatus !== 'pending_payment' || !activeBookingExpiredAt) {
      return;
    }
    const iso = normalizeUtcIso(activeBookingExpiredAt);
    const expiresMs = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(expiresMs)) {
      return;
    }

    const immediate = setTimeout(() => setNowMs(Date.now()), 0);
    const timerId = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      clearTimeout(immediate);
      clearInterval(timerId);
    };
  }, [activeBookingStatus, activeBookingExpiredAt]);

  const countdownText = useMemo(() => {
    if (activeBookingStatus !== 'pending_payment' || !activeBookingExpiredAt) {
      return null;
    }
    const iso = normalizeUtcIso(activeBookingExpiredAt);
    const expiresMs = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(expiresMs)) return null;
    const diffMs = expiresMs - nowMs;
    if (diffMs <= 0) {
      return 'Batas waktu terlewati — silakan periksa status pesanan';
    }
    const totalSec = Math.floor(diffMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [activeBookingStatus, activeBookingExpiredAt, nowMs]);

  // Read-only GET refresh when returning from Android Chrome Custom Tabs / external browser.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        (prevState === 'background' || prevState === 'inactive') &&
        nextState === 'active' &&
        detail?.booking?.status === 'pending_payment' &&
        !syncLockRef.current
      ) {
        refreshOrder();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [detail?.booking?.status, refreshOrder]);

  const onRefresh = () => {
    setRefreshing(true);
    refreshOrder();
  };

  const handleCopyCode = async () => {
    if (!detail?.booking?.booking_code) return;
    await Clipboard.setStringAsync(detail.booking.booking_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const performCancel = async () => {
    if (!detail?.booking?.booking_code) return;
    setCancelling(true);
    try {
      const guestToken = await getGuestTokenForBooking(detail.booking.booking_code);
      await cancelBooking(detail.booking.booking_code, guestToken);
      await refreshOrder();
      setPaymentFeedback({
        type: 'info',
        text: 'Pesanan telah dibatalkan dan kuota tiket dikembalikan ke sistem.',
      });
    } catch (err: any) {
      setPaymentFeedback({
        type: 'error',
        text: err?.message || 'Gagal membatalkan pesanan.',
      });
    } finally {
      setCancelling(false);
    }
  };

  const handleCancelOrder = () => {
    if (!detail?.booking?.booking_code || cancelling || syncing) return;
    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        !window.confirm(
          'Apakah Anda yakin ingin membatalkan pesanan ini? Stok tiket akan dikembalikan ke event.'
        )
      ) {
        return;
      }
      performCancel();
      return;
    }
    Alert.alert(
      'Batalkan Pesanan',
      'Apakah Anda yakin ingin membatalkan pesanan ini? Stok tiket akan dikembalikan ke event.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Batalkan',
          style: 'destructive',
          onPress: performCancel,
        },
      ]
    );
  };

  const handlePayNow = async () => {
    const orderState = resolveOrderPaymentState(
      detail?.booking,
      detail?.event,
      detail?.tickets,
      nowMs
    );
    const officialUrl = orderState.canPay ? orderState.paymentUrl : null;
    if (!officialUrl) {
      setPaymentFeedback({
        type: 'error',
        text: 'Tautan pembayaran resmi Midtrans Sandbox tidak valid atau pesanan sudah tidak menunggu pembayaran.',
      });
      return;
    }

    const result = await openMidtransPaymentBrowser(
      officialUrl,
      getMobilePaymentReturnUrl()
    );
    if (result.status === 'error') {
      setPaymentFeedback({
        type: 'error',
        text:
          result.message ||
          'Gagal membuka browser pembayaran Midtrans Sandbox.',
      });
    } else if (result.status === 'returned') {
      setPaymentFeedback({
        type: 'info',
        text: 'Anda kembali dari Midtrans. Tekan "Periksa Status Pembayaran" untuk memverifikasi status resmi dari server.',
      });
    } else {
      setPaymentFeedback({
        type: 'info',
        text: 'Halaman pembayaran Midtrans Sandbox dibuka. Setelah selesai membayar, tekan "Periksa Status Pembayaran".',
      });
    }

    // Re-fetch read-only GET detail cleanly; never assume closing browser means paid.
    await refreshOrder();
  };

  const handleSyncPaymentStatus = async () => {
    if (!detail?.booking?.booking_code || syncLockRef.current || syncing) {
      return;
    }

    syncLockRef.current = true;
    setSyncing(true);
    setPaymentFeedback(null);

    try {
      const guestToken = await getGuestTokenForBooking(detail.booking.booking_code);
      await syncBookingPaymentStatus(detail.booking.booking_code, guestToken);
      const updated = await refreshOrder();
      const nextStatus = updated?.booking?.status;

      if (nextStatus === 'paid' || nextStatus === 'lunas') {
        setPaymentFeedback({
          type: 'success',
          text: 'Pembayaran berhasil dikonfirmasi! E-ticket dan QR Gate Anda kini aktif.',
        });
      } else if (nextStatus === 'pending_payment') {
        setPaymentFeedback({
          type: 'info',
          text: 'Status pembayaran masih Menunggu Pembayaran di Midtrans. Selesaikan pembayaran terlebih dahulu lalu periksa kembali.',
        });
      } else if (nextStatus) {
        setPaymentFeedback({
          type: 'error',
          text: `Status pesanan diperbarui menjadi ${getStatusLabel(nextStatus)}.`,
        });
      }
    } catch (err: any) {
      const status = err?.status;
      if (status === 401) {
        setPaymentFeedback({
          type: 'error',
          text: 'Sesi login diperlukan atau telah berakhir. Silakan login kembali untuk memeriksa status pembayaran.',
        });
      } else if (status === 403) {
        setPaymentFeedback({
          type: 'info',
          text: 'Status akan diperbarui otomatis melalui sistem pembayaran.',
        });
      } else if (status === 502) {
        setPaymentFeedback({
          type: 'error',
          text: 'Gateway pembayaran Midtrans tidak merespons dengan benar (HTTP 502). Silakan coba beberapa saat lagi.',
        });
      } else if (status === 504) {
        setPaymentFeedback({
          type: 'error',
          text: 'Waktu pemeriksaan ke layanan pembayaran habis (HTTP 504). Silakan coba kembali.',
        });
      } else {
        setPaymentFeedback({
          type: 'error',
          text:
            err?.message ||
            'Gagal memeriksa status pembayaran. Silakan coba kembali.',
        });
      }
    } finally {
      syncLockRef.current = false;
      setSyncing(false);
    }
  };

  if (!authLoading && isAuthenticated && isOfficer) {
    return (
      <View style={[styles.centerWrap, { backgroundColor: colors.background }]}>
        <Header showBack title="Detail Pesanan" />
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: brand.warningSoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
          }}
        >
          <ShieldAlert size={28} color={brand.warning} />
        </View>
        <Text style={[styles.errorTitle, { color: colors.text, textAlign: 'center' }]}>
          Sesi Role Tidak Sesuai
        </Text>
        <Text style={[styles.errorDesc, { color: colors.textSecondary, textAlign: 'center', marginTop: 6 }]}>
          Halaman detail pesanan dan pembayaran hanya diperuntukkan bagi akun pemilik pesanan (User). Sesi aktif Anda saat ini adalah Officer ({user?.email}).
        </Text>
        <Button
          title="Masuk dengan Akun Pemilik Pesanan"
          onPress={async () => {
            await logout();
            router.replace({
              pathname: '/login',
              params: { next: id ? `/order/${encodeURIComponent(id)}` : '/(tabs)/orders' },
            } as any);
          }}
          variant="primary"
          size="md"
          style={{ marginTop: 16, width: '100%', maxWidth: 320 }}
        />
        <Button
          title="Kembali ke Portal Petugas"
          onPress={() => router.replace('/officer' as any)}
          variant="outline"
          size="md"
          style={{ marginTop: 10, width: '100%', maxWidth: 320 }}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showBack title="Detail Pesanan" />
        <View style={{ padding: 18, gap: 14 }}>
          <Skeleton width="100%" height={90} borderRadius={20} />
          <Skeleton width="100%" height={140} borderRadius={24} />
          <Skeleton width="100%" height={180} borderRadius={24} />
        </View>
      </View>
    );
  }

  if (verificationMode === 'guest_email') {
    return (
      <View style={[styles.centerWrap, { backgroundColor: colors.background }]}>
        <Header showBack title="Verifikasi Pesanan Guest" />
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: brand.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
          }}
        >
          <Mail size={26} color={brand.primary} />
        </View>
        <Text style={[styles.errorTitle, { color: colors.text, textAlign: 'center' }]}>
          Verifikasi Email Pembeli
        </Text>
        <Text style={[styles.errorDesc, { color: colors.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: 16 }]}>
          {error || 'Masukkan alamat email yang digunakan saat checkout untuk melihat detail pesanan guest ini.'}
        </Text>
        <View style={{ width: '100%', maxWidth: 360 }}>
          <Input
            label="Email Pembeli"
            placeholder="nama@email.com"
            value={guestEmailInput}
            onChangeText={(t) => {
              setGuestEmailInput(t);
              if (guestVerifyError) setGuestVerifyError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={<Mail size={16} color={colors.textMuted} />}
          />
          {guestVerifyError ? (
            <Text style={{ color: brand.danger, fontSize: 12.5, fontWeight: '600', marginBottom: 10 }}>
              {guestVerifyError}
            </Text>
          ) : null}
          <Button
            title="Verifikasi & Buka Pesanan"
            onPress={handleGuestVerifySubmit}
            loading={verifyingGuest}
            variant="primary"
            size="md"
          />
          <Button
            title="Kembali ke Pesanan Saya"
            onPress={() => router.replace('/(tabs)/orders')}
            variant="outline"
            size="md"
            style={{ marginTop: 10 }}
          />
        </View>
      </View>
    );
  }

  if (verificationMode === 'login' || (detail?.booking?.user_id != null && (!isAuthenticated || !user))) {
    return (
      <View style={[styles.centerWrap, { backgroundColor: colors.background }]}>
        <Header showBack title="Detail Pesanan" />
        <Text style={[styles.errorTitle, { color: colors.text, textAlign: 'center' }]}>
          Login Diperlukan
        </Text>
        <Text style={[styles.errorDesc, { color: colors.textSecondary, textAlign: 'center', marginTop: 6 }]}>
          Mengarahkan ke halaman login untuk memverifikasi pemilik pesanan...
        </Text>
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={[styles.centerWrap, { backgroundColor: colors.background }]}>
        <Header showBack title="Detail Pesanan" />
        <Text style={[styles.errorTitle, { color: brand.danger }]}>
          {verificationMode === 'forbidden' ? 'Akses Ditolak' : 'Pesanan Tidak Ditemukan'}
        </Text>
        <Text style={[styles.errorDesc, { color: colors.textSecondary }]}>
          {error || `Kode booking "${id}" tidak ditemukan pada sistem.`}
        </Text>
        <Button
          title="Kembali ke Pesanan Saya"
          onPress={() => router.replace('/(tabs)/orders')}
          variant="outline"
          size="md"
          style={{ marginTop: 14 }}
        />
      </View>
    );
  }

  const { booking, event, ticket_type, tickets } = detail;
  const orderState = resolveOrderPaymentState(booking, event, tickets, nowMs);
  const isPending = orderState.code === 'pending_payment';
  const isPaid = orderState.code === 'paid';
  const isCancelled = orderState.code === 'cancelled';
  const isEventEnded = orderState.code === 'event_ended';
  const isExpired = orderState.code === 'expired';
  const isSalesClosed = orderState.code === 'sales_closed';
  const isDeniedOrFailed = orderState.code === 'denied';
  const isRefunded = orderState.code === 'refunded';
  const officialPaymentUrl = orderState.canPay ? orderState.paymentUrl : null;
  const canSyncPayment =
    orderState.canSyncPayment &&
    canUserSyncBookingPayment(booking, user, isAuthenticated, hasGuestToken);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        showBack
        title="Detail Pesanan"
        subtitle={booking.booking_code}
        rightAction={
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onRefresh}
            accessibilityRole="button"
            accessibilityLabel="Muat ulang detail pesanan"
            style={[styles.refreshBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          >
            <RefreshCw size={17} color={colors.text} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={brand.primary}
          />
        }
      >
        {/* Status Notification Banner */}
        {isPending && (
          <View style={[styles.statusBanner, { backgroundColor: isDark ? 'rgba(245,158,11,0.18)' : '#FEF3C7', borderColor: '#F59E0B' }]}>
            <Clock size={20} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusBannerTitle, { color: isDark ? '#FBBF24' : '#92400E' }]}>
                Menunggu Pembayaran{countdownText ? ` • ${countdownText}` : ''}
              </Text>
              <Text style={[styles.statusBannerDesc, { color: isDark ? '#FDE68A' : '#78350F' }]}>
                Harap selesaikan pembayaran melalui Midtrans Sandbox sebelum batas waktu berakhir agar reservasi tiket Anda tidak hangus.
              </Text>
            </View>
          </View>
        )}

        {isPaid && (
          <View style={[styles.statusBanner, { backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : '#DCFCE7', borderColor: '#10B981' }]}>
            <CheckCircle2 size={20} color="#059669" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusBannerTitle, { color: isDark ? '#34D399' : '#065F46' }]}>
                Pembayaran Berhasil!
              </Text>
              <Text style={[styles.statusBannerDesc, { color: isDark ? '#A7F3D0' : '#047857' }]}>
                Tiket resmi Anda telah diterbitkan. Tunjukkan kode QR pada gate venue acara.
              </Text>
            </View>
          </View>
        )}

        {isCancelled && (
          <View style={[styles.statusBanner, { backgroundColor: isDark ? 'rgba(239,68,68,0.18)' : '#FEE2E2', borderColor: '#EF4444' }]}>
            <XCircle size={20} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusBannerTitle, { color: isDark ? '#F87171' : '#991B1B' }]}>
                Pesanan Dibatalkan
              </Text>
              <Text style={[styles.statusBannerDesc, { color: isDark ? '#FECACA' : '#7F1D1D' }]}>
                Pesanan ini telah dibatalkan dan kuota tiket telah dikembalikan ke sistem.
              </Text>
            </View>
          </View>
        )}

        {isEventEnded && (
          <View style={[styles.statusBanner, { backgroundColor: isDark ? 'rgba(148,163,184,0.16)' : '#F1F5F9', borderColor: colors.borderStrong }]}>
            <Clock size={20} color={colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusBannerTitle, { color: colors.text }]}>
                Acara Selesai
              </Text>
              <Text style={[styles.statusBannerDesc, { color: colors.textSecondary }]}>
                Pesanan ini belum dibayar dan acara telah berakhir.
              </Text>
            </View>
          </View>
        )}

        {isExpired && (
          <View style={[styles.statusBanner, { backgroundColor: isDark ? 'rgba(148,163,184,0.16)' : '#F1F5F9', borderColor: colors.borderStrong }]}>
            <Clock size={20} color={colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusBannerTitle, { color: colors.text }]}>
                Pembayaran Kedaluwarsa
              </Text>
              <Text style={[styles.statusBannerDesc, { color: colors.textSecondary }]}>
                Batas waktu pembayaran telah habis.
              </Text>
            </View>
          </View>
        )}

        {isSalesClosed && (
          <View style={[styles.statusBanner, { backgroundColor: isDark ? 'rgba(148,163,184,0.16)' : '#F1F5F9', borderColor: colors.borderStrong }]}>
            <AlertCircle size={20} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusBannerTitle, { color: colors.text }]}>
                Penjualan Ditutup
              </Text>
              <Text style={[styles.statusBannerDesc, { color: colors.textSecondary }]}>
                Penjualan tiket untuk acara ini sedang tidak tersedia.
              </Text>
            </View>
          </View>
        )}

        {isDeniedOrFailed && (
          <View style={[styles.statusBanner, { backgroundColor: isDark ? 'rgba(239,68,68,0.18)' : '#FEE2E2', borderColor: '#EF4444' }]}>
            <XCircle size={20} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusBannerTitle, { color: isDark ? '#F87171' : '#991B1B' }]}>
                Pembayaran {getStatusLabel(booking.status)}
              </Text>
              <Text style={[styles.statusBannerDesc, { color: isDark ? '#FECACA' : '#7F1D1D' }]}>
                Transaksi tidak dapat diselesaikan oleh penyedia pembayaran. Silakan buat pesanan baru jika masih membutuhkan tiket.
              </Text>
            </View>
          </View>
        )}

        {isRefunded && (
          <View style={[styles.statusBanner, { backgroundColor: isDark ? 'rgba(148,163,184,0.16)' : '#F1F5F9', borderColor: colors.borderStrong }]}>
            <AlertCircle size={20} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusBannerTitle, { color: colors.text }]}>
                Pembayaran Dikembalikan (Refunded)
              </Text>
              <Text style={[styles.statusBannerDesc, { color: colors.textSecondary }]}>
                Dana untuk pesanan ini telah dikembalikan dan tiket tidak lagi berlaku untuk check-in.
              </Text>
            </View>
          </View>
        )}

        {activeFeedback && (
          <View
            style={[
              styles.feedbackBanner,
              {
                backgroundColor:
                  activeFeedback.type === 'success'
                    ? isDark
                      ? 'rgba(16,185,129,0.16)'
                      : '#ECFDF5'
                    : activeFeedback.type === 'error'
                    ? isDark
                      ? 'rgba(239,68,68,0.16)'
                      : '#FEF2F2'
                    : isDark
                    ? 'rgba(6,182,212,0.14)'
                    : '#ECFEFF',
                borderColor:
                  activeFeedback.type === 'success'
                    ? '#10B981'
                    : activeFeedback.type === 'error'
                    ? '#EF4444'
                    : brand.cyan,
              },
            ]}
          >
            <AlertCircle
              size={18}
              color={
                activeFeedback.type === 'success'
                  ? '#10B981'
                  : activeFeedback.type === 'error'
                  ? '#EF4444'
                  : brand.primary
              }
            />
            <Text style={[styles.feedbackText, { color: colors.text }]}>
              {activeFeedback.text}
            </Text>
          </View>
        )}

        {/* Booking Code Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.codeHeaderRow}>
            <Text style={[styles.cardEyebrow, { color: colors.textMuted, marginBottom: 0 }]}>
              KODE BOOKING PESANAN
            </Text>
            <Badge label={orderState.label} variant={orderState.variant} />
          </View>
          <View style={[styles.codeRow, { marginTop: 8 }]}>
            <Text style={[styles.codeText, { color: brand.primary }]}>
              {booking.booking_code}
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleCopyCode}
              accessibilityRole="button"
              style={[
                styles.copyBtn,
                { backgroundColor: copied ? '#10B981' : colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              {copied ? <Check size={14} color="#FFFFFF" /> : <Copy size={14} color={colors.text} />}
              <Text style={[styles.copyBtnText, { color: copied ? '#FFFFFF' : colors.text }]}>
                {copied ? 'Disalin' : 'Salin'}
              </Text>
            </TouchableOpacity>
          </View>

          {isPending && orderState.canPay && officialPaymentUrl ? (
            <Button
              title="Bayar Sekarang (Midtrans Sandbox)"
              onPress={handlePayNow}
              variant="gradient"
              icon={<CreditCard size={18} color="#FFFFFF" />}
              size="lg"
              testID="order-pay-now-btn"
              style={{ marginTop: 14 }}
            />
          ) : isPending ? (
            <View
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#F59E0B',
                backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : '#FFFBEB',
              }}
            >
              <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
                Tautan pembayaran resmi belum tersedia. Pembayaran belum dikonfirmasi; hubungi penyelenggara atau periksa kembali status.
              </Text>
            </View>
          ) : null}

          {isPending && canSyncPayment && (
            <Button
              title="Periksa Status Pembayaran"
              loadingTitle="Memeriksa Status…"
              onPress={handleSyncPaymentStatus}
              variant="outline"
              loading={syncing}
              disabled={syncing || cancelling}
              icon={<RefreshCw size={16} color={brand.primary} />}
              size="md"
              testID="order-sync-status-btn"
              style={{ borderColor: brand.primary, marginTop: 10 }}
              textStyle={{ color: brand.primary }}
            />
          )}

          {isPending && !canSyncPayment && (
            <Text style={[styles.syncHintText, { color: colors.textMuted }]}>
              Status pesanan akan diperbarui otomatis oleh sistem pembayaran. Login sebagai pemilik pesanan atau verifikasi email guest untuk memeriksa status Sandbox secara manual.
            </Text>
          )}

          {orderState.canCancel && (
            <Button
              title="Batalkan Pesanan"
              onPress={handleCancelOrder}
              variant="outline"
              loading={cancelling}
              disabled={syncing}
              style={{ borderColor: brand.danger, marginTop: 10 }}
              textStyle={{ color: brand.danger }}
            />
          )}
        </View>

        {/* Event Detail Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardEyebrow, { color: brand.primary }]}>EVENT TICKETWAVE</Text>
          <Text style={[styles.eventTitle, { color: colors.text }]}>
            {event?.name || 'Event TicketWave'}
          </Text>

          <View style={styles.metaCol}>
            <View style={styles.metaRow}>
              <CalendarDays size={14} color={brand.primary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {formatEventSchedule(event, { includeTime: true })}
              </Text>
            </View>

            {event?.venue && (
              <View style={styles.metaRow}>
                <MapPin size={14} color={brand.primary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {event.venue}, {event.city}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Buyer Info Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardEyebrow, { color: brand.primary }]}>DATA PEMESAN</Text>
          <View style={styles.buyerRow}>
            <User size={15} color={colors.textMuted} />
            <Text style={[styles.buyerVal, { color: colors.text }]}>{booking.buyer_name}</Text>
          </View>
          <View style={styles.buyerRow}>
            <Mail size={15} color={colors.textMuted} />
            <Text style={[styles.buyerVal, { color: colors.textSecondary }]}>{booking.buyer_email}</Text>
          </View>
          <View style={styles.buyerRow}>
            <Phone size={15} color={colors.textMuted} />
            <Text style={[styles.buyerVal, { color: colors.textSecondary }]}>{booking.buyer_phone}</Text>
          </View>
        </View>

        {/* Ticket Passes Preview */}
        {tickets && tickets.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardEyebrow, { color: brand.primary }]}>
              E-TICKET GATE PASS ({tickets.length} TIKET)
            </Text>

            <View style={{ gap: 10, marginTop: 10 }}>
              {tickets.map((t, idx) => {
                const effectiveStatus = resolveTicketDisplayStatus(booking, t, event, nowMs);
                const isPaidAndValid = isTicketQrEligible(
                  booking.status,
                  {
                    ...t,
                    status: effectiveStatus,
                    qr_token: t.qr_token,
                  },
                  event
                );
                const isCancelledTicket =
                  booking.status === 'cancelled' || effectiveStatus === 'cancelled';
                const statusColor = isPaidAndValid
                  ? '#10B981'
                  : isCancelledTicket
                  ? '#EF4444'
                  : colors.textMuted;

                return (
                  <View
                    key={t.id || idx}
                    style={[styles.ticketPassRow, { backgroundColor: colors.surfaceElevated }]}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.ticketPassCode, { color: colors.text }]}>
                        {t.ticket_code}
                      </Text>
                      <Text style={[styles.ticketPassStatus, { color: statusColor }]}>
                        Status: {getStatusLabel(effectiveStatus).toUpperCase()}
                      </Text>
                      {t.status === 'used' && t.checked_in_at ? (
                        <Text style={[styles.ticketPassStatus, { color: colors.textMuted, marginTop: 2 }]}>
                          Check-in: {formatWibDateTime(t.checked_in_at)}
                        </Text>
                      ) : null}
                      {booking.status === 'paid' && effectiveStatus === 'event_ended' ? (
                        <Text style={[styles.ticketPassStatus, { color: colors.textMuted, marginTop: 2 }]}>
                          Acara telah selesai. QR nonaktif, pembayaran tetap Dibayar.
                        </Text>
                      ) : null}
                    </View>

                    {isPaidAndValid ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() =>
                          setSelectedQR({
                            ...t,
                            status: effectiveStatus as any,
                            booking_code: booking.booking_code,
                            booking_status: booking.status,
                            buyer_name: booking.buyer_name,
                            event_name: event?.name,
                            event_type: event?.event_type,
                            days_count: event?.days_count,
                            event_date: event?.event_date,
                            event_time: event?.event_time,
                            event_end_time: event?.event_end_time,
                            is_event_ended: t.is_event_ended ?? event?.is_event_ended ?? booking.is_event_ended,
                            venue: event?.venue,
                            ticket_type_name: ticket_type?.name,
                          } as any)
                        }
                        style={[styles.qrPassBtn, { backgroundColor: brand.primary }]}
                      >
                        <QrCode size={16} color="#FFFFFF" />
                        <Text style={styles.qrPassBtnText}>QR Gate</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.qrPassBtnDisabled, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <QrCode size={16} color={colors.textMuted} />
                        <Text style={[styles.qrPassBtnDisabledText, { color: colors.textMuted }]}>
                          QR Nonaktif
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Payment Summary */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardEyebrow, { color: brand.primary }]}>RINCIAN PEMBAYARAN</Text>
          {booking.payment_method ? (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                Metode Pembayaran
              </Text>
              <Text style={[styles.summaryVal, { color: colors.text }]}>
                {getPaymentMethodLabel(booking.payment_method)}
              </Text>
            </View>
          ) : null}
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              {ticket_type?.name || 'Tiket'} ({booking.quantity} × {formatRupiah(booking.unit_price)})
            </Text>
            <Text style={[styles.summaryVal, { color: colors.text }]}>
              {formatRupiah(Number(booking.unit_price || 0) * Number(booking.quantity || 0))}
            </Text>
          </View>
          {Number(booking.discount_percent) > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: '#10B981' }]}>
                Diskon Fase Aktif ({booking.discount_percent}%)
              </Text>
              <Text style={[styles.summaryVal, { color: '#10B981' }]}>
                Termasuk dalam harga satuan
              </Text>
            </View>
          ) : null}

          <View style={[styles.summaryTotalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.summaryTotalLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.summaryTotalAmount, { color: brand.primary }]}>
              {formatRupiah(booking.total_price)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* QR Code Pass Modal */}
      <QRCodeModal
        visible={!!selectedQR}
        ticket={selectedQR}
        onClose={() => setSelectedQR(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  errorDesc: {
    fontSize: 13,
    textAlign: 'center',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  statusBannerDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  feedbackText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
  },
  codeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  syncHintText: {
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 10,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardEyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  metaCol: {
    marginTop: 10,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  buyerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  buyerVal: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  ticketPassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
  },
  ticketPassCode: {
    fontFamily: 'monospace',
    fontSize: 13.5,
    fontWeight: '800',
  },
  ticketPassStatus: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  qrPassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  qrPassBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  qrPassBtnDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  qrPassBtnDisabledText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  summaryVal: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
  },
  summaryTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  summaryTotalAmount: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
});
