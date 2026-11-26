import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { SavedBookingEntry, User } from '../types';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'ticketwave_access_token',
  REFRESH_TOKEN: 'ticketwave_refresh_token',
  USER: 'ticketwave_user',
  CUSTOM_API_BASE: 'ticketwave_custom_api_base',
  BOOKING_ENTRIES: 'ticketwave_booking_codes',
  FAVORITE_ARTISTS: 'ticketwave_favorite_artists',
  FAVORITE_EVENTS: 'ticketwave_favorite_events',
  VERIFICATION_TOKEN: 'ticketwave_verification_token',
  THEME_MODE: 'ticketwave_theme_mode',
};

// Helper to determine if SecureStore is usable
async function isSecureStoreAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

// Token Storage using Expo SecureStore (Hardware Keystore / Keychain) on native,
// and sessionStorage/localStorage (via AsyncStorage) on web when remember=false/true.
export async function getStoredAccessToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const sessionTok = window.sessionStorage?.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (sessionTok) return sessionTok;
    }
    const isSecure = await isSecureStoreAvailable();
    if (isSecure) {
      return await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    }
    return await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  } catch {
    return await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN).catch(() => null);
  }
}

export async function setStoredAccessToken(token: string, remember: boolean = true): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (!remember && window.sessionStorage) {
        window.sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
        await AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        return;
      }
      window.sessionStorage?.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    }
    const isSecure = await isSecureStoreAvailable();
    if (isSecure) {
      await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, token);
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
    }
  } catch {
    await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token).catch(() => {});
  }
}

export async function getStoredRefreshToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const sessionTok = window.sessionStorage?.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (sessionTok) return sessionTok;
    }
    const isSecure = await isSecureStoreAvailable();
    if (isSecure) {
      return await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    }
    return await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  } catch {
    return await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN).catch(() => null);
  }
}

export async function setStoredRefreshToken(token: string, remember: boolean = true): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (!remember && window.sessionStorage) {
        window.sessionStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
        await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        return;
      }
      window.sessionStorage?.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    }
    const isSecure = await isSecureStoreAvailable();
    if (isSecure) {
      await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, token);
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
    }
  } catch {
    await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token).catch(() => {});
  }
}

export async function isWebSessionStorageActive(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return Boolean(
    window.sessionStorage?.getItem(STORAGE_KEYS.ACCESS_TOKEN) ||
      window.sessionStorage?.getItem(STORAGE_KEYS.REFRESH_TOKEN)
  );
}

export async function getStoredUser(): Promise<User | null> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const sessionRaw = window.sessionStorage?.getItem(STORAGE_KEYS.USER);
      if (sessionRaw) return JSON.parse(sessionRaw);
    }
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setStoredUser(user: User, remember: boolean = true): Promise<void> {
  try {
    const serialized = JSON.stringify(user);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (!remember && window.sessionStorage) {
        window.sessionStorage.setItem(STORAGE_KEYS.USER, serialized);
        await AsyncStorage.removeItem(STORAGE_KEYS.USER);
        return;
      }
      window.sessionStorage?.removeItem(STORAGE_KEYS.USER);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.USER, serialized);
  } catch {}
}

export async function clearAuthStorage(): Promise<void> {
  try {
    const isSecure = await isSecureStoreAvailable();
    if (isSecure) {
      await Promise.allSettled([
        SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
      ]);
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      window.sessionStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      window.sessionStorage.removeItem(STORAGE_KEYS.USER);
      window.sessionStorage.removeItem(STORAGE_KEYS.VERIFICATION_TOKEN);
    }
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.USER,
      STORAGE_KEYS.VERIFICATION_TOKEN,
    ]);
  } catch {}
}

// Custom API Base Storage
export async function getCustomApiBaseUrl(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_API_BASE);
  } catch {
    return null;
  }
}

export async function setCustomApiBaseUrl(url: string | null): Promise<void> {
  try {
    if (url && url.trim()) {
      await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_API_BASE, url.trim().replace(/\/+$/, ''));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.CUSTOM_API_BASE);
    }
  } catch {}
}

// Booking Entries
export async function getSavedBookingEntries(): Promise<SavedBookingEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.BOOKING_ENTRIES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const byCode = new Map<string, SavedBookingEntry>();
    for (const item of parsed) {
      const rawCode = typeof item === 'string' ? item : item?.booking_code;
      if (typeof rawCode !== 'string' || !rawCode.trim()) continue;
      const code = rawCode.trim().toUpperCase();
      const rawToken =
        typeof item === 'object' && typeof item?.guest_token === 'string'
          ? item.guest_token.trim()
          : '';
      const existing = byCode.get(code);
      byCode.set(code, {
        booking_code: code,
        guest_token: rawToken || existing?.guest_token || null,
        recipient_email:
          (typeof item === 'object' ? item?.recipient_email : null) ||
          existing?.recipient_email ||
          null,
        event_name:
          (typeof item === 'object' ? item?.event_name : undefined) || existing?.event_name,
        saved_at:
          (typeof item === 'object' ? item?.saved_at : undefined) || existing?.saved_at,
      });
    }
    return Array.from(byCode.values());
  } catch {
    return [];
  }
}

export async function getGuestTokenForBooking(bookingCode?: string | null): Promise<string | null> {
  if (!bookingCode) return null;
  const code = String(bookingCode).trim().toUpperCase();
  if (!code) return null;
  try {
    const entries = await getSavedBookingEntries();
    const matched = entries.find((item) => item.booking_code === code);
    return matched?.guest_token || null;
  } catch {
    return null;
  }
}

export async function saveBookingEntry(entry: SavedBookingEntry): Promise<void> {
  if (!entry?.booking_code) return;
  const code = entry.booking_code.trim().toUpperCase();
  if (!code) return;
  try {
    const current = await getSavedBookingEntries();
    const filtered = current.filter((b) => b.booking_code !== code);
    const existing = current.find((b) => b.booking_code === code);
    const cleanToken =
      typeof entry.guest_token === 'string' && entry.guest_token.trim()
        ? entry.guest_token.trim()
        : existing?.guest_token || null;
    const updated: SavedBookingEntry = {
      booking_code: code,
      guest_token: cleanToken,
      recipient_email: entry.recipient_email || existing?.recipient_email || null,
      event_name: entry.event_name || existing?.event_name,
      saved_at: existing?.saved_at || new Date().toISOString(),
    };
    await AsyncStorage.setItem(STORAGE_KEYS.BOOKING_ENTRIES, JSON.stringify([updated, ...filtered]));
  } catch (err) {
    console.warn('[Storage] Failed to save booking entry:', err);
  }
}

// Favorites Storage
export async function getFavoriteArtists(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITE_ARTISTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function toggleFavoriteArtist(artistName: string): Promise<string[]> {
  try {
    const current = await getFavoriteArtists();
    const exists = current.includes(artistName);
    const next = exists ? current.filter((a) => a !== artistName) : [...current, artistName];
    await AsyncStorage.setItem(STORAGE_KEYS.FAVORITE_ARTISTS, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export async function getFavoriteEvents(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITE_EVENTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function toggleFavoriteEvent(eventId: number): Promise<number[]> {
  try {
    const current = await getFavoriteEvents();
    const exists = current.includes(eventId);
    const next = exists ? current.filter((id) => id !== eventId) : [...current, eventId];
    await AsyncStorage.setItem(STORAGE_KEYS.FAVORITE_EVENTS, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}
