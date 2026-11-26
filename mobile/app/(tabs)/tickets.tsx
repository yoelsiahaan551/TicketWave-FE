import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RefreshCw, Search, Ticket } from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { useAppTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { fetchBookingDetail, fetchMyBookings } from '../../src/api/endpoints';
import {
  getGuestTokenForBooking,
  getSavedBookingEntries,
  saveBookingEntry,
} from '../../src/utils/storage';
import { resolveTicketDisplayStatus } from '../../src/utils/payment';
import { BookingDetailResponse, TicketItem } from '../../src/types';
import { Header } from '../../src/components/common/Header';
import { Input } from '../../src/components/common/Input';
import { Button } from '../../src/components/common/Button';
import { TicketCard } from '../../src/components/ticket/TicketCard';
import { QRCodeModal } from '../../src/components/ticket/QRCodeModal';
import { EmptyState } from '../../src/components/common/EmptyState';
import { OrderCardSkeleton } from '../../src/components/common/Skeleton';

const FILTERS = [
  { id: 'all', label: 'Semua Tiket' },
  { id: 'valid', label: 'Valid / Aktif' },
  { id: 'used', label: 'Sudah Digunakan' },
  { id: 'event_ended', label: 'Acara Selesai' },
  { id: 'cancelled', label: 'Pesanan Dibatalkan' },
];

export default function TicketsScreen() {
  const router = useRouter();
  const { colors, brand } = useAppTheme();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const isAccountHistory = Boolean(isAuthenticated && user && user.role !== 'officer');

  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const [lookupCode, setLookupCode] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchTickets = useCallback(async (): Promise<TicketItem[]> => {
    let detailList: BookingDetailResponse[] = [];

    if (isAccountHistory) {
      const res = await fetchMyBookings();
      detailList = res.success && Array.isArray(res.data?.bookings) ? res.data.bookings : [];
    } else {
      const entries = await getSavedBookingEntries();
      if (entries.length === 0) {
        return [];
      }

      const settled = await Promise.allSettled(
        entries.map(async (e) => {
          const res = await fetchBookingDetail(e.booking_code, {
            guestToken: e.guest_token,
            silent: true,
          });
          if (res.success && res.data?.booking) {
            if (res.data.guest_access_token && res.data.guest_access_token !== e.guest_token) {
              await saveBookingEntry({
                booking_code: e.booking_code,
                guest_token: res.data.guest_access_token,
              });
            }
            return res.data;
          }
          throw new Error('Not found');
        })
      );

      detailList = settled
        .filter((r): r is PromiseFulfilledResult<BookingDetailResponse> => r.status === 'fulfilled')
        .map((r) => r.value);
    }

    const aggregated: TicketItem[] = [];
    detailList.forEach(({ booking, event, ticket_type, tickets: tList }) => {
      (tList || []).forEach((t) => {
        aggregated.push({
          ...t,
          status: resolveTicketDisplayStatus(booking, t, event) as any,
          booking_code: booking.booking_code,
          booking_status: booking.status,
          buyer_name: booking.buyer_name,
          recipient_email: booking.recipient_email || booking.buyer_email,
          event_id: event?.id,
          event_name: event?.name || 'Event TicketWave',
          event_type: event?.event_type || null,
          days_count: event?.days_count ?? null,
          poster_url: event?.poster_url || event?.banner_url || null,
          artist_name:
            event?.artist_name ||
            (event?.event_type === 'festival'
              ? `Festival ${event?.days_count || 1} Hari`
              : 'Live Event'),
          venue: event?.venue
            ? `${event.venue}${event.city ? `, ${event.city}` : ''}`
            : event?.city || '-',
          event_date: event?.event_date,
          event_time: event?.event_time,
          event_end_time: event?.event_end_time,
          is_event_ended: t.is_event_ended ?? event?.is_event_ended ?? booking.is_event_ended,
          ticket_type_name: ticket_type?.name || 'Regular',
        });
      });
    });

    return aggregated;
  }, [isAccountHistory]);

  useEffect(() => {
    if (authLoading) return;
    let ignore = false;
    fetchTickets()
      .then((items) => {
        if (!ignore) {
          setTickets(items);
        }
      })
      .catch(() => {
        if (!ignore) {
          setTickets([]);
        }
      })
      .finally(() => {
        if (!ignore) {
          hasLoadedRef.current = true;
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [authLoading, fetchTickets]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) return;
      let active = true;
      fetchTickets()
        .then((items) => {
          if (active) setTickets(items);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [fetchTickets])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets()
      .then((items) => {
        setTickets(items);
      })
      .catch(() => {
        setTickets([]);
      })
      .finally(() => {
        setRefreshing(false);
      });
  };

  const handleImportBooking = async () => {
    const code = lookupCode.trim().toUpperCase();
    const buyerEmail = lookupEmail.trim();
    if (!code) return;
    setLookupLoading(true);
    setLookupError(null);

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
        onRefresh();
      }
    } catch (err: any) {
      const reqMode = err?.data?.errors?.requires_verification;
      setLookupError(
        reqMode === 'guest_email'
          ? 'Masukkan Email Pembeli untuk memverifikasi pesanan guest ini.'
          : reqMode === 'login'
          ? 'Pesanan ini terdaftar atas akun pengguna. Silakan login terlebih dahulu.'
          : err?.message || `Kode booking "${code}" tidak ditemukan.`
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'valid') return t.status === 'valid' || t.status === 'aktif';
    if (statusFilter === 'used') return t.status === 'used' || t.status === 'checked_in';
    if (statusFilter === 'cancelled') return t.status === 'cancelled' || t.status === 'dibatalkan';
    return t.status === statusFilter;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Tiket Saya"
        subtitle="E-Ticket & Pass Resmi Gate"
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
          Lacak Tiket dengan Kode Booking
        </Text>
        <View style={styles.lookupRow}>
          <Input
            placeholder="Contoh: TKTW-20261103-..."
            value={lookupCode}
            onChangeText={setLookupCode}
            autoCapitalize="characters"
            leftIcon={<Search size={16} color={brand.primary} />}
            containerStyle={{ flex: 1, marginBottom: 0 }}
          />
          <Button
            title="Cari"
            onPress={handleImportBooking}
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
        {lookupError ? (
          <Text style={[styles.errorText, { color: brand.danger }]}>{lookupError}</Text>
        ) : null}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTERS.map((f) => {
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

      {/* Tickets List */}
      {loading ? (
        <View style={styles.skeletonWrap}>
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => String(item.id || item.ticket_code)}
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
              icon={<Ticket size={32} color={brand.primary} />}
              title="Belum Ada Tiket"
              description={
                statusFilter === 'all'
                  ? 'Anda belum memiliki tiket aktif. Cari event menarik dan pesan tiket resmi Anda sekarang.'
                  : `Tidak ada tiket dengan status "${FILTERS.find((f) => f.id === statusFilter)?.label}".`
              }
              actionLabel="Jelajahi Event"
              onAction={() => router.push('/(tabs)/events')}
            />
          }
          renderItem={({ item }) => (
            <TicketCard ticket={item} onShowQR={(t) => setSelectedTicket(t)} />
          )}
        />
      )}

      {/* QR Code Pass Modal */}
      <QRCodeModal
        visible={!!selectedTicket}
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
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
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
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
