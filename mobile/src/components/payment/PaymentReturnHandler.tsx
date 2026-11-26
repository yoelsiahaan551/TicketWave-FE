import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';

import { useAppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { fetchBookingDetail } from '../../api/endpoints';
import { getGuestTokenForBooking, saveBookingEntry } from '../../utils/storage';
import { Button } from '../common/Button';
import { Header } from '../common/Header';

interface PaymentReturnHandlerProps {
  mode: 'finish' | 'unfinish' | 'error';
}

export function PaymentReturnHandler({ mode }: PaymentReturnHandlerProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{
    booking_code?: string;
    order_id?: string;
  }>();
  const { colors, brand } = useAppTheme();
  const { user, isAuthenticated, isOfficer, loading, logout } = useAuth();

  const rawCode = params.booking_code || params.order_id || '';
  const resolvedCode = String(rawCode).trim().toUpperCase();

  useEffect(() => {
    if (loading) return;
    if (isAuthenticated && isOfficer) return;

    let active = true;
    (async () => {
      if (!resolvedCode) {
        if (active) router.replace('/(tabs)/orders' as any);
        return;
      }

      if (!isAuthenticated || !user) {
        await saveBookingEntry({ booking_code: resolvedCode });
        if (!active) return;
        router.replace({
          pathname: '/order/[id]',
          params: {
            id: resolvedCode,
            fromPayment: mode === 'error' ? 'error' : 'dismissed',
          },
        } as any);
        return;
      }

      try {
        const guestToken = await getGuestTokenForBooking(resolvedCode);
        const res = await fetchBookingDetail(resolvedCode, {
          guestToken,
          silent: true,
        });
        if (!active) return;

        if (res.success && res.data?.booking) {
          const booking = res.data.booking;
          if (
            booking.user_id != null &&
            user.role !== 'admin' &&
            Number(booking.user_id) !== Number(user.id)
          ) {
            router.replace({
              pathname: '/order/[id]',
              params: { id: resolvedCode },
            } as any);
            return;
          }
          await saveBookingEntry({
            booking_code: booking.booking_code,
            guest_token: res.data.guest_access_token || guestToken || null,
            recipient_email: booking.recipient_email || booking.buyer_email,
            event_name: res.data.event?.name,
          });
        }
      } catch {
        // Let /order/[id] render guest_email verification or auth error cleanly
      }

      if (!active) return;
      router.replace({
        pathname: '/order/[id]',
        params: {
          id: resolvedCode,
          fromPayment: mode === 'error' ? 'error' : 'dismissed',
        },
      } as any);
    })();

    return () => {
      active = false;
    };
  }, [loading, isAuthenticated, isOfficer, user, resolvedCode, mode, router]);

  if (!loading && isAuthenticated && isOfficer) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showBack title="Kembali dari Pembayaran" />
        <View style={styles.centerWrap}>
          <View style={[styles.iconBox, { backgroundColor: brand.warningSoft }]}>
            <ShieldAlert size={28} color={brand.warning} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Sesi Role Tidak Sesuai</Text>
          <Text style={[styles.desc, { color: colors.textSecondary }]}>
            Halaman detail pesanan dan pembayaran hanya diperuntukkan bagi akun pemilik pesanan (User). Sesi aktif Anda saat ini adalah Officer ({user?.email}).
          </Text>
          <Button
            title="Masuk dengan Akun Pembeli"
            onPress={async () => {
              await logout();
              router.replace({
                pathname: '/login',
                params: {
                  next: resolvedCode ? `/order/${encodeURIComponent(resolvedCode)}` : '/(tabs)/orders',
                },
              } as any);
            }}
            variant="primary"
            style={{ width: '100%', maxWidth: 320, marginTop: 16 }}
          />
          <Button
            title="Kembali ke Portal Petugas"
            onPress={() => router.replace('/officer' as any)}
            variant="outline"
            style={{ width: '100%', maxWidth: 320, marginTop: 10 }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.centerWrap}>
        <ActivityIndicator size="large" color={brand.primary} />
        <Text style={[styles.title, { color: colors.text, marginTop: 16 }]}>
          Kembali ke TicketWave
        </Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {resolvedCode
            ? `Mengarahkan ke detail pesanan ${resolvedCode}...`
            : 'Mengarahkan ke daftar pesanan Anda...'}
        </Text>
      </View>
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
    padding: 24,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  desc: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 340,
  },
});
