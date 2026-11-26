/**
 * Utilitas manajemen kode booking tersimpan (Guest / fallback lokal) dan
 * riwayat pesanan akun lintas perangkat (GET /api/checkout/my-bookings).
 *
 * Seluruh data booking, harga, status, dan tiket diambil real-time dari server Backend.
 * Untuk pesanan Guest, browser menyimpan `guest_access_token` HMAC dari Backend agar
 * detail/cancel/sync tetap aman tanpa membocorkan data ke pihak lain.
 */

import api from "./api.js";

const STORAGE_KEY = "ticketwave_booking_codes";

function normalizeStoredEntries(rawList) {
  const byCode = new Map();
  for (const item of rawList) {
    const rawCode = typeof item === "string" ? item : item?.booking_code;
    if (typeof rawCode !== "string" || !rawCode.trim()) {
      throw new Error("Format bookmark tidak valid.");
    }
    const booking_code = rawCode.trim().toUpperCase();
    const rawToken = typeof item === "object" && typeof item?.guest_token === "string"
      ? item.guest_token.trim()
      : "";
    const existing = byCode.get(booking_code);
    byCode.set(booking_code, {
      booking_code,
      guest_token: rawToken || existing?.guest_token || null,
    });
  }
  return Array.from(byCode.values());
}

export function getSavedBookingEntries() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Format bookmark tidak valid.");
    }
    return normalizeStoredEntries(parsed);
  } catch {
    throw new Error("Daftar kode booking di perangkat tidak dapat dibaca. Periksa izin penyimpanan browser dan coba lagi.");
  }
}

export function getGuestTokenForBooking(bookingCode) {
  if (typeof window === "undefined" || !bookingCode) return null;
  const code = String(bookingCode).trim().toUpperCase();
  if (!code) return null;
  try {
    const entries = getSavedBookingEntries();
    const matched = entries.find((item) => item.booking_code === code);
    return matched?.guest_token || null;
  } catch {
    return null;
  }
}

export function saveBookingEntry({ booking_code, guest_token = null }) {
  if (typeof window === "undefined" || !booking_code) return;
  const code = String(booking_code).trim().toUpperCase();
  if (!code) return;

  try {
    let existing = [];
    try {
      existing = getSavedBookingEntries();
    } catch {
      existing = [];
    }
    const previous = existing.find((item) => item.booking_code === code);
    const cleanToken =
      typeof guest_token === "string" && guest_token.trim()
        ? guest_token.trim()
        : previous?.guest_token || null;
    const filtered = existing.filter((item) => item.booking_code !== code);
    const nextEntry = cleanToken
      ? { booking_code: code, guest_token: cleanToken }
      : { booking_code: code };

    localStorage.setItem(STORAGE_KEY, JSON.stringify([nextEntry, ...filtered]));
  } catch (err) {
    console.error("[BookingStorage] Failed to save booking code:", err);
  }
}

export function getSavedPaymentUrl() {
  // Payment URLs must come from a fresh server response.
  return null;
}

/**
 * Mengambil seluruh riwayat pesanan milik user yang sedang login lintas perangkat
 * langsung dari GET /api/checkout/my-bookings.
 */
export async function fetchMyBookings() {
  const res = await api.get("/checkout/my-bookings", {}, { silent: true });
  if (res?.success === true && Array.isArray(res.data?.bookings)) {
    return {
      bookings: res.data.bookings,
      errors: [],
      total: Number(res.data.total ?? res.data.bookings.length),
    };
  }
  throw new Error(res?.message || "Gagal memuat riwayat pesanan akun.");
}

/**
 * Mengambil detail lengkap untuk seluruh kode booking yang tersimpan di perangkat
 * langsung dari endpoint backend GET /api/checkout/<booking_code>.
 */
export async function fetchAllSavedBookings() {
  const entries = getSavedBookingEntries();
  if (entries.length === 0) return { bookings: [], errors: [], total: 0 };

  const results = await Promise.allSettled(
    entries.map(async (entry) => {
      const headers = entry.guest_token ? { "X-Guest-Token": entry.guest_token } : undefined;
      const res = await api.get(
        `/checkout/${encodeURIComponent(entry.booking_code)}`,
        {},
        { silent: true, ...(headers ? { headers } : {}) }
      );
      if (
        res?.success === true &&
        res.data?.booking?.booking_code === entry.booking_code &&
        typeof res.data.booking.status === "string" &&
        Array.isArray(res.data.tickets)
      ) {
        if (res.data.guest_access_token && res.data.guest_access_token !== entry.guest_token) {
          saveBookingEntry({
            booking_code: entry.booking_code,
            guest_token: res.data.guest_access_token,
          });
        }
        return res.data;
      }
      throw new Error("Respons detail booking tidak valid.");
    })
  );

  const bookings = [];
  const errors = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") bookings.push(result.value);
    else {
      errors.push({
        booking_code: entries[index].booking_code,
        message: result.reason?.message || "Gagal memuat pesanan. Silakan coba lagi.",
        status: result.reason?.status || 0,
      });
    }
  });
  return { bookings, errors, total: entries.length };
}
