"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  CreditCard,
  Search,
  RefreshCw,
  Ticket,
  QrCode,
  Info,
  ArrowRight,
  Clock,
} from "lucide-react";
import api from "@/app/lib/api";
import { useAuth } from "@/app/context/AuthContext";
import TicketQrModal from "@/app/components/user/TicketQrModal";
import {
  formatWibTime,
  getTicketDisplayStatus,
  resolveOrderPaymentState,
} from "@/app/lib/payment";
import {
  fetchAllSavedBookings,
  fetchMyBookings,
  getGuestTokenForBooking,
  saveBookingEntry,
} from "@/app/lib/bookingStorage";

export default function PesananPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const isAccountHistory = Boolean(isAuthenticated && user && user.role !== "officer");

  const [bookings, setBookings] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");

  const [lookupCode, setLookupCode] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState(null);
  const [cancellingCode, setCancellingCode] = useState(null);
  const [qrModalData, setQrModalData] = useState(null);
  const [nowMs, setNowMs] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadBookings = useCallback(async () => {
    if (authLoading) return;
    await Promise.resolve();
    setLoading(true);
    setLoadError(null);
    try {
      const results = isAccountHistory
        ? await fetchMyBookings()
        : await fetchAllSavedBookings();
      setBookings(results.bookings);
      setLoadError(
        results.errors.length
          ? `${results.errors.length} dari ${results.total} kode gagal dimuat. Daftar dan jumlah hanya mencakup hasil yang berhasil dimuat. ${results.errors
              .map(
                (error) =>
                  `${error.booking_code}: ${error.message}${
                    error.status ? ` (HTTP ${error.status})` : ""
                  }`
              )
              .join("; ")} Gunakan Segarkan Status untuk mencoba lagi.`
          : null
      );
    } catch (err) {
      setBookings([]);
      setLoadError(err.message || "Gagal memuat pesanan dari server.");
    } finally {
      setLoading(false);
    }
  }, [authLoading, isAccountHistory]);

  useEffect(() => {
    if (authLoading) return undefined;
    const t = setTimeout(() => {
      loadBookings();
    }, 0);
    return () => clearTimeout(t);
  }, [authLoading, loadBookings]);

  const handleLookupSubmit = async (e) => {
    e.preventDefault();
    const code = lookupCode.trim().toUpperCase();
    const buyerEmail = lookupEmail.trim();
    if (!code) return;

    setLookupLoading(true);
    setLookupMessage(null);
    try {
      const savedToken = getGuestTokenForBooking(code);
      const headers = {};
      if (savedToken) headers["X-Guest-Token"] = savedToken;
      if (buyerEmail) headers["X-Buyer-Email"] = buyerEmail;
      const res = await api.get(
        `/checkout/${encodeURIComponent(code)}`,
        {},
        Object.keys(headers).length ? { headers } : {}
      );
      if (!res.success || !res.data?.booking) {
        throw new Error(res.message || "Respons pesanan tidak valid.");
      }
      if (res.data?.booking) {
        saveBookingEntry({
          booking_code: res.data.booking.booking_code,
          guest_token: res.data.guest_access_token || savedToken || null,
        });
        setLookupCode("");
        setLookupEmail("");
        setLookupMessage({
          type: "success",
          text: `Pesanan ${res.data.booking.booking_code} berhasil ditemukan dan dibuka.`,
        });
        await loadBookings();
      }
    } catch (err) {
      setLookupMessage({
        type: "error",
        text:
          err.message ||
          `Kode booking "${code}" tidak ditemukan atau membutuhkan verifikasi email/login.`,
      });
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCancelOrder = async (bookingCode) => {
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin membatalkan pesanan ${bookingCode}? Kuota tiket yang direservasi akan dikembalikan ke event.`
    );
    if (!confirmed) return;

    setCancellingCode(bookingCode);
    setLookupMessage(null);
    try {
      const guestToken = getGuestTokenForBooking(bookingCode);
      const res = await api.post(
        `/checkout/${encodeURIComponent(bookingCode)}/cancel`,
        {},
        guestToken ? { headers: { "X-Guest-Token": guestToken } } : {}
      );
      if (res?.success !== true || res.data?.booking?.status !== "cancelled") {
        throw new Error("Pembatalan belum dikonfirmasi server.");
      }
      setLookupMessage({
        type: "success",
        text: `Pesanan ${bookingCode} berhasil dibatalkan.`,
      });
      await loadBookings();
    } catch (err) {
      setLookupMessage({
        type: "error",
        text: err.message || `Gagal membatalkan pesanan ${bookingCode}.`,
      });
      await loadBookings();
    } finally {
      setCancellingCode(null);
    }
  };

  const formatRupiah = (n) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n || 0);

  const effectiveNowMs = nowMs ?? undefined;
  const enrichedBookings = bookings.map((item) => ({
    ...item,
    orderState: resolveOrderPaymentState(
      item.booking,
      item.event,
      item.tickets,
      effectiveNowMs
    ),
  }));

  const filteredBookings = enrichedBookings.filter((item) => {
    if (activeFilter === "all") return true;
    return item.orderState.code === activeFilter;
  });

  const filterTabs = [
    { id: "all", label: `Semua (${enrichedBookings.length})` },
    {
      id: "pending_payment",
      label: `Menunggu Pembayaran (${
        enrichedBookings.filter((item) => item.orderState.code === "pending_payment")
          .length
      })`,
    },
    {
      id: "paid",
      label: `Dibayar (${
        enrichedBookings.filter((item) => item.orderState.code === "paid").length
      })`,
    },
    {
      id: "expired",
      label: `Pembayaran Kedaluwarsa (${
        enrichedBookings.filter((item) => item.orderState.code === "expired").length
      })`,
    },
    {
      id: "event_ended",
      label: `Acara Selesai (${
        enrichedBookings.filter((item) => item.orderState.code === "event_ended").length
      })`,
    },
    {
      id: "cancelled",
      label: `Pesanan Dibatalkan (${
        enrichedBookings.filter((item) => item.orderState.code === "cancelled").length
      })`,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 transition-colors dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#0080f2]">
              Manajemen Transaksi
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {isAccountHistory ? "Riwayat Pesanan Akun" : "Pesanan Tersimpan di Perangkat"}
            </h1>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
              Lacak status pembayaran, batas waktu reservasi, dan e-ticket dari kode booking Anda secara real-time.
            </p>
          </div>

          <button
            type="button"
            onClick={loadBookings}
            disabled={loading}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-xs transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Segarkan Status
          </button>
        </div>

        {/* Lookup Bar */}
        <div className="mt-6 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Lacak atau Tambahkan Kode Booking
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Masukkan kode booking resmi (contoh: <code className="font-mono font-medium">TKTW-20260405-ABC123</code>). Untuk pesanan Guest lintas perangkat, sertakan email pembeli.
              </p>
            </div>

            <form
              onSubmit={handleLookupSubmit}
              className="flex w-full max-w-xl flex-col sm:flex-row items-stretch sm:items-center gap-2"
            >
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value)}
                  placeholder="TKTW-YYYYMMDD-XXXXXX"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 font-mono text-xs uppercase text-slate-900 outline-none transition focus:border-[#0080f2] focus:ring-1 focus:ring-[#0080f2] dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-[#0080f2]"
                />
              </div>
              <input
                type="email"
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
                placeholder="Email pembeli (opsional / Guest)"
                className="sm:w-52 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-[#0080f2] focus:ring-1 focus:ring-[#0080f2] dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-[#0080f2]"
              />
              <button
                type="submit"
                disabled={lookupLoading}
                className="shrink-0 rounded-xl bg-[#0080f2] px-4 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-[#0070d4] disabled:opacity-60"
              >
                {lookupLoading ? "Mencari..." : "Cek Pesanan"}
              </button>
            </form>
          </div>

          {lookupMessage && (
            <div className="mt-3 rounded-xl border border-slate-300 bg-slate-100 px-3.5 py-2.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {lookupMessage.text}
            </div>
          )}

          <div className="mt-3.5 flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
            <span>
              {isAccountHistory
                ? "Riwayat pesanan akun Anda disinkronkan langsung dari server (lintas perangkat) dan dapat dibuka kapan saja setelah login."
                : "Mode Guest menampilkan pesanan tersimpan di browser ini. Untuk membuka pesanan Guest di perangkat lain, masukkan kode booking beserta email pembelinya."}
            </span>
          </div>
        </div>

        {loadError && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-200 p-4 text-sm text-red-700 dark:text-red-300"
          >
            {loadError}
          </p>
        )}

        {/* Filter Tabs */}
        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-medium transition-colors ${
                activeFilter === tab.id
                  ? "bg-[#0080f2] text-white shadow-xs"
                  : "border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="mt-6 space-y-3">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="h-32 animate-pulse rounded-xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              />
            ))}
          </div>
        )}

        {/* Bookings List */}
        {!loading && filteredBookings.length > 0 && (
          <div className="mt-6 space-y-3.5">
            {filteredBookings.map(({ booking, event, ticket_type, tickets, orderState }) => {
              const modalTickets = (tickets || []).map((t) => ({
                ...t,
                status: getTicketDisplayStatus(booking, t, event, effectiveNowMs),
                booking_code: booking.booking_code,
                booking_status: booking.status,
                buyer_name: booking.buyer_name,
                event_name: event?.name || "Event TicketWave",
                ticket_type_name: ticket_type?.name || "Standard",
              }));
              const validTicket = modalTickets.find(
                (t) => t.status === "valid" && Boolean(t.qr_token)
              );
              const usedTicket = modalTickets.find((t) => t.status === "used");
              const endedTicket = modalTickets.find((t) => t.status === "event_ended");

              return (
                <div
                  key={booking.booking_code}
                  className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    {/* Left Section */}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                          {booking.booking_code}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${orderState.badgeClass}`}
                        >
                          {orderState.label}
                        </span>
                        {ticket_type?.name && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                            <Ticket size={12} />
                            {ticket_type.name} ({booking.quantity}x)
                          </span>
                        )}
                      </div>

                      <h3 className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                        {event?.name || "Event TicketWave"}
                      </h3>

                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                        {event?.event_date && (
                          <span className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-slate-400" />
                            {new Date(event.event_date).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                        )}
                        {event?.venue && (
                          <span className="flex items-center gap-1.5">
                            <MapPin size={13} className="text-slate-400" />
                            {event.venue}, {event.city}
                          </span>
                        )}
                        {orderState.showDeadline && booking.expired_at && (
                          <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400">
                            <Clock size={13} />
                            Batas bayar: {formatWibTime(booking.expired_at)} WIB
                          </span>
                        )}
                      </div>

                      {orderState.description &&
                        ["expired", "event_ended", "sales_closed"].includes(
                          orderState.code
                        ) && (
                          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                            {orderState.description}
                          </p>
                        )}
                    </div>

                    {/* Right Section */}
                    <div className="flex flex-col items-start justify-between gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center lg:flex-col lg:items-end lg:border-t-0 lg:pt-0 dark:border-slate-800">
                      <div className="lg:text-right">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Total ({booking.quantity} Tiket)
                        </p>
                        <p className="text-base font-bold text-[#0080f2]">
                          {formatRupiah(booking.total_price)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {orderState.canCancel && (
                          <button
                            type="button"
                            onClick={() => handleCancelOrder(booking.booking_code)}
                            disabled={cancellingCode === booking.booking_code}
                            className="rounded-xl border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            {cancellingCode === booking.booking_code
                              ? "Membatalkan..."
                              : "Batalkan"}
                          </button>
                        )}

                        {orderState.code === "paid" && validTicket && (
                          <button
                            type="button"
                            onClick={() =>
                              setQrModalData({
                                tickets: modalTickets,
                                initialTicketCode: validTicket.ticket_code,
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#0080f2] bg-blue-50/60 px-3.5 py-1.5 text-xs font-medium text-[#0080f2] transition hover:bg-blue-100/70 dark:border-blue-500/60 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
                          >
                            <QrCode size={13} />
                            Tampilkan QR
                          </button>
                        )}

                        {orderState.code === "paid" && !validTicket && usedTicket && (
                          <button
                            type="button"
                            onClick={() =>
                              setQrModalData({
                                tickets: modalTickets,
                                initialTicketCode: usedTicket.ticket_code,
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50/70 px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100/70 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                          >
                            Status Tiket: Sudah Digunakan
                          </button>
                        )}

                        {orderState.code === "paid" &&
                          !validTicket &&
                          !usedTicket &&
                          endedTicket && (
                            <button
                              type="button"
                              onClick={() =>
                                setQrModalData({
                                  tickets: modalTickets,
                                  initialTicketCode: endedTicket.ticket_code,
                                })
                              }
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            >
                              Status Tiket: Acara Selesai
                            </button>
                          )}

                        <Link
                          href={`/user/pesanan/${booking.booking_code}`}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#0080f2] hover:bg-[#0070d4] px-3.5 py-1.5 text-xs font-medium text-white shadow-xs transition"
                        >
                          Lihat Detail
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && !loadError && filteredBookings.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800">
              <CreditCard size={24} />
            </div>
            <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
              Belum Ada Pesanan Tersimpan
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
              Anda belum memiliki pesanan dengan filter ini di perangkat Anda. Buat pesanan baru dari halaman katalog event atau masukkan kode booking Anda pada kolom pelacakan di atas.
            </p>
            <Link
              href="/user/event"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#0080f2] hover:bg-[#0070d4] px-4 py-2 text-xs font-medium text-white shadow-xs transition"
            >
              Jelajahi Event Aktif
              <ArrowRight size={14} />
            </Link>
          </div>
        )}

        <TicketQrModal
          isOpen={Boolean(qrModalData)}
          tickets={qrModalData?.tickets || []}
          initialTicketCode={qrModalData?.initialTicketCode}
          showOrderLink
          onClose={() => setQrModalData(null)}
        />
      </div>
    </div>
  );
}
