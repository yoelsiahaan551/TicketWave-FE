import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Receipt, RefreshCw, Search } from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { useAppTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import {
  cancelBooking,
  fetchBookingDetail,
  fetchMyBookings,
} from '../../src/api/endpoints';
import {
  getGuestTokenForBooking,
  getSavedBookingEntries,
  saveBookingEntry,
} from '../../src/utils/storage';
import {
  getMobilePaymentReturnUrl,
  openMidtransPaymentBrowser,
  resolveOrderPaymentState,
} from '../../src/utils/payment';
import { BookingDetailResponse } from '../../src/types';
import { Header } from '../../src/components/common/Header';
import { Input } from '../../src/components/common/Input';
import { Button } from '../../src/components/common/Button';
import { OrderCard } from '../../src/components/order/OrderCard';
import { EmptyState } from '../../src/components/common/EmptyState';
import { OrderCardSkeleton } from '../../src/components/common/Skeleton';

const ORDER_FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: 'pending_payment', label: 'Menunggu Pembayaran' },
  { id: 'paid', label: 'Dibayar' },
  { id: 'event_ended', label: 'Acara Selesai' },
  { id: 'expired', label: 'Kedaluwarsa' },
  { id: 'cancelled', label: 'Dibatalkan' },
];

export default function OrdersScreen() {
  const router = useRouter();
  const { colors, brand } = useAppTheme();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const isAccountHistory = Boolean(isAuthenticated && user && user.role !== 'officer');

  const [bookings, setBookings] = useState<BookingDetailResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const [lookupCode, setLookupCode] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchOrders = useCallback(async () => {
    if (isAccountHistory) {
      const res = await fetchMyBookings();
      if (res.success && Array.isArray(res.data?.bookings)) {
        return res.data.bookings;
      }
      return [];
    }

    const entries = await getSavedBookingEntries();
    if (entries.length === 0) {
      return [];
    }

    const settled = await Promise.allSettled(
      entries.map(async (entry): Promise<BookingDetailResponse> => {
        const res = await fetchBookingDetail(entry.booking_code, {
          guestToken: entry.guest_token,
          silent: true,
        });
        if (res.success && res.data?.booking) {
          if (res.data.guest_access_token && res.data.guest_access_token !== entry.guest_token) {
            await saveBookingEntry({
              booking_code: entry.booking_code,
              guest_token: res.data.guest_access_token,
            });
          }
          return res.data;
        }
        throw new Error('Not found');
      })
    );

    return settled
      .filter((r): r is PromiseFulfilledResult<BookingDetailResponse> => r.status === 'fulfilled')
      .map((r) => r.value);
  }, [isAccountHistory]);

  useEffect(() => {
    if (authLoading) return;
    let ignore = false;
    fetchOrders()
      .then((items) => {
        if (!ignore) {
          setBookings(items);
        }
      })
      .catch(() => {
        if (!ignore) {
          setBookings([]);
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [authLoading, fetchOrders]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchOrders()
        .then((items) => {
          if (active) {
            setBookings(items);
          }
        })
        .catch(() => {
          // keep current visible list on transient error
        });
      return () => {
        active = false;
      };
    }, [fetchOrders])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders()
      .then((items) => {
        setBookings(items);
      })
      .catch(() => {
        setBookings([]);
      })
      .finally(() => {
        setRefreshing(false);
      });
  };

  const handleLookup = async () => {
    const code = lookupCode.trim().toUpperCase();
    const buyerEmail = lookupEmail.trim();
    if (!code) return;

    setLookupLoading(true);
    setLookupMessage(null);
    try {
      const guestToken = await getGuestTokenForBooking(code);
      const res = await fetchBookingDetail(code, {
        guestToken,
        buyerEmail: buyerEmail || null,
        silent: true,
      });
      if (res.success && res.data?.booking) {
        await saveBookingEntry({
          booking_code: res.data.booking.booking_code,
          guest_token: res.data.guest_access_token || guestToken || null,
          recipient_email: res.data.booking.recipient_email || res.data.booking.buyer_email,
          event_name: res.data.event?.name,
        });
        setLookupCode('');
        setLookupEmail('');
        setLookupMessage({
          type: 'success',
          text: `Pesanan ${res.data.booking.booking_code} berhasil ditemukan.`,
        });
        onRefresh();
      }
    } catch (err: any) {
      const reqMode = err?.data?.errors?.requires_verification;
      setLookupMessage({
        type: 'error',
        text:
          reqMode === 'guest_email'
            ? 'Masukkan Email Pembeli untuk memverifikasi pesanan guest ini.'
            : reqMode === 'login'
            ? 'Pesanan ini terdaftar atas akun pengguna. Silakan login terlebih dahulu.'
            : err?.message || `Kode booking "${code}" tidak ditemukan.`,
      });
    } finally {
      setLookupLoading(false);
    }
  };

  const performCancelOrder = async (bookingCode: string) => {
    setLookupMessage(null);
    try {
      const guestToken = await getGuestTokenForBooking(bookingCode);
      await cancelBooking(bookingCode, guestToken);
      setLookupMessage({
        type: 'success',
        text: `Pesanan ${bookingCode} berhasil dibatalkan.`,
      });
      onRefresh();
    } catch (err: any) {
      setLookupMessage({
        type: 'error',
        text: err?.message || `Gagal membatalkan pesanan ${bookingCode}.`,
      });
    }
  };

  const handleCancelOrder = (bookingCode: string) => {
    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        !window.confirm(
          `Yakin ingin membatalkan pesanan ${bookingCode}? Kuota tiket yang direservasi akan dikembalikan ke event.`
        )
      ) {
        return;
      }
      performCancelOrder(bookingCode);
      return;
    }
    Alert.alert(
      'Batalkan Pesanan',
      `Yakin ingin membatalkan pesanan ${bookingCode}? Kuota tiket yang direservasi akan dikembalikan ke event.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Batalkan',
          style: 'destructive',
          onPress: () => performCancelOrder(bookingCode),
        },
      ]
    );
  };

  const handlePay = async (url: string) => {
    const result = await openMidtransPaymentBrowser(url, getMobilePaymentReturnUrl());
    if (result.status === 'error' && result.message) {
      setLookupMessage({ type: 'error', text: result.message });
    }
    fetchOrders()
      .then((items) => setBookings(items))
      .catch(() => {});
  };

  const filteredBookings = bookings.filter((item) => {
    if (statusFilter === 'all') return true;
    const state = resolveOrderPaymentState(item.booking, item.event, item.tickets);
    return state.code === statusFilter;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Pesanan Saya"
        subtitle="Pantau & kelola status transaksi"
        rightAction={
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onRefresh}
            style={[styles.refreshBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          >
            <RefreshCw size={17} color={colors.text} />
          </TouchableOpacity>
        }
      />

      {/* Lookup Card */}
      <View style={[styles.lookupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.lookupTitle, { color: colors.text }]}>
          Lacak Kode Booking
        </Text>
        <View style={styles.lookupRow}>
          <Input
            placeholder="TKTW-YYYYMMDD-XXXXXX"
            value={lookupCode}
            onChangeText={setLookupCode}
            autoCapitalize="characters"
            leftIcon={<Search size={16} color={brand.primary} />}
            containerStyle={{ flex: 1, marginBottom: 0 }}
          />
          <Button
            title="Lacak"
            onPress={handleLookup}
            loading={lookupLoading}
            size="md"
            style={{ marginLeft: 8 }}
          />
        </View>
        {!isAccountHistory && (
          <Input
            placeholder="Email pembeli (opsional, untuk verifikasi guest)"
            value={lookupEmail}
            onChangeText={setLookupEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            containerStyle={{ marginTop: 8, marginBottom: 0 }}
          />
        )}
        {lookupMessage ? (
          <Text
            style={[
              styles.lookupFeedback,
              { color: lookupMessage.type === 'success' ? brand.success : brand.danger },
            ]}
          >
            {lookupMessage.text}
          </Text>
        ) : null}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {ORDER_FILTERS.map((f) => {
            const active = statusFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                activeOpacity={0.8}
                onPress={() => setStatusFilter(f.id)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: active ? brand.primary : colors.surfaceElevated,
                    borderColor: active ? brand.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: active ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Orders List / Skeleton */}
      {loading ? (
        <View style={styles.skeletonWrap}>
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => item.booking.booking_code}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={brand.primary}
              colors={[brand.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<Receipt size={32} color={brand.primary} />}
              title="Belum Ada Pesanan"
              description={
                statusFilter === 'all'
                  ? 'Belum ada transaksi tiket yang dibuat pada perangkat ini. Cari event favorit Anda dan pesan tiketnya sekarang.'
                  : `Tidak ada pesanan dengan status "${ORDER_FILTERS.find((f) => f.id === statusFilter)?.label}".`
              }
              actionLabel="Eksplor Event"
              onAction={() => router.push('/(tabs)/events')}
            />
          }
          renderItem={({ item }) => (
            <OrderCard
              item={item}
              onPayNow={handlePay}
              onCancel={handleCancelOrder}
            />
          )}
        />
      )}
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
  lookupCard: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  lookupTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  lookupRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lookupFeedback: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  filterWrap: {
    marginTop: 4,
    marginBottom: 8,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '800',
  },
  skeletonWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
  },
});
