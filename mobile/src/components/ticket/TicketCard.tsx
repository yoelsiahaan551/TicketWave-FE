import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CalendarDays, MapPin, QrCode } from 'lucide-react-native';
import { useAppTheme } from '../../context/ThemeContext';
import { TicketItem } from '../../types';
import { formatEventSchedule, isTicketQrEligible } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { FALLBACK_EVENT_IMAGE } from '../../constants/Config';

interface TicketCardProps {
  ticket: TicketItem;
  onShowQR?: (ticket: TicketItem) => void;
}

export function TicketCard({ ticket, onShowQR }: TicketCardProps) {
  const { colors, brand } = useAppTheme();

  const isValid = isTicketQrEligible(ticket.booking_status, ticket, {
    is_event_ended: ticket.is_event_ended,
    event_type: ticket.event_type,
    event_date: ticket.event_date,
    event_end_time: ticket.event_end_time,
  });

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.cardShadow,
          opacity: isValid ? 1 : 0.75,
        },
      ]}
    >
      <View style={styles.topSection}>
        {/* Poster thumbnail */}
        <Image
          source={{ uri: ticket.poster_url || FALLBACK_EVENT_IMAGE }}
          style={styles.thumbnail}
          resizeMode="cover"
        />

        <View style={styles.infoCol}>
          <View style={styles.badgeRow}>
            <Badge status={ticket.status} />
            <Text style={[styles.typeName, { color: brand.primary }]} numberOfLines={1}>
              {ticket.ticket_type_name || 'Reguler'}
            </Text>
          </View>

          <Text style={[styles.eventName, { color: colors.text }]} numberOfLines={2}>
            {ticket.event_name}
          </Text>
        </View>
      </View>

      {/* Meta Grid */}
      <View style={[styles.metaSection, { borderTopColor: colors.border }]}>
        <View style={styles.metaRow}>
          <CalendarDays size={13} color={brand.primary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
            {formatEventSchedule(ticket, { short: true, includeTime: true })}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <MapPin size={13} color={brand.primary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
            {ticket.venue || 'Venue TicketWave'}
          </Text>
        </View>
      </View>

      {/* Footer Bar */}
      <View style={[styles.footer, { backgroundColor: colors.surfaceElevated }]}>
        <View>
          <Text style={[styles.codeLabel, { color: colors.textMuted }]}>KODE TIKET</Text>
          <Text style={[styles.codeText, { color: colors.text }]}>
            {ticket.ticket_code}
          </Text>
        </View>

        {onShowQR && (
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={!isValid}
            onPress={() => isValid && onShowQR(ticket)}
            style={[
              styles.qrBtn,
              {
                backgroundColor: isValid ? brand.primary : colors.surfaceElevated,
                borderWidth: isValid ? 0 : 1,
                borderColor: colors.border,
                opacity: isValid ? 1 : 0.6,
              },
            ]}
          >
            <QrCode size={16} color={isValid ? '#FFFFFF' : colors.textMuted} />
            <Text
              style={[
                styles.qrBtnText,
                { color: isValid ? '#FFFFFF' : colors.textMuted },
              ]}
            >
              {isValid ? 'Lihat QR' : 'QR Nonaktif'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  topSection: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
  },
  thumbnail: {
    width: 76,
    height: 76,
    borderRadius: 16,
    backgroundColor: '#0F172A',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  typeName: {
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  eventName: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  metaSection: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  codeLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  qrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  qrBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
