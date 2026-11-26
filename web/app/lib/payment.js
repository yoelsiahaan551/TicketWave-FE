import { normalizeUtcIso } from "./paymentContext.js";

const BADGE_STYLES = {
  paid: "border border-emerald-200/60 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  pending_payment:
    "border border-amber-200/60 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  event_ended:
    "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300",
  expired:
    "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300",
  cancelled:
    "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300",
  sales_closed:
    "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300",
  denied:
    "border border-rose-200/60 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
  refunded:
    "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300",
};

function extractValidatedMidtransUrl(booking) {
  if (booking?.status !== "pending_payment" || typeof booking.payment_url !== "string") {
    return null;
  }
  try {
    const url = new URL(booking.payment_url);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (!["app.midtrans.com", "app.sandbox.midtrans.com"].includes(url.hostname)) return null;
    const match = url.pathname.match(/^\/snap\/v[1-4]\/(?:vtweb|redirection)\/([^/]+)\/?$/);
    if (!match) return null;
    const session = decodeURIComponent(match[1]);
    if (
      !session.trim() ||
      /[\s/\\?#]/.test(session) ||
      [...session].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
      session === booking.booking_code
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export function isEventOfficiallyEnded(event, tickets = [], nowMs = Date.now()) {
  if (event?.is_event_ended === true) return true;
  if (Array.isArray(tickets) && tickets.some((t) => t?.is_event_ended === true)) {
    return true;
  }
  if (["finished", "archived"].includes(event?.status)) return true;

  if (
    event?.event_type !== "festival" &&
    typeof event?.event_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(event.event_date.trim())
  ) {
    const cleanDate = event.event_date.trim();
    const rawEndTime =
      typeof event?.event_end_time === "string" ? event.event_end_time.trim() : "";

    if (/^\d{2}:\d{2}(:\d{2})?$/.test(rawEndTime)) {
      const hms = rawEndTime.length === 5 ? `${rawEndTime}:00` : rawEndTime;
      const endMs = Date.parse(`${cleanDate}T${hms}+07:00`);
      return Number.isFinite(endMs) && nowMs > endMs;
    }

    const endOfDayMs = Date.parse(`${cleanDate}T23:59:59.999+07:00`);
    return Number.isFinite(endOfDayMs) && nowMs > endOfDayMs;
  }

  return false;
}

export function isPaymentDeadlinePassed(booking, nowMs = Date.now()) {
  if (!booking || booking.status === "paid" || booking.status === "cancelled") {
    return false;
  }
  if (booking.status === "expired" || booking.is_payment_expired === true) {
    return true;
  }
  const normalized = normalizeUtcIso(booking.expired_at);
  if (!normalized) return false;
  const expiresAtMs = Date.parse(normalized);
  if (!Number.isFinite(expiresAtMs)) return false;
  return nowMs > expiresAtMs;
}

// Only accept a provider session URL supplied by the backend and still eligible.
export function getOfficialPaymentUrl(booking, event = null, tickets = [], nowMs = Date.now()) {
  if (!booking || booking.status !== "pending_payment") return null;
  if (booking.can_pay === false) return null;
  if (booking.is_event_ended === true || isEventOfficiallyEnded(event, tickets, nowMs)) {
    return null;
  }
  if (isPaymentDeadlinePassed(booking, nowMs)) return null;
  if (event?.status && event.status !== "on_sale") return null;
  return extractValidatedMidtransUrl(booking);
}

export function resolveOrderPaymentState(booking, event = null, tickets = [], nowMs = Date.now()) {
  const ended = Boolean(
    booking?.is_event_ended === true || isEventOfficiallyEnded(event, tickets, nowMs)
  );
  const deadlinePassed = isPaymentDeadlinePassed(booking, nowMs);
  const rawStatus = booking?.status;

  if (rawStatus === "paid") {
    return {
      code: "paid",
      label: "Dibayar",
      description: null,
      badgeClass: BADGE_STYLES.paid,
      canPay: false,
      canCancel: false,
      canSyncPayment: false,
      showDeadline: false,
      isEventEnded: ended,
      paymentUrl: null,
    };
  }

  if (rawStatus === "cancelled") {
    return {
      code: "cancelled",
      label: "Pesanan Dibatalkan",
      description: "Pesanan ini telah dibatalkan.",
      badgeClass: BADGE_STYLES.cancelled,
      canPay: false,
      canCancel: false,
      canSyncPayment: false,
      showDeadline: false,
      isEventEnded: ended,
      paymentUrl: null,
    };
  }

  if (rawStatus === "denied") {
    return {
      code: "denied",
      label: "Pembayaran Ditolak",
      description: "Pembayaran untuk pesanan ini ditolak oleh penyedia pembayaran.",
      badgeClass: BADGE_STYLES.denied,
      canPay: false,
      canCancel: false,
      canSyncPayment: false,
      showDeadline: false,
      isEventEnded: ended,
      paymentUrl: null,
    };
  }

  if (rawStatus === "refunded") {
    return {
      code: "refunded",
      label: "Dana Dikembalikan",
      description: "Dana untuk pesanan ini telah dikembalikan.",
      badgeClass: BADGE_STYLES.refunded,
      canPay: false,
      canCancel: false,
      canSyncPayment: false,
      showDeadline: false,
      isEventEnded: ended,
      paymentUrl: null,
    };
  }

  if (ended || booking?.effective_payment_status === "event_ended") {
    return {
      code: "event_ended",
      label: "Acara Selesai",
      description: "Pesanan ini belum dibayar dan acara telah berakhir.",
      badgeClass: BADGE_STYLES.event_ended,
      canPay: false,
      canCancel: false,
      canSyncPayment: false,
      showDeadline: false,
      isEventEnded: true,
      paymentUrl: null,
    };
  }

  if (deadlinePassed || booking?.effective_payment_status === "expired") {
    return {
      code: "expired",
      label: "Pembayaran Kedaluwarsa",
      description: "Batas waktu pembayaran telah habis.",
      badgeClass: BADGE_STYLES.expired,
      canPay: false,
      canCancel: false,
      canSyncPayment: false,
      showDeadline: false,
      isEventEnded: false,
      paymentUrl: null,
    };
  }

  if (
    (event?.status && event.status !== "on_sale") ||
    booking?.is_event_bookable === false ||
    booking?.effective_payment_status === "sales_closed"
  ) {
    return {
      code: "sales_closed",
      label: "Penjualan Ditutup",
      description: "Penjualan tiket untuk acara ini sedang tidak tersedia.",
      badgeClass: BADGE_STYLES.sales_closed,
      canPay: false,
      canCancel: false,
      canSyncPayment: false,
      showDeadline: false,
      isEventEnded: false,
      paymentUrl: null,
    };
  }

  const paymentUrl = getOfficialPaymentUrl(booking, event, tickets, nowMs);
  return {
    code: "pending_payment",
    label: "Menunggu Pembayaran",
    description: null,
    badgeClass: BADGE_STYLES.pending_payment,
    canPay: booking?.can_pay !== false && Boolean(paymentUrl),
    canCancel: booking?.can_cancel !== false && rawStatus === "pending_payment",
    canSyncPayment: rawStatus === "pending_payment",
    showDeadline: Boolean(booking?.expired_at),
    isEventEnded: false,
    paymentUrl,
  };
}

export function getTicketDisplayStatus(booking, ticket, event = null, nowMs = Date.now()) {
  if (booking?.status === "cancelled") return "cancelled";
  if (booking?.status !== "paid") {
    const orderState = resolveOrderPaymentState(
      booking,
      event,
      ticket ? [ticket] : [],
      nowMs
    );
    if (orderState.code === "event_ended") return "event_ended";
    if (orderState.code === "expired") return "expired";
    if (orderState.code === "cancelled") return "cancelled";
    if (orderState.code === "sales_closed") return "sales_closed";
    return "pending_payment";
  }
  if (ticket?.status === "used" || ticket?.checked_in_at) return "used";
  if (isEventOfficiallyEnded(event, ticket ? [ticket] : [], nowMs)) return "event_ended";
  if (ticket?.status === "cancelled") return "cancelled";
  return ticket?.status || "unknown";
}

export function formatWibTime(rawUtcIso) {
  const normalized = normalizeUtcIso(rawUtcIso);
  if (!normalized) return "-";
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

export function formatWibDateTime(rawUtcIso) {
  const normalized = normalizeUtcIso(rawUtcIso);
  if (!normalized) return "-";
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "-";
  const datePart = parsed.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  const timePart = parsed.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
  return `${timePart} WIB (${datePart})`;
}
