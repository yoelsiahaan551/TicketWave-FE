const PAYMENT_RETURN_CONTEXT_KEY = "ticketwave_payment_return_context";
const PAYMENT_RETURN_TTL_MS = 2 * 60 * 60 * 1000;

export function savePaymentReturnContext({
  booking_code,
  return_path = null,
  owner_user_id = null,
  owner_email = null,
  is_guest = false,
}) {
  if (typeof window === "undefined" || typeof booking_code !== "string") return;
  const cleanCode = booking_code.trim().toUpperCase();
  if (!cleanCode) return;

  const contextPayload = {
    booking_code: cleanCode,
    return_path:
      typeof return_path === "string" && return_path.startsWith("/user/pesanan/")
        ? return_path
        : `/user/pesanan/${encodeURIComponent(cleanCode)}?payment_return=1`,
    timestamp: Date.now(),
    owner_user_id: owner_user_id ?? null,
    owner_email:
      typeof owner_email === "string" && owner_email.trim()
        ? owner_email.trim().toLowerCase()
        : null,
    is_guest: Boolean(is_guest),
  };

  const serialized = JSON.stringify(contextPayload);
  for (const store of [sessionStorage, localStorage]) {
    try {
      store.setItem(PAYMENT_RETURN_CONTEXT_KEY, serialized);
    } catch {
      // Ignore storage quota errors
    }
  }
}

export function readPaymentReturnContext(expectedBookingCode = null) {
  if (typeof window === "undefined") return null;
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(PAYMENT_RETURN_CONTEXT_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof parsed.booking_code !== "string" ||
        !Number.isFinite(Number(parsed.timestamp))
      ) {
        continue;
      }
      if (Date.now() - Number(parsed.timestamp) > PAYMENT_RETURN_TTL_MS) {
        clearPaymentReturnContext();
        return null;
      }
      if (
        typeof expectedBookingCode === "string" &&
        expectedBookingCode.trim() &&
        parsed.booking_code.toUpperCase() !== expectedBookingCode.trim().toUpperCase()
      ) {
        continue;
      }
      return parsed;
    } catch {
      // Ignore malformed storage entries
    }
  }
  return null;
}

export function clearPaymentReturnContext() {
  if (typeof window === "undefined") return;
  for (const store of [sessionStorage, localStorage]) {
    try {
      store.removeItem(PAYMENT_RETURN_CONTEXT_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}

export function isBookingOwnedByUser(booking, user) {
  if (!booking || !user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "user") return false;

  if (booking.user_id !== null && booking.user_id !== undefined) {
    return Number(booking.user_id) === Number(user.id);
  }

  const userEmail = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  const buyerEmail =
    typeof booking.buyer_email === "string" ? booking.buyer_email.trim().toLowerCase() : "";
  if (!userEmail || !buyerEmail) return false;
  return userEmail === buyerEmail;
}

export function isPendingSessionExpired(booking, nowMs = Date.now()) {
  if (!booking || booking.status !== "pending_payment" || typeof booking.expired_at !== "string") {
    return false;
  }
  const trimmed = booking.expired_at.trim();
  const normalized = /Z$|[+-]\d{2}:?\d{2}$/.test(trimmed) ? trimmed : `${trimmed}Z`;
  const expiresAtMs = Date.parse(normalized);
  if (!Number.isFinite(expiresAtMs)) return false;
  return nowMs > expiresAtMs;
}

export function normalizeUtcIso(rawIso) {
  if (typeof rawIso !== "string" || !rawIso.trim()) return null;
  const trimmed = rawIso.trim();
  return /Z$|[+-]\d{2}:?\d{2}$/.test(trimmed) ? trimmed : `${trimmed}Z`;
}
