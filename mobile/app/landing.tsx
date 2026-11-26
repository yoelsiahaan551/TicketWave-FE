import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Flame,
  Headphones,
  HelpCircle,
  Mail,
  MapPin,
  Music2,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  TrendingUp,
  User,
  X,
} from 'lucide-react-native';

import { BrandColors, PublicThemePalette } from '../src/constants/Colors';
import { useAuth } from '../src/context/AuthContext';
import { fetchBookingDetail, fetchPublicCities, fetchPublicEvents } from '../src/api/endpoints';
import { getGuestTokenForBooking, saveBookingEntry } from '../src/utils/storage';
import { EventItem } from '../src/types';
import { EventCard } from '../src/components/event/EventCard';
import { EventCardSkeleton } from '../src/components/common/Skeleton';
import { Button } from '../src/components/common/Button';
import { Typography } from '../src/constants/Typography';

const FAQS = [
  {
    q: 'Bagaimana cara membeli tiket di TicketWave?',
    a: 'Pilih event yang Anda inginkan, tentukan kategori tiket dan jumlah kuota, isi data pemesan, lalu selesaikan pembayaran melalui metode resmi yang tersedia.',
  },
  {
    q: 'Apakah saya perlu login untuk memesan tiket?',
    a: 'Tidak wajib. Anda dapat memesan tiket langsung menggunakan alamat email aktif dan melacak pesanan melalui menu Cek Pesanan menggunakan kode booking.',
  },
  {
    q: 'Di mana saya bisa melihat e-ticket dan kode QR?',
    a: 'Setelah pembayaran terverifikasi, kode QR e-ticket dapat diakses di menu Tiket Saya atau melalui fitur Cek Pesanan pada bagian atas halaman.',
  },
  {
    q: 'Bisakah saya membatalkan pesanan yang belum dibayar?',
    a: 'Ya, selama status pesanan masih Menunggu Pembayaran, Anda dapat membatalkannya pada halaman detail pesanan.',
  },
];

const TESTIMONIALS = [
  {
    name: 'Rian Pratama',
    role: 'Penikmat Musik, Jakarta',
    comment: 'Pemesanan tiket konser di TicketWave sangat praktis. E-ticket langsung aktif dengan kode QR yang jelas.',
    stars: 5,
  },
  {
    name: 'Sarah Amanda',
    role: 'Penggemar Festival, Bandung',
    comment: 'Informasi fase harga Early Bird dan Presale ditampilkan transparan. Tampilan aplikasinya bersih dan mudah digunakan.',
    stars: 5,
  },
  {
    name: 'Dimas Setiawan',
    role: 'Penonton Konser, Surabaya',
    comment: 'Fitur cek pesanan dengan kode booking sangat membantu untuk membuka tiket dengan cepat di pintu masuk venue.',
    stars: 5,
  },
];

const CATEGORIES = [
  { name: 'Semua', icon: Sparkles },
  { name: 'Konser Musik', icon: Music2 },
  { name: 'Festival', icon: Flame },
  { name: 'Pertunjukan', icon: Headphones },
];

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const router = useRouter();
  const colors = PublicThemePalette;
  const brand = BrandColors;
  const { user, isAuthenticated, isAdmin, isOfficer } = useAuth();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  const [keyword, setKeyword] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  // Guest booking lookup state (modal/bottom sheet only)
  const [bookingCode, setBookingCode] = useState('');
  const [lookupBuyerEmail, setLookupBuyerEmail] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupModalOpen, setLookupModalOpen] = useState(false);

  const isCompactNav = windowWidth < 385;
  const horizontalPad = Math.max(insets.left, insets.right, windowWidth < 375 ? 14 : 16);

  const fetchAllLandingData = useCallback(() => {
    Promise.all([
      fetchPublicEvents({ per_page: 8 })
        .then((res) => {
          setEvents(res.data?.items || []);
          setEventsError(null);
        })
        .catch(() => {
          setEvents([]);
          setEventsError(
            'Tidak dapat terhubung ke layanan TicketWave. Periksa koneksi Anda dan coba lagi.'
          );
        }),
      fetchPublicCities()
        .then((res) => {
          setCities(res.data?.cities || []);
        })
        .catch(() => {
          setCities([]);
        }),
    ]).finally(() => {
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    fetchAllLandingData();
  }, [fetchAllLandingData]);

  const handleRetryLandingData = () => {
    setLoading(true);
    setEventsError(null);
    fetchAllLandingData();
  };

  const handleSearchSubmit = () => {
    router.push({
      pathname: '/(tabs)/events',
      params: {
        search: keyword.trim() || undefined,
        city: selectedCity || undefined,
        category: selectedCategory !== 'Semua' ? selectedCategory : undefined,
      },
    });
  };

  const openLookupModal = () => {
    setLookupError(null);
    setLookupModalOpen(true);
  };

  const closeLookupModal = () => {
    setLookupModalOpen(false);
    if (lookupError) setLookupError(null);
  };

  const handleLookupBooking = async (overrideCode?: string) => {
    const rawCode = (overrideCode !== undefined ? overrideCode : bookingCode).trim().toUpperCase();
    const rawEmail = lookupBuyerEmail.trim();
    if (!rawCode) {
      setLookupError('Masukkan kode booking pesanan Anda terlebih dahulu.');
      return;
    }

    setLookupLoading(true);
    setLookupError(null);

    try {
      const savedGuestToken = await getGuestTokenForBooking(rawCode);
      const res = await fetchBookingDetail(rawCode, {
        guestToken: savedGuestToken,
        buyerEmail: rawEmail || null,
        silent: true,
      });
      if (res.success && res.data?.booking) {
        await saveBookingEntry({
          booking_code: res.data.booking.booking_code,
          guest_token: res.data.guest_access_token || savedGuestToken || null,
          recipient_email:
            res.data.booking.recipient_email || res.data.booking.buyer_email,
          event_name: res.data.event?.name,
        });

        setLookupModalOpen(false);
        setBookingCode('');
        setLookupBuyerEmail('');
        router.push({
          pathname: '/order/[id]',
          params: { id: res.data.booking.booking_code },
        });
      } else {
        setLookupError(res.message || `Kode booking "${rawCode}" tidak ditemukan.`);
      }
    } catch (err: any) {
      const reqMode = err?.data?.errors?.requires_verification;
      if (err?.status === 404) {
        setLookupError(`Kode booking "${rawCode}" tidak ditemukan. Periksa kembali kode Anda.`);
      } else if (reqMode === 'guest_email') {
        setLookupError(
          'Pesanan guest ditemukan. Masukkan email pembeli yang digunakan saat checkout pada kolom Email Pembeli di bawah.'
        );
      } else if (reqMode === 'login') {
        setLookupError(
          'Pesanan ini terdaftar atas akun pengguna. Silakan login dengan akun pemilik pesanan terlebih dahulu.'
        );
      } else if (err?.status === 0 || !err?.status) {
        setLookupError(
          'Tidak dapat terhubung ke layanan TicketWave. Periksa koneksi Anda dan coba lagi.'
        );
      } else {
        setLookupError(
          err?.message ||
            'Kode booking tidak ditemukan atau verifikasi email belum cocok.'
        );
      }
    } finally {
      setLookupLoading(false);
    }
  };

  const featured = events[0] || null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Minimal Responsive Navbar — Official Next.js Logo + Plain Text/Icon Actions + At Most 1 Primary Pill */}
      <View
        style={[
          styles.navbar,
          {
            paddingTop: Math.max(insets.top, 10) + 4,
            paddingLeft: horizontalPad,
            paddingRight: horizontalPad,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/')}
          style={styles.navLogo}
        >
          <Image
            source={require('../assets/images/ticketwave.png')}
            style={styles.navLogoImage}
            resizeMode="contain"
          />
          <Text
            style={[
              styles.navBrand,
              { color: colors.text, fontSize: isCompactNav ? 14 : 15.5 },
            ]}
          >
            TicketWave
          </Text>
        </TouchableOpacity>

        <View style={[styles.navActions, { gap: isCompactNav ? 4 : 8 }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={openLookupModal}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={[styles.navPlainBtn, { paddingHorizontal: isCompactNav ? 4 : 6 }]}
            accessibilityLabel="Cek Pesanan"
          >
            <Text
              style={[
                styles.navPlainBtnText,
                { color: brand.cyan, fontSize: isCompactNav ? 12 : 12.5 },
              ]}
            >
              Cek Pesanan
            </Text>
          </TouchableOpacity>

          {isAuthenticated ? (
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() =>
                router.push(isAdmin ? '/admin' : isOfficer ? '/officer' : '/(tabs)')
              }
              hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
              style={[styles.navPrimaryBtn, { backgroundColor: brand.primary }]}
            >
              <User size={12} color="#FFFFFF" />
              <Text style={styles.navPrimaryBtnText} numberOfLines={1}>
                {isAdmin ? 'Admin' : isOfficer ? 'Officer' : user?.name?.split(' ')[0] || 'Akun'}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/login')}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                style={[styles.navPlainBtn, { paddingHorizontal: isCompactNav ? 3 : 5 }]}
                accessibilityLabel="Masuk"
              >
                <Text
                  style={[
                    styles.navPlainBtnText,
                    { color: colors.text, fontSize: isCompactNav ? 11.5 : 12.5 },
                  ]}
                >
                  Masuk
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => router.push('/register')}
                hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
                style={[
                  styles.navPrimaryBtn,
                  {
                    backgroundColor: brand.primary,
                    paddingHorizontal: isCompactNav ? 8 : 10,
                  },
                ]}
                accessibilityLabel="Daftar"
              >
                <Text style={styles.navPrimaryBtnText}>Daftar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=1200' }}
            style={styles.heroBgImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(11, 15, 23, 0.85)', 'rgba(11, 15, 23, 0.98)']}
            style={styles.heroOverlay}
          />

          <View
            style={[
              styles.heroContent,
              {
                paddingLeft: horizontalPad,
                paddingRight: horizontalPad,
              },
            ]}
          >
            {/* Subtle Compact Trust Badge */}
            <View style={styles.trustBadge}>
              <ShieldCheck size={12} color="#22D3EE" />
              <Text style={styles.trustBadgeText} numberOfLines={1}>
                Platform resmi 150.000+ pembeli tiket
              </Text>
            </View>

            <Text style={styles.heroHeadline} numberOfLines={2}>
              Temukan <Text style={{ color: '#22D3EE' }}>Event Terbaik</Text>
            </Text>

            <Text style={styles.heroSubheadline}>
              Pesan tiket konser, festival musik, dan pertunjukan resmi di berbagai kota Indonesia.
            </Text>

            {/* Single Compact Search Input with Inline Right Action + Simple Secondary Text Link */}
            <View style={styles.heroSearchGroup}>
              <View style={styles.heroInputWrap}>
                <Search size={17} color="#94A3B8" />
                <TextInput
                  style={styles.heroSearchInput}
                  placeholder="Cari konser, artis, atau event..."
                  placeholderTextColor="#64748B"
                  value={keyword}
                  onChangeText={setKeyword}
                  onSubmitEditing={handleSearchSubmit}
                  returnKeyType="search"
                />
                {keyword.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setKeyword('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.inlineClearBtn}
                    accessibilityLabel="Bersihkan pencarian"
                  >
                    <X size={15} color="#94A3B8" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSearchSubmit}
                  style={[styles.inlineSearchBtn, { backgroundColor: brand.primary }]}
                  accessibilityLabel="Jalankan pencarian event"
                >
                  <ArrowRight size={15} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {cities.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.heroCityScroll}
                >
                  <TouchableOpacity
                    onPress={() => setSelectedCity('')}
                    style={[
                      styles.heroCityPill,
                      selectedCity === '' && {
                        backgroundColor: 'rgba(6, 182, 212, 0.22)',
                        borderColor: '#22D3EE',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.heroCityText,
                        selectedCity === '' && styles.heroCityTextActive,
                      ]}
                    >
                      Semua Kota
                    </Text>
                  </TouchableOpacity>

                  {cities.slice(0, 6).map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setSelectedCity(c === selectedCity ? '' : c)}
                      style={[
                        styles.heroCityPill,
                        selectedCity === c && {
                          backgroundColor: 'rgba(6, 182, 212, 0.22)',
                          borderColor: '#22D3EE',
                        },
                      ]}
                    >
                      <MapPin size={11} color={selectedCity === c ? '#22D3EE' : '#94A3B8'} />
                      <Text
                        style={[
                          styles.heroCityText,
                          selectedCity === c && styles.heroCityTextActive,
                        ]}
                      >
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Simple Secondary Text Link (Not a button/card) */}
              <View style={styles.heroSecondaryRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push('/(tabs)/events')}
                  style={styles.heroSecondaryLink}
                >
                  <Text style={styles.heroSecondaryLinkText}>Jelajahi Semua Event</Text>
                  <ArrowRight size={13} color="#22D3EE" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Horizontal Category Chips */}
        <View style={styles.sectionWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.fullWidthScroll}
            contentContainerStyle={[
              styles.categoryScroll,
              { paddingHorizontal: horizontalPad },
            ]}
          >
            {CATEGORIES.map((cat) => {
              const IconComp = cat.icon;
              const active = selectedCategory === cat.name;
              return (
                <TouchableOpacity
                  key={cat.name}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedCategory(cat.name);
                    router.push({
                      pathname: '/(tabs)/events',
                      params: { category: cat.name !== 'Semua' ? cat.name : undefined },
                    });
                  }}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: active ? brand.primary : colors.surface,
                      borderColor: active ? brand.primary : colors.border,
                    },
                  ]}
                >
                  <IconComp size={14} color={active ? '#FFFFFF' : colors.textSecondary} />
                  <Text
                    style={[
                      styles.categoryText,
                      { color: active ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Event Pilihan Section */}
        <View style={styles.sectionWrap}>
          <View style={[styles.sectionHeader, { paddingHorizontal: horizontalPad }]}>
            <View style={styles.sectionTitleRow}>
              <TrendingUp size={17} color={brand.cyan} />
              <Text style={[Typography.h3, { color: colors.text }]}>Event Pilihan</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/events')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[Typography.captionBold, { color: brand.cyan }]}>Lihat Semua</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.fullWidthScroll}
              contentContainerStyle={{ paddingHorizontal: horizontalPad, gap: 12 }}
            >
              {[1, 2, 3].map((i) => (
                <View key={i} style={{ width: 248 }}>
                  <EventCardSkeleton forcePublicTheme />
                </View>
              ))}
            </ScrollView>
          ) : eventsError && events.length === 0 ? (
            <View style={{ paddingHorizontal: horizontalPad }}>
              <View
                style={[
                  styles.connectionErrorCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <AlertCircle size={18} color={brand.danger} />
                <Text style={[styles.connectionErrorText, { color: colors.textSecondary }]}>
                  {eventsError}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleRetryLandingData}
                  style={[
                    styles.retrySmallBtn,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.borderStrong },
                  ]}
                >
                  <Text style={[styles.retrySmallBtnText, { color: colors.text }]}>Coba Lagi</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : events.length > 0 ? (
            <FlatList
              data={events}
              keyExtractor={(item) => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: horizontalPad }}
              renderItem={({ item }) => <EventCard event={item} compact forcePublicTheme />}
            />
          ) : null}
        </View>

        {/* Kenapa Memilih TicketWave — Flat List Layout (No Card-inside-Card) */}
        <View style={[styles.sectionWrap, { paddingHorizontal: horizontalPad }]}>
          <Text style={[Typography.eyebrow, { color: brand.cyan, marginBottom: 3 }]}>
            KEUNGGULAN KAMI
          </Text>
          <Text style={[Typography.h3, { color: colors.text, marginBottom: 12 }]}>
            Kenapa Memilih TicketWave?
          </Text>

          <View style={styles.featureList}>
            <View style={[styles.featureRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.featureIconWrap, { backgroundColor: brand.cyanSoft }]}>
                <ShieldCheck size={18} color={brand.cyan} />
              </View>
              <View style={styles.featureTextCol}>
                <Text style={[Typography.bodyBold, { color: colors.text, marginBottom: 2 }]}>
                  Tiket 100% Resmi
                </Text>
                <Text style={[Typography.caption, { color: colors.textSecondary }]}>
                  Bekerja sama langsung dengan promotor dan penyelenggara acara terverifikasi.
                </Text>
              </View>
            </View>

            <View style={[styles.featureRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.featureIconWrap, { backgroundColor: brand.cyanSoft }]}>
                <QrCode size={18} color={brand.cyan} />
              </View>
              <View style={styles.featureTextCol}>
                <Text style={[Typography.bodyBold, { color: colors.text, marginBottom: 2 }]}>
                  Kode QR Instan
                </Text>
                <Text style={[Typography.caption, { color: colors.textSecondary }]}>
                  E-ticket langsung terbit dengan kode QR unik untuk pemindaian cepat di venue.
                </Text>
              </View>
            </View>

            <View style={[styles.featureRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.featureIconWrap, { backgroundColor: brand.cyanSoft }]}>
                <CreditCard size={18} color={brand.cyan} />
              </View>
              <View style={styles.featureTextCol}>
                <Text style={[Typography.bodyBold, { color: colors.text, marginBottom: 2 }]}>
                  Pembayaran Transparan
                </Text>
                <Text style={[Typography.caption, { color: colors.textSecondary }]}>
                  Mendukung berbagai metode pembayaran dengan perhitungan harga fase otomatis.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Sorotan Event */}
        {featured && (
          <View style={styles.sectionWrap}>
            <View style={[styles.sectionHeader, { paddingHorizontal: horizontalPad }]}>
              <View style={styles.sectionTitleRow}>
                <Flame size={17} color={brand.cyan} />
                <Text style={[Typography.h3, { color: colors.text }]}>Sorotan Event</Text>
              </View>
            </View>

            <View style={{ paddingHorizontal: horizontalPad }}>
              <EventCard event={featured} forcePublicTheme />
            </View>
          </View>
        )}

        {/* Testimonials */}
        <View style={styles.sectionWrap}>
          <View style={[styles.sectionHeader, { paddingHorizontal: horizontalPad }]}>
            <View style={styles.sectionTitleRow}>
              <Star size={17} color="#F59E0B" fill="#F59E0B" />
              <Text style={[Typography.h3, { color: colors.text }]}>Ulasan Pembeli</Text>
            </View>
          </View>

          <View style={[styles.testiContainer, { paddingHorizontal: horizontalPad }]}>
            {TESTIMONIALS.map((t, i) => (
              <View
                key={i}
                style={[
                  styles.testiCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.starsRow}>
                  {[...Array(t.stars)].map((_, idx) => (
                    <Star key={idx} size={12} color="#F59E0B" fill="#F59E0B" />
                  ))}
                </View>
                <Text style={[Typography.body, styles.testiComment, { color: colors.textSecondary }]}>
                  &ldquo;{t.comment}&rdquo;
                </Text>
                <Text style={[Typography.bodyBold, { color: colors.text }]}>{t.name}</Text>
                <Text style={[Typography.caption, { color: colors.textMuted }]}>{t.role}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* FAQ Accordion */}
        <View style={styles.sectionWrap}>
          <View style={[styles.sectionHeader, { paddingHorizontal: horizontalPad }]}>
            <View style={styles.sectionTitleRow}>
              <HelpCircle size={17} color={brand.cyan} />
              <Text style={[Typography.h3, { color: colors.text }]}>Pertanyaan Umum</Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: horizontalPad, gap: 8 }}>
            {FAQS.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.85}
                  onPress={() => setActiveFaq(isOpen ? null : idx)}
                  style={[
                    styles.faqCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.faqHeader}>
                    <Text style={[Typography.bodyBold, styles.faqQuestion, { color: colors.text }]}>
                      {faq.q}
                    </Text>
                    {isOpen ? (
                      <ChevronUp size={17} color={brand.cyan} />
                    ) : (
                      <ChevronDown size={17} color={colors.textMuted} />
                    )}
                  </View>
                  {isOpen && (
                    <Text style={[Typography.body, styles.faqAnswer, { color: colors.textSecondary }]}>
                      {faq.a}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Mobile Footer with Official Next.js Logo */}
        <View
          style={[
            styles.footer,
            {
              borderTopColor: colors.border,
              paddingHorizontal: horizontalPad,
            },
          ]}
        >
          <View style={styles.footerBrandRow}>
            <Image
              source={require('../assets/images/ticketwave.png')}
              style={styles.footerLogoImage}
              resizeMode="contain"
            />
            <Text style={[Typography.bodyBold, { color: colors.text }]}>TicketWave</Text>
          </View>

          <View style={styles.footerLinksRow}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/events')}>
              <Text style={[Typography.captionBold, { color: brand.cyan }]}>Katalog Event</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.textMuted }}>•</Text>
            <TouchableOpacity onPress={openLookupModal}>
              <Text style={[Typography.captionBold, { color: brand.cyan }]}>Cek Pesanan</Text>
            </TouchableOpacity>
          </View>

          <Text style={[Typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: 6 }]}>
            2026 TicketWave. Platform Resmi Tiket Konser &amp; Festival Musik Indonesia.
          </Text>
        </View>
      </ScrollView>

      {/* Cek Pesanan Bottom Sheet / Modal (Opened from Navbar "Cek Pesanan") */}
      <Modal
        visible={lookupModalOpen}
        animationType="slide"
        transparent
        onRequestClose={closeLookupModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={closeLookupModal}
            style={styles.modalBackdropDismiss}
          />
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.borderStrong }]} />

            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <View style={[styles.lookupIconWrap, { backgroundColor: brand.cyanSoft }]}>
                  <Ticket size={18} color={brand.cyan} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.h4, { color: colors.text }]}>Cek Pesanan</Text>
                  <Text style={[Typography.caption, { color: colors.textSecondary }]}>
                    Lacak pembayaran &amp; e-ticket tanpa login
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={closeLookupModal}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.modalCloseBtn}
                accessibilityLabel="Tutup modal cek pesanan"
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[Typography.caption, { color: colors.textSecondary, marginBottom: 12 }]}>
              Masukkan kode booking yang tertera pada bukti pemesanan Anda untuk membuka detail pesanan dan kode QR tiket.
            </Text>

            <View
              style={[
                styles.lookupInputContainer,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: lookupError ? brand.danger : colors.border,
                  marginBottom: 12,
                },
              ]}
            >
              <Ticket size={17} color={lookupError ? brand.danger : brand.cyan} />
              <TextInput
                style={[styles.lookupInput, { color: colors.text }]}
                placeholder="Kode booking (cth: TKTW-20261118-XXXXXX)"
                placeholderTextColor={colors.textMuted}
                value={bookingCode}
                onChangeText={(t) => {
                  setBookingCode(t);
                  if (lookupError) setLookupError(null);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => handleLookupBooking()}
              />
              {bookingCode.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setBookingCode('');
                    if (lookupError) setLookupError(null);
                  }}
                  style={styles.clearBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={15} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <View
              style={[
                styles.lookupInputContainer,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  marginBottom: 12,
                },
              ]}
            >
              <Mail size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.lookupInput, { color: colors.text }]}
                placeholder="Email pembeli (untuk verifikasi pesanan guest)"
                placeholderTextColor={colors.textMuted}
                value={lookupBuyerEmail}
                onChangeText={(t) => {
                  setLookupBuyerEmail(t);
                  if (lookupError) setLookupError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => handleLookupBooking()}
              />
              {lookupBuyerEmail.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setLookupBuyerEmail('');
                    if (lookupError) setLookupError(null);
                  }}
                  style={styles.clearBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={15} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {lookupError && (
              <View
                style={[
                  styles.lookupErrorBanner,
                  { backgroundColor: brand.dangerSoft, borderColor: brand.danger, marginBottom: 12 },
                ]}
              >
                <AlertCircle size={15} color={brand.danger} />
                <Text style={[styles.lookupErrorText, { color: brand.danger }]}>
                  {lookupError}
                </Text>
              </View>
            )}

            <Button
              title={lookupLoading ? 'Memeriksa...' : 'Periksa Pesanan'}
              onPress={() => handleLookupBooking()}
              loading={lookupLoading}
              variant="primary"
              size="md"
              forcePublicTheme
              style={styles.lookupSubmitBtn}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  navbar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 9,
    borderBottomWidth: 1,
    gap: 6,
  },
  navLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  navLogoImage: {
    width: 26,
    height: 26,
  },
  navBrand: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  navPlainBtn: {
    paddingHorizontal: 5,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navPlainBtnText: {
    fontWeight: '600',
  },
  navIconBtn: {
    width: 28,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginLeft: 2,
  },
  navPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  heroSection: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  heroBgImage: {
    ...StyleSheet.absoluteFill,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
  },
  heroContent: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    paddingTop: 20,
    paddingBottom: 22,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(6, 182, 212, 0.10)',
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
    marginBottom: 10,
    maxWidth: '100%',
  },
  trustBadgeText: {
    color: '#67E8F9',
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  heroHeadline: {
    color: '#FFFFFF',
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroSubheadline: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 15,
  },
  heroSearchGroup: {
    width: '100%',
    gap: 9,
  },
  heroInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    borderRadius: 11,
    paddingLeft: 12,
    paddingRight: 6,
    height: 46,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
  },
  heroSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13.5,
    height: '100%',
  },
  inlineClearBtn: {
    padding: 4,
  },
  inlineSearchBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCityScroll: {
    gap: 7,
    paddingVertical: 1,
  },
  heroCityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
  },
  heroCityText: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '600',
  },
  heroCityTextActive: {
    color: '#FFFFFF',
  },
  heroSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  heroSecondaryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  heroSecondaryLinkText: {
    color: '#22D3EE',
    fontSize: 12.5,
    fontWeight: '600',
  },
  sectionWrap: {
    width: '100%',
    marginTop: 20,
  },
  fullWidthScroll: {
    width: '100%',
  },
  categoryScroll: {
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  connectionErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  connectionErrorText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  retrySmallBtn: {
    paddingHorizontal: 11,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retrySmallBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  featureList: {
    width: '100%',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  featureTextCol: {
    flex: 1,
  },
  testiContainer: {
    gap: 10,
  },
  testiCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 6,
  },
  testiComment: {
    lineHeight: 19,
    marginBottom: 8,
  },
  faqCard: {
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  faqQuestion: {
    flex: 1,
  },
  faqAnswer: {
    lineHeight: 19,
    marginTop: 7,
  },
  footer: {
    marginTop: 28,
    paddingTop: 18,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  footerLogoImage: {
    width: 24,
    height: 24,
  },
  footerLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalBackdropDismiss: {
    flex: 1,
  },
  modalSheet: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  modalTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  lookupIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookupInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
    gap: 9,
  },
  lookupInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: 0.3,
    height: '100%',
  },
  clearBtn: {
    padding: 4,
  },
  lookupErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  lookupErrorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  lookupSubmitBtn: {
    width: '100%',
  },
});
