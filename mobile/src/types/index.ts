export interface User {
  id: number;
  email: string;
  name: string;
  phone?: string;
  role: 'admin' | 'officer' | 'user';
  email_verified: boolean;
  assigned_gate?: string;
  shift?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Agency {
  id: number;
  name: string;
  pic_name: string;
  email: string;
  phone: string;
  address?: string | null;
  logo_url?: string | null;
  has_officer_account?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TicketPhase {
  id: number;
  ticket_type_id: number;
  phase_name: 'early_bird' | 'presale' | 'normal';
  start_date: string;
  end_date: string;
  discount_percent: number;
  created_at?: string;
}

export interface TicketType {
  id: number;
  event_id: number;
  name: string;
  base_price: number;
  quota: number;
  sold_count: number;
  description?: string | null;
  active_phase?: {
    phase_name: string;
    discount_percent: number;
    end_date?: string | null;
  } | null;
  final_price?: number;
  discount_amount?: number;
  stock_available?: number;
  phases?: TicketPhase[];
  created_at?: string;
}

export interface FestivalArtist {
  id: number;
  event_id: number;
  day_number: number;
  artist_name: string;
  name?: string;
  day?: number;
}

export type EventStatus =
  | 'draft'
  | 'published'
  | 'on_sale'
  | 'sales_closed'
  | 'ongoing'
  | 'finished'
  | 'archived';

export interface EventItem {
  id: number;
  name: string;
  event_type: 'single' | 'festival';
  agency_id: number;
  agency?: Agency;
  venue: string;
  city: string;
  description?: string | null;
  poster_url?: string | null;
  banner_url?: string | null;
  status: EventStatus;
  artist_name?: string | null;
  event_date?: string | null;
  event_time?: string | null;
  event_end_time?: string | null;
  is_event_ended?: boolean;
  is_event_bookable?: boolean;
  days_count?: number | null;
  price_from?: number | null;
  total_quota?: number;
  sold_count?: number;
  ticket_types_count?: number;
  festival_artists?: FestivalArtist[];
  ticket_types?: TicketType[];
  created_at?: string;
  updated_at?: string;
}

export interface EventDetailResponse {
  event: EventItem;
  agency?: Agency | null;
  lineup?: FestivalArtist[];
  ticket_types: TicketType[];
}

export type TicketStatus =
  | 'valid'
  | 'used'
  | 'cancelled'
  | 'aktif'
  | 'checked_in'
  | 'dibatalkan'
  | (string & {});

export interface TicketItem {
  id: number;
  booking_id: number;
  ticket_code: string;
  qr_token: string;
  status: TicketStatus;
  checked_in_at?: string | null;
  checked_in_by?: string | null;
  created_at?: string;
  booking_code?: string;
  booking_status?: BookingStatus;
  buyer_name?: string;
  attendee_name?: string;
  recipient_email?: string;
  event_id?: number;
  event_name?: string;
  event_type?: 'single' | 'festival' | null;
  days_count?: number | null;
  poster_url?: string | null;
  city?: string;
  artist_name?: string;
  venue?: string;
  event_date?: string | null;
  event_time?: string | null;
  event_end_time?: string | null;
  is_event_ended?: boolean;
  ticket_type_name?: string;
}

export type PaymentMethodId = 'transfer_bank' | 'virtual_account' | 'qris';

export type BookingStatus =
  | 'pending_payment'
  | 'paid'
  | 'cancelled'
  | 'expired'
  | 'denied'
  | 'refunded'
  | 'failed'
  | 'lunas'
  | 'dibatalkan'
  | (string & {});

export interface Booking {
  id: number;
  booking_code: string;
  user_id?: number | null;
  event_id: number;
  ticket_type_id: number;
  ticket_phase_id?: number | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount?: number;
  total_price: number;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  recipient_email?: string | null;
  status: BookingStatus;
  effective_payment_status?: string;
  is_payment_expired?: boolean;
  is_event_ended?: boolean;
  is_event_bookable?: boolean;
  can_pay?: boolean;
  can_cancel?: boolean;
  payment_method?: string | null;
  payment_url?: string | null;
  expired_at: string;
  created_at?: string;
}

export interface BookingDetailResponse {
  booking: Booking;
  event: EventItem;
  ticket_type: TicketType;
  tickets: TicketItem[];
  guest_access_token?: string;
}

export interface CheckoutPayload {
  event_id: number;
  ticket_type_id: number;
  quantity: number;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  recipient_email?: string;
  payment_method: PaymentMethodId;
  return_url?: string;
}

export interface SyncPaymentStatusResponse {
  booking: Booking;
  transaction?: {
    id: number;
    status: string;
    payment_method?: string | null;
    external_id?: string | null;
    paid_at?: string | null;
  } | null;
  synced?: boolean;
  midtrans_transaction_status?: string;
  message?: string;
}

export interface SavedBookingEntry {
  booking_code: string;
  guest_token?: string | null;
  payment_url?: string | null;
  recipient_email?: string | null;
  event_name?: string;
  saved_at?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[] | string> | null;
}

// ---------- OFFICER SCAN TYPES ----------
export interface OfficerScanStats {
  checked_in: number;
  valid_or_used: number;
  total_checked?: number;
  rejected_count?: number;
}

export type ScanTicketStatus =
  | 'VALID'
  | 'SUDAH DIGUNAKAN'
  | 'DIBATALKAN'
  | 'TIDAK VALID'
  | 'GAGAL MEMERIKSA'
  | 'CHECK-IN SELESAI'
  | 'CHECK-IN BELUM TERKONFIRMASI'
  | string;

export interface ScanResult {
  success: boolean;
  status: ScanTicketStatus;
  code?: string;
  message?: string;
  ticket?: Partial<TicketItem> | null;
  first_checked_in_at?: string;
  first_checked_in_by?: string;
  server_verified?: boolean;
}

export interface ScanHistoryItem {
  id: string;
  ticket_code: string;
  booking_code?: string;
  event_name?: string;
  buyer_name?: string;
  attendee_name?: string;
  ticket_type?: string;
  ticket_type_name?: string;
  officer_name?: string;
  timestamp?: string;
  scanned_at?: string;
  status?: string;
}
