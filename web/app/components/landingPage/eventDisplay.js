/**
 * Helper tampilan event untuk Landing Page.
 * Semua nilai berasal dari respons backend (GET /api/public/events & /api/public/events/<id>).
 * Tidak ada data event dummy di sini — hanya formatter & gambar fallback visual.
 */

export const FALLBACK_POSTER =
  "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200";

export function handleImageError(e) {
  if (e?.currentTarget && e.currentTarget.src !== FALLBACK_POSTER) {
    e.currentTarget.src = FALLBACK_POSTER;
  }
}

export function posterOf(event) {
  return event?.poster_url || event?.banner_url || FALLBACK_POSTER;
}

export function bannerOf(event) {
  return event?.banner_url || event?.poster_url || FALLBACK_POSTER;
}

export function formatRupiah(value) {
  const n = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(n) || n < 0) return null;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export function validEventId(value) {
  return (typeof value === "number" || typeof value === "string") &&
    /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value));
}

function nonNegativeNumber(value) {
  if ((typeof value !== "number" && typeof value !== "string") || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function readEventList(response) {
  const data = response?.data;
  if (!Array.isArray(data?.items) || data.items.some((event) => !validEventId(event?.id))) {
    throw new Error("Respons katalog event tidak valid. Silakan coba lagi.");
  }
  return data;
}

/** Invalid or structured list prices cannot be trusted as a starting price. */
export function priceFromOf(event) {
  return nonNegativeNumber(event?.price_from);
}

/** Prefer the backend's authoritative final_price; fallback uses whole-Rupiah rounding matching Backend. */
export function effectiveTicketPrice(t) {
  const officialFinal = nonNegativeNumber(t?.final_price);
  if (officialFinal !== null) return officialFinal;
  const base = nonNegativeNumber(t?.base_price);
  if (t?.active_phase) {
    const discount = nonNegativeNumber(t.active_phase.discount_percent);
    if (base === null || discount === null || discount > 100) return null;
    return Math.round(base * (1 - discount / 100));
  }
  return base;
}

export function stockOf(t) {
  const stock = nonNegativeNumber(t?.stock_available);
  if (stock !== null) return Math.floor(stock);
  const quota = nonNegativeNumber(t?.quota);
  const sold = nonNegativeNumber(t?.sold_count);
  return quota === null || sold === null ? 0 : Math.max(0, Math.floor(quota - sold));
}

export function formatEventDate(event, opts = { day: "numeric", month: "short", year: "numeric" }) {
  if (!event?.event_date) {
    if (event?.event_type === "festival") return `Festival ${event?.days_count || 1} Hari`;
    return "Jadwal menyusul";
  }
  try {
    const [y, m, d] = event.event_date.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("id-ID", opts);
  } catch {
    return event.event_date;
  }
}

export function formatEventTime(event) {
  return event?.event_time ? `${event.event_time.slice(0, 5)} WIB` : null;
}

/** true bila tanggal event sudah lewat (berdasarkan event_date dari backend). */
export function isEventPast(event) {
  if (!event?.event_date) return false;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
  return event.event_date < todayStr;
}

/** Event bisa dibeli hanya jika status on_sale dan belum lewat. */
export function isPurchasable(event) {
  return event?.status === "on_sale" && !isEventPast(event);
}

export function eventTypeLabel(event) {
  return event?.event_type === "festival" ? "Festival" : "Konser";
}
