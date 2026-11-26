import React, { useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Calendar,
  Info,
  MapPin,
  RefreshCw,
  ScanLine,
} from 'lucide-react-native';

import { useAppTheme } from '../../src/context/ThemeContext';
import { fetchPublicEvents } from '../../src/api/endpoints';
import { EventItem } from '../../src/types';
import { formatEventSchedule } from '../../src/utils/formatters';
import { Header } from '../../src/components/common/Header';
import { Badge } from '../../src/components/common/Badge';
import { Button } from '../../src/components/common/Button';
import { Skeleton } from '../../src/components/common/Skeleton';
import { Typography } from '../../src/constants/Typography';

export default function OfficerEventsScreen() {
  const router = useRouter();
  const { colors, brand } = useAppTheme();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetchPublicEvents({ per_page: 20 })
      .then((res) => {
        if (!ignore) {
          setEvents(res.data?.items || []);
        }
      })
      .catch(() => {
        if (!ignore) {
          setEvents([]);
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
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPublicEvents({ per_page: 20 })
      .then((res) => {
        setEvents(res.data?.items || []);
      })
      .catch(() => {
        setEvents([]);
      })
      .finally(() => {
        setRefreshing(false);
      });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        showBack
        title="Daftar Event Aktif"
        subtitle="Katalog event publik untuk validasi gate"
        rightAction={
          <TouchableOpacity
            onPress={onRefresh}
            style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}
          >
            <RefreshCw size={17} color={colors.text} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brand.primary} />}
      >
        {/* Notice Banner */}
        <View style={[styles.noticeCard, { backgroundColor: brand.primarySoft, borderColor: brand.primary }]}>
          <Info size={20} color={brand.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[Typography.h4, styles.noticeTitle, { color: colors.text }]}>
              Katalog Event Operasional Gate
            </Text>
            <Text style={[Typography.caption, styles.noticeDesc, { color: colors.textSecondary }]}>
              Data penugasan gate per petugas belum tersedia dari sistem backend. Seluruh event publik aktif di bawah ini dapat divalidasi oleh petugas gate.
            </Text>
          </View>
        </View>

        <Text style={[Typography.h4, styles.sectionTitle, { color: colors.text, marginTop: 14 }]}>
          Event Aktif Penyelenggara
        </Text>

        {loading ? (
          <View style={{ gap: 10 }}>
            <Skeleton width="100%" height={100} borderRadius={20} />
            <Skeleton width="100%" height={100} borderRadius={20} />
          </View>
        ) : events.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>
              Tidak ada event aktif yang terdaftar saat ini.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {events.map((ev) => (
              <View
                key={ev.id}
                style={[styles.eventCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.eventHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.eventName, { color: colors.text }]}>{ev.name}</Text>
                    <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      {ev.event_type === 'festival' ? 'Festival Musik' : 'Konser Tunggal'}
                    </Text>
                  </View>
                  <Badge
                    label={ev.status.toUpperCase()}
                    variant={ev.status === 'on_sale' || ev.status === 'published' ? 'success' : 'neutral'}
                  />
                </View>

                <View style={[styles.eventMeta, { borderTopColor: colors.border }]}>
                  <View style={styles.metaRow}>
                    <MapPin size={14} color={brand.primary} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                      {ev.venue}, {ev.city}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Calendar size={14} color={brand.cyan} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                      {formatEventSchedule(ev, { short: true, includeTime: true })}
                    </Text>
                  </View>
                </View>

                <View style={{ marginTop: 12 }}>
                  <Button
                    title="Mulai Scan untuk Event Ini"
                    onPress={() => router.push('/officer/scan' as any)}
                    size="sm"
                    variant="outline"
                    icon={<ScanLine size={14} color={brand.primary} />}
                  />
                </View>
              </View>
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  noticeCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    alignItems: 'flex-start',
  },
  noticeTitle: {
    marginBottom: 4,
  },
  noticeDesc: {
    lineHeight: 18,
  },
  sectionTitle: {
    marginBottom: 10,
  },
  emptyBox: {
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
  },
  eventCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eventName: {
    fontSize: 15,
    fontWeight: '700',
  },
  eventMeta: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
  },
});
