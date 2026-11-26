import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useAppTheme } from '../../context/ThemeContext';
import { getStatusLabel } from '../../utils/formatters';

interface BadgeProps {
  label?: string;
  status?: string;
  variant?: 'primary' | 'cyan' | 'success' | 'warning' | 'danger' | 'purple' | 'neutral' | 'white';
  style?: ViewStyle;
}

export function Badge({ label, status, variant, style }: BadgeProps) {
  const { brand, colors, isDark } = useAppTheme();

  const resolvedVariant = (() => {
    if (variant) return variant;
    switch (status) {
      case 'on_sale':
      case 'paid':
      case 'valid':
        return 'success';
      case 'pending_payment':
        return 'warning';
      case 'sales_closed':
        return 'neutral';
      case 'cancelled':
      case 'archived':
      case 'dibatalkan':
      case 'denied':
      case 'failed':
        return 'danger';
      case 'finished':
      case 'festival':
        return 'purple';
      case 'published':
      case 'ongoing':
      case 'single':
        return 'primary';
      case 'expired':
      case 'refunded':
      case 'used':
      case 'draft':
      default:
        return 'neutral';
    }
  })();

  const getColors = () => {
    switch (resolvedVariant) {
      case 'primary':
        return {
          bg: isDark ? 'rgba(0, 128, 242, 0.2)' : 'rgba(0, 128, 242, 0.12)',
          text: brand.primary,
        };
      case 'cyan':
        return {
          bg: isDark ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.14)',
          text: brand.cyan,
        };
      case 'success':
        return {
          bg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7',
          text: isDark ? '#34D399' : '#15803D',
        };
      case 'warning':
        return {
          bg: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
          text: isDark ? '#FBBF24' : '#B45309',
        };
      case 'danger':
        return {
          bg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
          text: isDark ? '#F87171' : '#B91C1C',
        };
      case 'purple':
        return {
          bg: isDark ? 'rgba(168, 85, 247, 0.2)' : '#F3E8FF',
          text: isDark ? '#C084FC' : '#7E22CE',
        };
      case 'white':
        return {
          bg: 'rgba(255, 255, 255, 0.95)',
          text: '#0F172A',
        };
      case 'neutral':
      default:
        return {
          bg: colors.surfaceElevated,
          text: colors.textSecondary,
        };
    }
  };

  const palette = getColors();
  const displayLabel = label || (status ? getStatusLabel(status) : '');

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }, style]}>
      <Text style={[styles.text, { color: palette.text }]}>{displayLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
