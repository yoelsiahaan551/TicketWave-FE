import React, { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowRight,
  CalendarDays,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  Sparkles,
  User,
} from 'lucide-react-native';

import { useAppTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { createCheckout } from '../src/api/endpoints';
import { PaymentMethodId } from '../src/types';
import { saveBookingEntry } from '../src/utils/storage';
import { formatEventSchedule, formatRupiah } from '../src/utils/formatters';
import {
  getMobilePaymentReturnUrl,
  getOfficialPaymentUrl,
  openMidtransPaymentBrowser,
} from '../src/utils/payment';
import { Header } from '../src/components/common/Header';
import { Input } from '../src/components/common/Input';
import { Button } from '../src/components/common/Button';
import { PaymentMethodSelector } from '../src/components/checkout/PaymentMethodSelector';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidPhoneNumber(rawPhone: string): boolean {
  const digits = rawPhone.trim().replace(/[\s-]/g, '').replace(/^\+/, '');
  return /^\d{10,15}$/.test(digits);
}

export default function CheckoutScreen() {
  const { payload } = useLocalSearchParams<{ payload?: string }>();
  const router = useRouter();
  const { colors, brand, isDark } = useAppTheme();
  const { user, isAuthenticated, isOfficer, logout } = useAuth();

  const checkoutData = useMemo(() => {
    try {
      return payload ? JSON.parse(payload) : null;
    } catch {
      return null;
    }
  }, [payload]);

  const [buyerNameInput, setBuyerNameInput] = useState<string | null>(null);
  const [buyerEmailInput, setBuyerEmailInput] = useState<string | null>(null);
  const [buyerPhoneInput, setBuyerPhoneInput] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethodId | null>(null);

  const buyerName = buyerNameInput ?? (!isOfficer && user?.name ? user.name : '');
  const buyerEmail = buyerEmailInput ?? (!isOfficer && user?.email ? user.email : '');
  const buyerPhone = buyerPhoneInput ?? (!isOfficer && user?.phone ? user.phone : '');

  const setBuyerName = setBuyerNameInput;
  const setBuyerEmail = setBuyerEmailInput;
  const setBuyerPhone = setBuyerPhoneInput;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBookingCode, setCreatedBookingCode] = useState<string | null>(null);
  const submitLockRef = useRef(false);
  const createdBookingRef = useRef<{ bookingCode: string; paymentUrl: string | null } | null>(null);

  if (isAuthenticated && isOfficer) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showBack title="Checkout Tiket" />
        <View style={styles.emptyWrap}>
          <View style={[styles.roleIconWrap, { backgroundColor: brand.warningSoft }]}>
            <ShieldAlert size={28} color={brand.warning} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12 }]}>
            Sesi Role Tidak Sesuai
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Checkout tiket hanya tersedia untuk pembeli (User/Guest). Sesi aktif Anda saat ini adalah Officer ({user?.email}).
          </Text>
          <Button
            title="Keluar & Masuk Akun Pembeli"
            onPress={async () => {
              await logout();
              router.replace('/login' as any);
            }}
            variant="primary"
            style={{ marginTop: 16, width: '100%', maxWidth: 320 }}
          />
          <Button
            title="Kembali ke Portal Petugas"
            onPress={() => router.replace('/officer' as any)}
            variant="outline"
            style={{ marginTop: 10, width: '100%', maxWidth: 320 }}
          />
        </View>
      </View>
    );
  }

  if (!checkoutData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showBack title="Checkout Tiket" />
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Data Checkout Tidak Ditemukan
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Silakan pilih event dan kategori tiket terlebih dahulu.
          </Text>
          <Button
            title="Cari Event"
            onPress={() => router.replace('/(tabs)/events')}
            style={{ marginTop: 14 }}
          />
        </View>
      </View>
    );
  }

  const totalAmount =
    Number(checkoutData.unitPrice || 0) * Number(checkoutData.quantity || 1);

  const hasValidTicket =
    Number(checkoutData.eventId) > 0 &&
    Number(checkoutData.ticketTypeId) > 0 &&
    Number(checkoutData.quantity) > 0;

  const isCheckoutReady =
    buyerName.trim().length >= 2 &&
    EMAIL_REGEX.test(buyerEmail.trim()) &&
    isValidPhoneNumber(buyerPhone) &&
    (!recipientEmail.trim() || EMAIL_REGEX.test(recipientEmail.trim())) &&
    hasValidTicket &&
    selectedPaymentMethod !== null &&
    !submitting;

  const handleConfirm = async () => {
    // If a booking was already created for this checkout screen, NEVER create a duplicate booking.
    if (createdBookingRef.current) {
      router.replace({
        pathname: '/order/[id]',
        params: { id: createdBookingRef.current.bookingCode },
      } as any);
      return;
    }
    if (submitLockRef.current || submitting) {
      return;
    }
    setError(null);

    if (!hasValidTicket) {
      setError('Tiket belum dipilih. Silakan pilih kategori tiket terlebih dahulu.');
      return;
    }
    if (!buyerName.trim() || buyerName.trim().length < 2) {
      setError('Nama lengkap pembeli wajib diisi (minimal 2 karakter).');
      return;
    }
    if (!buyerEmail.trim() || !EMAIL_REGEX.test(buyerEmail.trim())) {
      setError('Format email pembeli tidak valid.');
      return;
    }
    if (!isValidPhoneNumber(buyerPhone)) {
      setError('Nomor telepon wajib diisi minimal 10 digit angka yang valid.');
      return;
    }
    if (recipientEmail.trim() && !EMAIL_REGEX.test(recipientEmail.trim())) {
      setError('Format email penerima tiket tidak valid.');
      return;
    }
    if (!selectedPaymentMethod) {
      setError('Pilih salah satu metode pembayaran sebelum melanjutkan.');
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);

    try {
      const paymentReturnUrl = getMobilePaymentReturnUrl();
      const res = await createCheckout({
        event_id: Number(checkoutData.eventId),
        ticket_type_id: Number(checkoutData.ticketTypeId),
        quantity: Number(checkoutData.quantity),
        buyer_name: buyerName.trim(),
        buyer_email: buyerEmail.trim(),
        buyer_phone: buyerPhone.trim(),
        ...(recipientEmail.trim()
          ? { recipient_email: recipientEmail.trim() }
          : {}),
        payment_method: selectedPaymentMethod,
        ...(paymentReturnUrl ? { return_url: paymentReturnUrl } : {}),
      });

      if (res.success && res.data?.booking) {
        const booking = res.data.booking;
        const rawPayUrl = res.data.payment_url || booking.payment_url || null;
        const officialPaymentUrl = getOfficialPaymentUrl({
          status: booking.status,
          payment_url: rawPayUrl,
          booking_code: booking.booking_code,
        });

        createdBookingRef.current = {
          bookingCode: booking.booking_code,
          paymentUrl: officialPaymentUrl,
        };
        setCreatedBookingCode(booking.booking_code);

        await saveBookingEntry({
          booking_code: booking.booking_code,
          guest_token: res.data.guest_access_token || null,
          recipient_email: recipientEmail.trim() || buyerEmail.trim(),
          event_name: checkoutData.eventName,
        });

        if (officialPaymentUrl) {
          const browserResult = await openMidtransPaymentBrowser(
            officialPaymentUrl,
            paymentReturnUrl
          );
          router.replace({
            pathname: '/order/[id]',
            params: {
              id: booking.booking_code,
              fromPayment: browserResult.status,
            },
          } as any);
        } else {
          router.replace({
            pathname: '/order/[id]',
            params: {
              id: booking.booking_code,
              fromPayment: 'invalid_url',
            },
          } as any);
        }
      } else {
        setError(res.message || 'Gagal memproses pemesanan tiket.');
      }
    } catch (err: any) {
      setError(
        err?.status === 500
          ? `Terjadi kesalahan internal pada server (HTTP 500): ${err?.message}`
          : err?.message || 'Gagal memproses checkout. Silakan coba kembali.'
      );
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showBack title="Checkout Tiket" subtitle="Langkah 1 dari 2: Data Pemesan" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Step Badge */}
          <View style={styles.stepBadgeRow}>
            <View style={[styles.stepBadge, { backgroundColor: isDark ? 'rgba(0,128,242,0.18)' : '#EFF6FF', borderColor: brand.primary }]}>
              <Sparkles size={13} color={brand.primary} />
              <Text style={[styles.stepBadgeText, { color: brand.primary }]}>
                Garansi Kuota 15 Menit Aktif
              </Text>
            </View>
          </View>

          {/* Event Summary Card */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardEyebrow, { color: brand.primary }]}>RINGKASAN TIKET</Text>
            <Text style={[styles.eventTitle, { color: colors.text }]}>{checkoutData.eventName}</Text>

            <View style={styles.eventMetaRow}>
              <View style={styles.metaItem}>
                <CalendarDays size={13} color={brand.primary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {formatEventSchedule(
                    {
                      event_type: checkoutData.eventType,
                      event_date: checkoutData.eventDate,
                      days_count: checkoutData.daysCount,
                    },
                    { short: true, includeTime: false }
                  )}
                </Text>
              </View>
              {checkoutData.venue && (
                <View style={styles.metaItem}>
                  <MapPin size={13} color={brand.primary} />
                  <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {checkoutData.venue}
                  </Text>
                </View>
              )}
            </View>

            <View style={[styles.tierRow, { backgroundColor: colors.surfaceElevated }]}>
              <View>
                <Text style={[styles.tierName, { color: colors.text }]}>
                  {checkoutData.ticketName}
                </Text>
                <Text style={[styles.tierUnitPrice, { color: colors.textMuted }]}>
                  {formatRupiah(checkoutData.unitPrice)} × {checkoutData.quantity} tiket
                </Text>
              </View>

              <Text style={[styles.tierSubtotal, { color: brand.primary }]}>
                {formatRupiah(totalAmount)}
              </Text>
            </View>
          </View>

          {/* Buyer Information Form */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardEyebrow, { color: brand.primary }]}>DATA PEMESAN</Text>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Informasi Pembeli</Text>
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
              E-ticket dan konfirmasi pesanan akan dikirimkan ke kontak ini.
            </Text>

            <Input
              label="Nama Lengkap *"
              placeholder="Contoh: John Doe"
              value={buyerName}
              onChangeText={setBuyerName}
              leftIcon={<User size={16} color={brand.primary} />}
            />

            <Input
              label="Alamat Email *"
              placeholder="contoh: john@example.com"
              value={buyerEmail}
              onChangeText={setBuyerEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon={<Mail size={16} color={brand.primary} />}
            />

            <Input
              label="Nomor WhatsApp / Telepon *"
              placeholder="081234567890"
              value={buyerPhone}
              onChangeText={setBuyerPhone}
              keyboardType="phone-pad"
              leftIcon={<Phone size={16} color={brand.primary} />}
            />

            <Input
              label="Email Penerima Tiket (Opsional)"
              placeholder="Kosongkan jika sama dengan email pembeli"
              value={recipientEmail}
              onChangeText={setRecipientEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon={<Mail size={16} color={colors.textMuted} />}
            />
          </View>

          {/* Payment Method Selector */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardEyebrow, { color: brand.primary }]}>METODE PEMBAYARAN</Text>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Pilih Metode Pembayaran</Text>
            <Text style={[styles.cardDesc, { color: colors.textSecondary, marginBottom: 4 }]}>
              Wajib pilih salah satu metode sebelum melanjutkan ke halaman pembayaran Midtrans.
            </Text>

            <PaymentMethodSelector
              selectedMethod={selectedPaymentMethod}
              onSelect={(method) => {
                setSelectedPaymentMethod(method);
                if (error) setError(null);
              }}
              disabled={submitting}
            />
          </View>

          {/* Price Breakdown / Summary Card */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardEyebrow, { color: brand.primary }]}>RINCIAN BIAYA</Text>
            {(() => {
              const qty = Number(checkoutData.quantity || 1);
              const unitFinal = Number(checkoutData.unitPrice || 0);
              const unitBase = Number(checkoutData.basePrice ?? unitFinal);
              const normalSubtotal = unitBase * qty;
              const phaseDiscount = Math.max(0, (unitBase - unitFinal) * qty);
              const discPct = checkoutData.discountPercent;
              return (
                <>
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
                      Harga Normal ({qty}x)
                    </Text>
                    <Text style={[styles.breakdownVal, { color: colors.text }]}>
                      {formatRupiah(normalSubtotal)}
                    </Text>
                  </View>

                  {phaseDiscount > 0 ? (
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, { color: '#10B981' }]}>
                        Diskon Fase{discPct != null ? ` (${discPct}%)` : ''}
                      </Text>
                      <Text style={[styles.breakdownVal, { color: '#10B981', fontWeight: '700' }]}>
                        -{formatRupiah(phaseDiscount)}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
                      Biaya Layanan / Admin
                    </Text>
                    <Text style={[styles.breakdownVal, { color: '#10B981', fontWeight: '800' }]}>
                      Bebas Biaya
                    </Text>
                  </View>
                </>
              );
            })()}

            <View style={[styles.totalDivider, { borderTopColor: colors.border }]}>
              <View style={styles.totalRow}>
                <View>
                  <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total Pembayaran</Text>
                  <Text style={[styles.totalAmount, { color: brand.primary }]}>
                    {formatRupiah(totalAmount)}
                  </Text>
                </View>
              </View>
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.18)' : '#FEE2E2', borderColor: '#EF4444' }]}>
                <Text style={{ color: brand.danger, fontSize: 12.5, fontWeight: '700' }}>{error}</Text>
              </View>
            ) : null}

            <Button
              title={
                createdBookingCode
                  ? `Buka Detail Pesanan (${createdBookingCode})`
                  : `Lanjut ke Pembayaran — ${formatRupiah(totalAmount)}`
              }
              loadingTitle="Memproses Pesanan…"
              onPress={handleConfirm}
              disabled={!createdBookingCode && !isCheckoutReady}
              variant="gradient"
              size="lg"
              loading={submitting}
              icon={<ArrowRight size={18} color="#FFFFFF" />}
              iconPosition="right"
              testID="checkout-submit-btn"
              style={{ marginTop: 16 }}
            />

            {!selectedPaymentMethod ? (
              <Text style={[styles.validationHint, { color: colors.textMuted }]}>
                Pilih metode pembayaran terlebih dahulu untuk mengaktifkan tombol pembayaran.
              </Text>
            ) : null}
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
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  roleIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeRow: {
    marginBottom: 12,
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  stepBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardEyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  eventMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    marginBottom: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
  },
  tierName: {
    fontSize: 14,
    fontWeight: '800',
  },
  tierUnitPrice: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 1,
  },
  tierSubtotal: {
    fontSize: 15,
    fontWeight: '900',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  cardDesc: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
    marginBottom: 14,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  breakdownLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  breakdownVal: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  totalDivider: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },
  validationHint: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 10,
  },
});
