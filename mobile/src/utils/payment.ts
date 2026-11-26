import { Platform } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Booking, EventItem, PaymentMethodId, TicketItem, User } from '../types';
import { isEventOfficiallyEnded, normalizeUtcIso } from './formatters';

export interface PaymentMethodOption {
  id: PaymentMethodId;
  label: string;
  description: string;
}

export const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  {
    id: 'transfer_bank',
    label: 'Transfer Bank',
    description: 'Melalui Midtrans Payment Gateway',
  },
  {
    id: 'virtual_account',
    label: 'Virtual Account',
    description: 'Konfirmasi otomatis via Midtrans',
  },
  {
    id: 'qris',
    label: 'QRIS',
    description: 'Scan dari e-wallet pilihan Anda',
  },
];

export type MidtransBrowserOutcome = {
  status: 'opened' | 'returned' | 'dismissed' | 'cancelled' | 'error';
  message?: string;
};

export function isMidtransProductionClient(): boolean {
  return process.env.EXPO_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true';
}

export function getPaymentMethodLabel(method?: string | null): string {
  if (!method) return '-';
  const raw = method.trim();
  const lower = raw.toLowerCase();

  switch (lower) {
    case 'transfer_bank':
      return 'Transfer Bank';
    case 'virtual_account':
      return 'Virtual Account';
    case 'qris':
    case 'other_qris':
      return 'QRIS';
    case 'gopay':
      return 'GoPay';
    case 'shopeepay':
      return 'ShopeePay';
    case 'echannel':
      return 'Mandiri Bill / Virtual Account';
    case 'permata':
    case 'permata_va':
      return 'Virtual Account Permata';
    case 'bca_va':
      return 'Virtual Account BCA';
    case 'bni_va':
      return 'Virtual Account BNI';
    case 'bri_va':
      return 'Virtual Account BRI';
    case 'cimb_va':
      return 'Virtual Account CIMB Niaga';
    case 'credit_card':
      return 'Kartu Kredit / Debit';
    case 'cstore':
      return 'Gerai Retail (Indomaret / Alfamart)';
    case 'akulaku':
      return 'Akulaku';
    case 'kredivo':
      return 'Kredivo';
    default: {
      if (lower.startsWith('bank_transfer:')) {
        const bankRaw = lower.split(':')[1] || '';
        if (bankRaw === 'permata') return 'Virtual Account Permata';
        if (bankRaw === 'cimb') return 'Virtual Account CIMB Niaga';
        const bank = bankRaw.toUpperCase();
        return bank ? `Virtual Account ${bank}` : 'Transfer Bank';
      }
      if (lower.startsWith('cstore:')) {
        const store = lower.split(':')[1];
        return store ? `Retail (${store.toUpperCase()})` : 'Gerai Retail';
      }
      return raw;
    }
  }
}

export type OrderPaymentStateCode =
  | 'paid'
  | 'cancelled'
  | 'denied'
  | 'refunded'
  | 'event_ended'
  | 'expired'
  | 'sales_closed'
  | 'pending_payment';

export interface OrderPaymentState {
  code: OrderPaymentStateCode;
  label: string;
  description: string | null;
  variant: 'success' | 'warning' | 'danger' | 'neutral';
  canPay: boolean;
  canCancel: boolean;
  canSyncPayment: boolean;
  showDeadline: boolean;
  isEventEnded: boolean;
  paymentUrl: string | null;
}

export function isPaymentDeadlinePassed(
  booking?: {
    status?: string | null;
    expired_at?: string | null;
    is_payment_expired?: boolean | null;
  } | null,
  nowMs: number = Date.now()
): boolean {
  if (!booking || booking.status === 'paid' || booking.status === 'cancelled') {
    return false;
  }
  if (booking.status === 'expired' || booking.is_payment_expired === true) {
    return true;
  }
  const normalized = normalizeUtcIso(booking.expired_at);
  if (!normalized) return false;
  const expiresAtMs = Date.parse(normalized);
  if (!Number.isFinite(expiresAtMs)) return false;
  return nowMs > expiresAtMs;
}

function extractValidatedMidtransUrl(
  booking:
    | {
        status?: string | null;
        payment_url?: string | null;
        booking_code?: string | null;
      }
    | null
    | undefined
): string | null {
  if (booking?.status !== 'pending_payment' || typeof booking.payment_url !== 'string') {
    return null;
  }

  try {
    const url = new URL(booking.payment_url);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) {
      return null;
    }

    const allowedHosts = isMidtransProductionClient()
      ? ['app.midtrans.com']
      : ['app.sandbox.midtrans.com'];

    if (!allowedHosts.includes(url.hostname)) {
      return null;
    }

    const match = url.pathname.match(
      /^\/snap\/v[1-4]\/(?:vtweb|redirection)\/([^/]+)\/?$/
    );
    if (!match) {
      return null;
    }

    const session = decodeURIComponent(match[1]);
    const hasControlChars = [...session].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127
    );

    if (
      !session.trim() ||
      /[\s/\\?#]/.test(session) ||
      hasControlChars ||
      session === booking.booking_code
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

/**
 * Validates that payment_url is a real Midtrans Snap session URL returned by Backend
 * and still eligible for payment.
 */
export function getOfficialPaymentUrl(
  booking:
    | (Partial<Booking> & {
        status?: string | null;
        payment_url?: string | null;
        booking_code?: string | null;
      })
    | null
    | undefined,
  event: Partial<EventItem> | null = null,
  tickets: Partial<TicketItem>[] = [],
  nowMs: number = Date.now()
): string | null {
  if (!booking || booking.status !== 'pending_payment') return null;
  if (booking.can_pay === false) return null;
  if (booking.is_event_ended === true || isEventOfficiallyEnded(event, tickets, nowMs)) {
    return null;
  }
  if (isPaymentDeadlinePassed(booking, nowMs)) return null;
  if (event?.status && event.status !== 'on_sale') return null;
  return extractValidatedMidtransUrl(booking);
}

export function resolveOrderPaymentState(
  booking: Partial<Booking> | null | undefined,
  event: Partial<EventItem> | null = null,
  tickets: Partial<TicketItem>[] = [],
  nowMs: number = Date.now()
): OrderPaymentState {
  const ended = Boolean(
    booking?.is_event_ended === true || isEventOfficiallyEnded(event, tickets, nowMs)
  );
  const deadlinePassed = isPaymentDeadlinePassed(booking, nowMs);
  const rawStatus = booking?.status;

  if (rawStatus === 'paid') {
    return {
      code: 'paid',
      label: 'Dibayar',
      description: null,
      variant: 'success',
      canPay: false,
      canCancel: false,
      canSyncPayment: false,
      showDeadline: false,
      isEventEnded: ended,
      paymentUrl: null,
    };
  }

  if (rawStatus === 'cancelled') {
    return {
      code: 'cancelled',
      label: 'Pesanan Dibatalkan',
      description: 'Pesanan ini telah dibatalkan.',
      variant: 'neutral',
      canPay: false,
      canCancel: false,
      canSyncPayment: false,
      showDeadline: false,
      isEventEnded: ended,
      paymentUrl: null,
    };
  }

  if (rawStatus === 'denied') {
    return {
      code: 'denied',
      label: 'Pembayaran Ditolak',
      description: 'Pembayaran untuk pesanan ini ditolak oleh penyedia pembayaran.',
      variant: 'danger',
      canPay: false,
      canCancel: false,
      canSyncPayment: false,
      showDeadline: false,
      isEventEnded: ended,
      paymentUrl: null,
    };
  }

  if (rawStatus === 'refunded') {
    return {
      code: 'refunded',
      label: 'Dana Dikembalikan',
      description: 'Dana untuk pesanan ini telah dikembalikan.',
      variant: 'neutral',
      canPay: false,
      canCancel: false,
      canSyncPayment: false,
      showDeadline: false,
      isEventEnded: ended,
      paymentUrl: null,
    };
  }

  if (ended || booking?.effective_payment_status === 'event_ended') {
    return {
      code: 'event_ended',
      label: 'Acara Selesai',
      description: 'Pesanan ini belum dibayar dan acara telah berakhir.',
      variant: 'neutral',
      canPay: false,
      canCancel: false,
      canSyncPayment: false,
      showDeadline: false,
      isEventEnded: true,
      paymentUrl: null,
    };
  }

  if (deadlinePassed || booking?.effective_payment_status === 'expired') {
    return {
      code: 'expired',
      label: 'Pembayaran Kedaluwarsa',
      description: 'Batas waktu pembayaran telah habis.',
      variant: 'neutral',
      canPay: false,
      canCancel: false,
      canSyncPayment: false,
      showDeadline: false,
      isEventEnded: false,
      paymentUrl: null,
    };
  }

  if (
    (event?.status && event.status !== 'on_sale') ||
    booking?.is_event_bookable === false ||
    booking?.effective_payment_status === 'sales_closed'
  ) {
    return {
      code: 'sales_closed',
      label: 'Penjualan Ditutup',
      description: 'Penjualan tiket untuk acara ini sedang tidak tersedia.',
      variant: 'neutral',
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
    code: 'pending_payment',
    label: 'Menunggu Pembayaran',
    description: null,
    variant: 'warning',
    canPay: booking?.can_pay !== false && Boolean(paymentUrl),
    canCancel: booking?.can_cancel !== false && rawStatus === 'pending_payment',
    canSyncPayment: rawStatus === 'pending_payment',
    showDeadline: Boolean(booking?.expired_at),
    isEventEnded: false,
    paymentUrl,
  };
}

export function resolveTicketDisplayStatus(
  booking: Partial<Booking> | null | undefined,
  ticket: Partial<TicketItem> | null | undefined,
  event: Partial<EventItem> | null = null,
  nowMs: number = Date.now()
): string {
  if (booking?.status === 'cancelled') return 'cancelled';
  if (booking?.status !== 'paid') {
    const orderState = resolveOrderPaymentState(booking, event, ticket ? [ticket] : [], nowMs);
    if (orderState.code === 'event_ended') return 'event_ended';
    if (orderState.code === 'expired') return 'expired';
    if (orderState.code === 'cancelled') return 'cancelled';
    if (orderState.code === 'sales_closed') return 'sales_closed';
    return 'pending_payment';
  }
  if (ticket?.status === 'used' || ticket?.checked_in_at) return 'used';
  if (isEventOfficiallyEnded(event, ticket ? [ticket] : [], nowMs)) return 'event_ended';
  if (ticket?.status === 'cancelled') return 'cancelled';
  return ticket?.status || 'valid';
}

export function buildMobilePaymentReturnUrl(input: {
  platformOs: string;
  webOrigin?: string | null;
  nativeDeepLinkUrl?: string | null;
}): string | undefined {
  if (input.platformOs === 'web') {
    const rawOrigin = (input.webOrigin || '').trim().replace(/\/+$/, '');
    if (/^https?:\/\/[^\s]+$/i.test(rawOrigin)) {
      return `${rawOrigin}/payment/finish`;
    }
    return undefined;
  }

  const rawNative = (input.nativeDeepLinkUrl || '').trim();
  if (
    rawNative &&
    !/\s/.test(rawNative) &&
    /^(ticketwavemobile|exps?|https?):\/\//i.test(rawNative)
  ) {
    return rawNative;
  }
  return undefined;
}

export function getMobilePaymentReturnUrl(): string | undefined {
  if (Platform.OS === 'web') {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : null;
    return buildMobilePaymentReturnUrl({
      platformOs: 'web',
      webOrigin: origin,
    });
  }

  try {
    const nativeUrl = ExpoLinking.createURL('/payment/finish');
    return buildMobilePaymentReturnUrl({
      platformOs: Platform.OS,
      nativeDeepLinkUrl: nativeUrl,
    });
  } catch {
    return 'ticketwavemobile://payment/finish';
  }
}

/**
 * Opens an already-validated official Midtrans Snap URL via expo-web-browser
 * (SFSafariViewController on iOS, Chrome Custom Tabs on Android).
 * On native, uses openAuthSessionAsync when returnUrl is available so returning
 * from the Backend /api/checkout/payment/return bridge automatically closes the
 * browser tab and lands back on the same order screen.
 * Never treats closing/returning from the browser as payment settlement.
 */
export async function openMidtransPaymentBrowser(
  officialUrl: string,
  returnUrl?: string | null
): Promise<MidtransBrowserOutcome> {
  const browserOptions: WebBrowser.WebBrowserOpenOptions = {
    toolbarColor: '#0B0F17',
    controlsColor: '#06B6D4',
    dismissButtonStyle: 'close',
    showTitle: true,
    enableBarCollapsing: true,
    createTask: false,
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    windowName: '_blank',
  };

  try {
    if (
      Platform.OS !== 'web' &&
      returnUrl &&
      typeof WebBrowser.openAuthSessionAsync === 'function'
    ) {
      const authResult = await WebBrowser.openAuthSessionAsync(
        officialUrl,
        returnUrl,
        browserOptions
      );

      if (authResult.type === 'success') {
        return { status: 'returned' };
      }
      switch (authResult.type) {
        case WebBrowser.WebBrowserResultType.OPENED:
          return { status: 'opened' };
        case WebBrowser.WebBrowserResultType.DISMISS:
          return { status: 'dismissed' };
        case WebBrowser.WebBrowserResultType.CANCEL:
          return { status: 'cancelled' };
        case WebBrowser.WebBrowserResultType.LOCKED:
          return {
            status: 'error',
            message:
              'Browser pembayaran sedang terkunci atau sudah terbuka. Silakan lanjutkan dari detail pesanan.',
          };
        default:
          return { status: 'dismissed' };
      }
    }

    const result = await WebBrowser.openBrowserAsync(officialUrl, browserOptions);

    switch (result.type) {
      case WebBrowser.WebBrowserResultType.OPENED:
        return { status: 'opened' };
      case WebBrowser.WebBrowserResultType.DISMISS:
        return { status: 'dismissed' };
      case WebBrowser.WebBrowserResultType.CANCEL:
        return { status: 'cancelled' };
      case WebBrowser.WebBrowserResultType.LOCKED:
        return {
          status: 'error',
          message:
            'Browser pembayaran sedang terkunci atau sudah terbuka. Silakan lanjutkan dari detail pesanan.',
        };
      default:
        return { status: 'dismissed' };
    }
  } catch {
    return {
      status: 'error',
      message:
        'Gagal membuka halaman pembayaran Midtrans. Anda dapat membuka kembali tautan dari detail pesanan.',
    };
  }
}

/**
 * Determines whether the authenticated user can invoke POST /api/checkout/<code>/sync-payment-status
 * in Sandbox mode, matching Backend ownership rules (ISSUE-04 compatibility).
 */
export function canUserSyncBookingPayment(
  booking: Partial<Booking> | null | undefined,
  user: User | null | undefined,
  isAuthenticated: boolean,
  hasGuestToken: boolean = false
): boolean {
  if (!booking || booking.status !== 'pending_payment') {
    return false;
  }
  if (isMidtransProductionClient()) {
    return false;
  }
  if (booking.user_id == null && hasGuestToken) {
    return true;
  }
  if (!isAuthenticated || !user) {
    return false;
  }
  if (user.role === 'admin') {
    return true;
  }
  if (booking.user_id != null) {
    return Number(booking.user_id) === Number(user.id);
  }
  return Boolean(
    user.email &&
      booking.buyer_email &&
      user.email.trim().toLowerCase() === booking.buyer_email.trim().toLowerCase()
  );
}
