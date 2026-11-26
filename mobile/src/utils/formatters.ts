export function formatRupiah(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '' || isNaN(Number(amount))) {
    return 'TBA';
  }
  return 'Rp' + Number(amount).toLocaleString('id-ID');
}

function parseDateValue(isoString: string): Date | null {
  const trimmed = isoString.trim();
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const normalized = normalizeUtcIso(trimmed) || trimmed;
  const parsed = new Date(normalized);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeUtcIso(rawIso?: string | null): string | null {
  if (typeof rawIso !== 'string' || !rawIso.trim()) return null;
  const trimmed = rawIso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return /Z$|[+-]\d{2}:?\d{2}$/.test(trimmed) ? trimmed : `${trimmed}Z`;
}

export function formatTanggal(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  try {
    const date = parseDateValue(isoString);
    if (!date) return isoString;
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export function formatTanggalSingkat(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  try {
    const date = parseDateValue(isoString);
    if (!date) return isoString;
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export function formatWaktu(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  // e.g. "19:00:00" -> "19:00 WIB"
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]} WIB`;
  }
  return timeStr;
}

export function formatWibDateTime(rawIso?: string | null): string {
  const norm = normalizeUtcIso(rawIso);
  if (!norm) return '-';
  try {
    const date = new Date(norm);
    if (isNaN(date.getTime())) return String(rawIso);
    const formatted = date.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return `${formatted} WIB`;
  } catch {
    const fallback = new Date(norm);
    return isNaN(fallback.getTime()) ? String(rawIso) : `${fallback.toLocaleString('id-ID')} WIB`;
  }
}

export function formatWibTime(rawIso?: string | Date | null): string {
  if (!rawIso) return '-';
  try {
    const date = rawIso instanceof Date ? rawIso : new Date(normalizeUtcIso(rawIso) || rawIso);
    if (isNaN(date.getTime())) return String(rawIso);
    return `${date.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })} WIB`;
  } catch {
    return rawIso instanceof Date ? rawIso.toLocaleTimeString('id-ID') : String(rawIso);
  }
}

export function getTodayWibYmd(now: Date = new Date()): string {
  try {
    // en-CA formats reliably as YYYY-MM-DD
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    if (/^\d{4}-\d{2}-\d{2}$/.test(parts)) return parts;
  } catch {}
  const wibMs = now.getTime() + 7 * 60 * 60 * 1000;
  return new Date(wibMs).toISOString().slice(0, 10);
}

export function isEventOfficiallyEnded(
  event?: {
    is_event_ended?: boolean | null;
    status?: string | null;
    event_type?: string | null;
    event_date?: string | null;
    event_end_time?: string | null;
  } | null,
  tickets: { is_event_ended?: boolean | null }[] = [],
  nowMs: number = Date.now()
): boolean {
  if (event?.is_event_ended === true) return true;
  if (Array.isArray(tickets) && tickets.some((t) => t?.is_event_ended === true)) {
    return true;
  }
  if (event?.status && ['finished', 'archived'].includes(event.status)) {
    return true;
  }
  if (
    event?.event_type !== 'festival' &&
    typeof event?.event_date === 'string' &&
    /^\d{4}-\d{2}-\d{2}/.test(event.event_date.trim())
  ) {
    const cleanDate = event.event_date.trim().slice(0, 10);
    const rawEndTime =
      typeof event?.event_end_time === 'string' ? event.event_end_time.trim() : '';

    if (/^\d{2}:\d{2}(:\d{2})?$/.test(rawEndTime)) {
      const hms = rawEndTime.length === 5 ? `${rawEndTime}:00` : rawEndTime;
      const endMs = Date.parse(`${cleanDate}T${hms}+07:00`);
      if (Number.isFinite(endMs)) return nowMs > endMs;
    }

    const endOfDayMs = Date.parse(`${cleanDate}T23:59:59.999+07:00`);
    if (Number.isFinite(endOfDayMs)) return nowMs > endOfDayMs;
  }
  return false;
}

export function isEventPast(
  event?: {
    is_event_ended?: boolean | null;
    event_type?: string | null;
    event_date?: string | null;
    event_end_time?: string | null;
    status?: string | null;
  } | null,
  todayYmdOrNow?: string | number
): boolean {
  if (!event) return false;
  if (typeof todayYmdOrNow === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(todayYmdOrNow)) {
    if (event.is_event_ended === true) return true;
    if (event.status === 'finished' || event.status === 'archived') return true;
    if (!event.event_date) return false;
    const datePart = String(event.event_date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return false;
    return datePart < todayYmdOrNow;
  }
  const nowMs = typeof todayYmdOrNow === 'number' ? todayYmdOrNow : Date.now();
  return isEventOfficiallyEnded(event, [], nowMs);
}

export function isEventPurchasable(
  event?: {
    status?: string | null;
    is_event_ended?: boolean | null;
    event_type?: string | null;
    event_date?: string | null;
    event_end_time?: string | null;
  } | null,
  todayYmdOrNow?: string | number
): boolean {
  return event?.status === 'on_sale' && !isEventPast(event, todayYmdOrNow);
}

export function formatEventSchedule(
  event?: {
    event_type?: string | null;
    event_date?: string | null;
    event_time?: string | null;
    event_end_time?: string | null;
    days_count?: number | null;
  } | null,
  options?: { short?: boolean; includeTime?: boolean }
): string {
  const short = options?.short ?? false;
  const includeTime = options?.includeTime ?? true;
  if (event?.event_date) {
    const dateLabel = short
      ? formatTanggalSingkat(event.event_date)
      : formatTanggal(event.event_date);
    if (includeTime && event.event_time) {
      const startTime = formatWaktu(event.event_time);
      if (event.event_end_time) {
        const parts = event.event_end_time.split(':');
        const endShort = parts.length >= 2 ? `${parts[0]}:${parts[1]}` : event.event_end_time;
        const startShort = event.event_time.slice(0, 5);
        return `${dateLabel} • ${startShort} – ${endShort} WIB`;
      }
      return `${dateLabel} • ${startTime}`;
    }
    return dateLabel;
  }
  if (event?.event_type === 'festival') {
    return `Festival ${event.days_count || 1} Hari`;
  }
  return 'Jadwal Segera';
}

export function effectiveTicketPrice(
  tt?: {
    base_price?: number | string | null;
    final_price?: number | string | null;
    active_phase?: { discount_percent?: number | string | null } | null;
  } | null
): number {
  if (tt?.final_price !== null && tt?.final_price !== undefined && tt.final_price !== '') {
    const fin = Number(tt.final_price);
    if (Number.isFinite(fin) && fin >= 0) return fin;
  }
  const base = Number(tt?.base_price ?? 0);
  if (tt?.active_phase && tt.active_phase.discount_percent != null) {
    const discount = Number(tt.active_phase.discount_percent);
    if (Number.isFinite(base) && Number.isFinite(discount) && discount >= 0 && discount <= 100) {
      return Math.round(base * (1 - discount / 100));
    }
  }
  return Number.isFinite(base) && base >= 0 ? base : 0;
}

export function isTicketQrEligible(
  bookingStatus?: string | null,
  ticket?: { status?: string | null; qr_token?: string | null; is_event_ended?: boolean | null } | null,
  event?: {
    is_event_ended?: boolean | null;
    status?: string | null;
    event_type?: string | null;
    event_date?: string | null;
    event_end_time?: string | null;
  } | null
): boolean {
  if (bookingStatus !== 'paid') return false;
  if (!ticket) return false;
  if (ticket.status !== 'valid') return false;
  if (ticket.is_event_ended === true || isEventOfficiallyEnded(event, [ticket])) return false;
  return Boolean(typeof ticket.qr_token === 'string' && ticket.qr_token.trim().length > 0);
}

export function getOfficerStatusBadgeVariant(
  status?: string | null
): 'success' | 'warning' | 'danger' | 'neutral' {
  const s = String(status || '').trim().toUpperCase();
  if (!s) return 'neutral';
  if (
    s.includes('TIDAK') ||
    s.includes('DIBATALKAN') ||
    s.includes('GAGAL') ||
    s.includes('BELUM TERKONFIRMASI')
  ) {
    return 'danger';
  }
  if (s.includes('SUDAH') || s.includes('USED')) {
    return 'warning';
  }
  if (s === 'VALID' || s === 'CHECK-IN SELESAI') {
    return 'success';
  }
  return 'neutral';
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'on_sale':
      return 'On Sale';
    case 'published':
      return 'Published';
    case 'draft':
      return 'Draft';
    case 'sales_closed':
      return 'Penjualan Ditutup';
    case 'ongoing':
      return 'Ongoing';
    case 'finished':
      return 'Finished';
    case 'archived':
      return 'Archived';
    case 'paid':
      return 'Dibayar';
    case 'pending_payment':
      return 'Menunggu Pembayaran';
    case 'cancelled':
      return 'Pesanan Dibatalkan';
    case 'expired':
      return 'Pembayaran Kedaluwarsa';
    case 'event_ended':
      return 'Acara Selesai';
    case 'denied':
      return 'Pembayaran Ditolak';
    case 'refunded':
      return 'Dana Dikembalikan';
    case 'failed':
      return 'Gagal';
    case 'valid':
      return 'Valid / Aktif';
    case 'used':
      return 'Sudah Digunakan';
    default:
      return status;
  }
}

/**
 * Returns the effective display status of a ticket based on its parent booking and event status.
 * Matches Next.js web behavior.
 */
export function getTicketDisplayStatus(
  bookingStatus?: string | null,
  ticketStatus?: string | null,
  isEventEnded?: boolean
): string {
  if (bookingStatus === 'cancelled') return 'cancelled';
  if (bookingStatus === 'paid') {
    if (ticketStatus === 'used') return 'used';
    if (isEventEnded) return 'event_ended';
    return ticketStatus || 'valid';
  }
  if (isEventEnded) return 'event_ended';
  if (
    bookingStatus &&
    ['cancelled', 'expired', 'denied', 'refunded', 'failed', 'sales_closed'].includes(bookingStatus)
  ) {
    return bookingStatus;
  }
  return 'pending_payment';
}

