import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  Heart,
  MapPin,
  Minus,
  Plus,
  Sparkles,
  Tag,
  Ticket,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '../../src/context/ThemeContext';
import { useFavorites } from '../../src/context/FavoritesContext';
import { fetchPublicEventDetail } from '../../src/api/endpoints';
import { Agency, EventItem, FestivalArtist, TicketType } from '../../src/types';
import {
  effectiveTicketPrice,
  formatEventSchedule,
  formatRupiah,
  formatWaktu,
  isEventPast,
  isEventPurchasable,
} from '../../src/utils/formatters';
import { Badge } from '../../src/components/common/Badge';
import { Button } from '../../src/components/common/Button';
import { FALLBACK_EVENT_IMAGE } from '../../src/constants/Config';
import { Skeleton } from '../../src/components/common/Skeleton';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, brand, isDark } = useAppTheme();
  const { isEventFavorite, toggleEvent } = useFavorites();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [lineup, setLineup] = useState<FestivalArtist[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let ignore = false;

    fetchPublicEventDetail(id)
      .then((res) => {
        if (!ignore && res.data) {
          setEvent(res.data.event);
          setAgency(res.data.agency || null);
          setLineup(res.data.lineup || []);
          const types = res.data.ticket_types || [];
          setTicketTypes(types);

          const firstAvail = types.find(
            (t) => (t.stock_available ?? t.quota - t.sold_count) > 0
          );
          if (firstAvail) {
            setSelectedTicketId(firstAvail.id);
            setQuantity(1);
          }
          setError(null);
        }
      })
      .catch((err: any) => {
        if (!ignore) {
          const msg = err?.message || 'Gagal memuat detail event.';
          if (err?.status === 404 || msg.includes('Event not found')) {
            setError(`Event dengan ID '${id}' tidak ditemukan dalam katalog publik TicketWave. Event mungkin telah berakhir atau belum dipublikasikan.`);
          } else {
            setError(msg);
          }
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [id, retryKey]);

  const selectedTicket = ticketTypes.find((t) => t.id === selectedTicketId) || null;
  const eventPast = isEventPast(event);
  const purchasable = isEventPurchasable(event);

  const getEffectivePrice = (t: TicketType) => effectiveTicketPrice(t);

  const availableStock = (t: TicketType) =>
    t.stock_available ?? Math.max(0, (t.quota || 0) - (t.sold_count || 0));

  const handleSelectTicket = (t: TicketType) => {
    if (!purchasable) return;
    const avail = availableStock(t);
    if (avail <= 0) return;
    setSelectedTicketId(t.id);
    if (quantity === 0) setQuantity(1);
  };

  const handleQuantity = (delta: number) => {
    if (!selectedTicket || !purchasable) return;
    const avail = availableStock(selectedTicket);
    const maxAllowed = Math.min(avail, 10);
    const next = quantity + delta;
    if (next >= 1 && next <= maxAllowed) {
      setQuantity(next);
    }
  };

  const handleProceedCheckout = () => {
    if (!purchasable) {
      Alert.alert(
        'Penjualan Ditutup',
        eventPast
          ? 'Tanggal acara sudah terlewati sehingga pembelian tiket tidak tersedia.'
          : 'Penjualan tiket untuk event ini sedang tidak aktif.'
      );
      return;
    }
    if (!selectedTicket || quantity <= 0) {
      Alert.alert('Peringatan', 'Pilih kategori tiket dan tentukan jumlah tiket.');
      return;
    }

    const payload = JSON.stringify({
      eventId: event?.id,
      ticketTypeId: selectedTicket.id,
      quantity,
      eventName: event?.name,
      eventType: event?.event_type,
      daysCount: event?.days_count,
      ticketName: selectedTicket.name,
      unitPrice: getEffectivePrice(selectedTicket),
      basePrice: Number(selectedTicket.base_price ?? getEffectivePrice(selectedTicket)),
      discountPercent: selectedTicket.active_phase?.discount_percent ?? 0,
      activePhaseName: selectedTicket.active_phase?.phase_name ?? null,
      posterUrl: event?.poster_url || event?.banner_url,
      venue: event?.venue,
      city: event?.city,
      eventDate: event?.event_date,
      eventTime: event?.event_time,
      eventEndTime: event?.event_end_time,
    });

    router.push({
      pathname: '/checkout',
      params: { payload },
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.floatingHeader, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.floatingHeaderBtn}>
            <ArrowLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <Skeleton width="100%" height={260} borderRadius={0} />
        <View style={{ padding: 20, gap: 14 }}>
          <Skeleton width="40%" height={24} borderRadius={12} />
          <Skeleton width="80%" height={28} borderRadius={8} />
          <Skeleton width="100%" height={100} borderRadius={20} />
          <Skeleton width="100%" height={120} borderRadius={20} />
        </View>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={[styles.centerWrap, { backgroundColor: colors.background, paddingHorizontal: 24 }]}>
        <Text style={[styles.errorTitle, { color: brand.danger, textAlign: 'center' }]}>Gagal Memuat Event</Text>
        <Text style={[styles.errorDesc, { color: colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>{error}</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
          <Button
            title="Coba Lagi"
            onPress={() => setRetryKey((k) => k + 1)}
            size="md"
            style={{ flex: 1 }}
          />
          <Button
            title="Kembali"
            onPress={() => router.back()}
            variant="outline"
            size="md"
            style={{ flex: 1 }}
          />
        </View>
      </View>
    );
  }

  const isFav = isEventFavorite(event.id);
  const heroImage = event.banner_url || event.poster_url || FALLBACK_EVENT_IMAGE;
  const sortedLineup = [...lineup].sort(
    (a, b) => (a.day_number || a.day || 1) - (b.day_number || b.day || 1)
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Floating Back & Favorite Header Bar */}
      <View style={[styles.floatingHeader, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.back()}
          style={styles.floatingHeaderBtn}
        >
          <ArrowLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.floatingRightRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => toggleEvent(event.id)}
            style={styles.floatingHeaderBtn}
          >
            <Heart
              size={20}
              color={isFav ? brand.danger : '#FFFFFF'}
              fill={isFav ? brand.danger : 'transparent'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={styles.heroWrap}>
          <Image source={{ uri: heroImage }} style={styles.heroImg} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(2, 6, 23, 0.4)', 'rgba(9, 13, 22, 0.85)', colors.background]}
            style={styles.heroOverlay}
          />
        </View>

        <View style={styles.bodyWrap}>
          {/* Badges */}
          <View style={styles.badgeRow}>
            <Badge
              label={event.event_type === 'festival' ? 'Festival' : 'Single Concert'}
              variant={event.event_type === 'festival' ? 'purple' : 'primary'}
            />
            <Badge status={event.status} style={{ marginLeft: 6 }} />
          </View>

          {/* Title */}
          <Text style={[styles.eventTitle, { color: colors.text }]}>{event.name}</Text>

          {event.artist_name && (
            <Text style={[styles.artistName, { color: brand.primary }]}>
              {event.artist_name}
            </Text>
          )}

          {/* Details Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <Calendar size={18} color={brand.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                  {event.event_type === 'festival' ? 'Durasi Festival' : 'Tanggal'}
                </Text>
                <Text style={[styles.infoVal, { color: colors.text }]}>
                  {formatEventSchedule(event, { includeTime: false })}
                </Text>
              </View>
            </View>

            {event.event_time && (
              <View style={styles.infoRow}>
                <Clock size={18} color={brand.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Waktu</Text>
                  <Text style={[styles.infoVal, { color: colors.text }]}>
                    {event.event_end_time
                      ? `${event.event_time.slice(0, 5)} – ${event.event_end_time.slice(0, 5)} WIB`
                      : formatWaktu(event.event_time)}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.infoRow}>
              <MapPin size={18} color={brand.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Lokasi Venue</Text>
                <Text style={[styles.infoVal, { color: colors.text }]}>
                  {event.venue}, {event.city}
                </Text>
              </View>
            </View>
          </View>

          {/* Festival Lineup (if festival) */}
          {event.event_type === 'festival' && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Sparkles size={18} color={brand.purple} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Lineup Festival</Text>
              </View>
              {sortedLineup.length > 0 ? (
                <View style={[styles.lineupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {sortedLineup.map((item, idx) => (
                    <View
                      key={item.id || idx}
                      style={[
                        styles.lineupItem,
                        idx < sortedLineup.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                      ]}
                    >
                      <View style={[styles.dayPill, { backgroundColor: brand.purpleSoft }]}>
                        <Text style={[styles.dayPillText, { color: brand.purple }]}>
                          Day {item.day_number || item.day || 1}
                        </Text>
                      </View>
                      <Text style={[styles.artistLineupName, { color: colors.text }]}>
                        {item.artist_name || item.name}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>
                    Lineup musisi & jadwal penampil festival akan segera diumumkan oleh promotor.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Description */}
          {event.description ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Deskripsi Acara</Text>
              <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
                {event.description}
              </Text>
            </View>
          ) : null}

          {/* Agency Card */}
          {agency && (
            <View style={[styles.agencyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.agencyIcon, { backgroundColor: brand.primarySoft }]}>
                <Building2 size={20} color={brand.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.agencyLabel, { color: colors.textMuted }]}>Penyelenggara</Text>
                <Text style={[styles.agencyName, { color: colors.text }]}>{agency.name}</Text>
                <Text style={[styles.agencyPic, { color: colors.textSecondary }]}>PIC: {agency.pic_name}</Text>
              </View>
            </View>
          )}

          {/* Ticket Categories Selection Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Ticket size={18} color={brand.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Pilih Kategori Tiket</Text>
            </View>

            {ticketTypes.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  Kategori tiket belum dibuka untuk event ini.
                </Text>
              </View>
            ) : (
              ticketTypes.map((ticket) => {
                const isSelected = selectedTicketId === ticket.id;
                const stock = availableStock(ticket);
                const isSoldOut = stock <= 0;
                const effPrice = getEffectivePrice(ticket);

                return (
                  <TouchableOpacity
                    key={ticket.id}
                    activeOpacity={0.88}
                    disabled={isSoldOut || !purchasable}
                    onPress={() => handleSelectTicket(ticket)}
                    style={[
                      styles.ticketCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: isSelected
                          ? brand.primary
                          : colors.border,
                      },
                      isSelected && {
                        borderWidth: 2,
                        backgroundColor: isDark ? 'rgba(0,128,242,0.1)' : 'rgba(0,128,242,0.04)',
                      },
                      (isSoldOut || !purchasable) && { opacity: 0.55 },
                    ]}
                  >
                    <View style={styles.ticketCardHeader}>
                      <View>
                        <Text style={[styles.ticketName, { color: colors.text }]}>
                          {ticket.name}
                        </Text>
                        {ticket.active_phase && (
                          <View style={styles.phasePill}>
                            <Tag size={12} color={brand.success} />
                            <Text style={[styles.phaseText, { color: brand.success }]}>
                              {ticket.active_phase.phase_name.toUpperCase()} (Diskon {ticket.active_phase.discount_percent}%)
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.ticketPrice, { color: brand.primary }]}>
                          {formatRupiah(effPrice)}
                        </Text>
                        {ticket.active_phase && (
                          <Text style={[styles.ticketBasePrice, { color: colors.textMuted }]}>
                            {formatRupiah(ticket.base_price)}
                          </Text>
                        )}
                      </View>
                    </View>

                    {ticket.description ? (
                      <Text style={[styles.ticketDesc, { color: colors.textSecondary }]}>
                        {ticket.description}
                      </Text>
                    ) : null}

                    <View style={styles.ticketCardFooter}>
                      <Text style={[styles.stockText, { color: isSoldOut ? brand.danger : colors.textMuted }]}>
                        {isSoldOut ? 'Tiket Habis (Sold Out)' : `Tersisa ${stock} tiket`}
                      </Text>

                      {isSelected && !isSoldOut && (
                        <View style={styles.qtyRow}>
                          <TouchableOpacity
                            onPress={() => handleQuantity(-1)}
                            disabled={quantity <= 1}
                            style={[styles.qtyBtn, { backgroundColor: colors.surfaceElevated }]}
                          >
                            <Minus size={14} color={quantity <= 1 ? colors.textMuted : colors.text} />
                          </TouchableOpacity>

                          <Text style={[styles.qtyNum, { color: colors.text }]}>{quantity}</Text>

                          <TouchableOpacity
                            onPress={() => handleQuantity(1)}
                            disabled={quantity >= Math.min(stock, 10)}
                            style={[styles.qtyBtn, { backgroundColor: colors.surfaceElevated }]}
                          >
                            <Plus
                              size={14}
                              color={quantity >= Math.min(stock, 10) ? colors.textMuted : colors.text}
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Floating Bottom Bar */}
      {!purchasable ? (
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <View>
            <Text style={[styles.bottomBarLabel, { color: colors.textMuted }]}>Status Penjualan</Text>
            <Text style={[styles.bottomBarTotal, { color: colors.textSecondary, fontSize: 14 }]}>
              {eventPast ? 'Acara Sudah Selesai' : 'Penjualan Tiket Ditutup'}
            </Text>
          </View>
          <Button
            title={eventPast ? 'Acara Selesai' : 'Penjualan Ditutup'}
            onPress={handleProceedCheckout}
            disabled
            variant="secondary"
            size="md"
          />
        </View>
      ) : selectedTicket && availableStock(selectedTicket) > 0 ? (
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <View>
            <Text style={[styles.bottomBarLabel, { color: colors.textMuted }]}>
              {selectedTicket.name} × {quantity}
            </Text>
            <Text style={[styles.bottomBarTotal, { color: brand.primary }]}>
              {formatRupiah(getEffectivePrice(selectedTicket) * quantity)}
            </Text>
          </View>

          <Button
            title="Lanjut ke Pembayaran"
            onPress={handleProceedCheckout}
            variant="gradient"
            size="md"
            style={{ paddingHorizontal: 18 }}
          />
        </View>
      ) : null}
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
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  errorDesc: {
    fontSize: 13,
    textAlign: 'center',
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  floatingHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  floatingRightRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  heroWrap: {
    height: 300,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  bodyWrap: {
    paddingHorizontal: 20,
    marginTop: -30,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  artistName: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 14,
  },
  infoCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginTop: 14,
    gap: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoVal: {
    fontSize: 13.5,
    fontWeight: '700',
    marginTop: 1,
  },
  section: {
    marginTop: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  descriptionText: {
    fontSize: 13.5,
    lineHeight: 21,
    fontWeight: '400',
  },
  lineupCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  lineupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  dayPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dayPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  artistLineupName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  agencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 16,
    gap: 12,
  },
  agencyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agencyLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  agencyName: {
    fontSize: 14,
    fontWeight: '800',
  },
  agencyPic: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 1,
  },
  emptyBox: {
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
  },
  ticketCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  ticketCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ticketName: {
    fontSize: 16,
    fontWeight: '800',
  },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  phaseText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  ticketPrice: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  ticketBasePrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  ticketDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  ticketCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
  },
  stockText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyNum: {
    fontSize: 14,
    fontWeight: '800',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  bottomBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  bottomBarTotal: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 1,
  },
});
