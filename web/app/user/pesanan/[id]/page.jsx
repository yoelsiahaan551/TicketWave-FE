"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  User,
  Mail,
  Phone,
  ExternalLink,
  ShieldAlert,
  Loader2,
  AlertCircle,
  Clock,
  QrCode,
  Copy,
  Check,
  CheckCircle2,
  LogIn,
} from "lucide-react";
import api from "@/app/lib/api";
import { useAuth } from "@/app/context/AuthContext";
import { getGuestTokenForBooking, saveBookingEntry } from "@/app/lib/bookingStorage";
import {
  formatWibDateTime,
  getTicketDisplayStatus,
  resolveOrderPaymentState,
} from "@/app/lib/payment";
import {
  clearPaymentReturnContext,
  isBookingOwnedByUser,
  savePaymentReturnContext,
} from "@/app/lib/paymentContext";
import TicketQr from "@/app/components/user/TicketQr";
import TicketQrModal from "@/app/components/user/TicketQrModal";

const isSandboxSyncAllowed = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION !== "true";

const TICKET_STATUS_LABELS = {
  valid: "Valid / Aktif",
  used: "Sudah Digunakan",
  event_ended: "Acara Selesai",
  pending_payment: "Menunggu Pembayaran",
  expired: "Pembayaran Kedaluwarsa",
  sales_closed: "Penjualan Ditutup",
  cancelled: "Pesanan Dibatalkan",
};

function PesananDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingCode = params?.id;
  const isPaymentReturn = searchParams.get("payment_return") === "1";

  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [bookingData, setBookingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [verificationMode, setVerificationMode] = useState(null); // null | "login" | "guest_email" | "forbidden"
  const [guestEmailInput, setGuestEmailInput] = useState("");
  const [verifyingGuest, setVerifyingGuest] = useState(false);
  const [guestVerifyError, setGuestVerifyError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [syncingStatus, setSyncingStatus] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedQrTicket, setSelectedQrTicket] = useState(null);
  const [returnedViaBack, setReturnedViaBack] = useState(false);
  const [detailReloadKey, setDetailReloadKey] = useState(0);
  const [nowMs, setNowMs] = useState(null);
  const syncLockRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handlePageShow = (event) => {
      if (!event.persisted) return;
      setReturnedViaBack(true);
      setDetailReloadKey((n) => n + 1);
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  useEffect(() => {
    if (authLoading || !bookingCode) return;

    const fetchedBooking = bookingData?.booking;
    if (
      verificationMode === "login" ||
      (fetchedBooking && fetchedBooking.user_id != null && (!isAuthenticated || !user))
    ) {
      const nextPath = `/user/pesanan/${encodeURIComponent(String(bookingCode))}${
        isPaymentReturn ? "?payment_return=1" : ""
      }`;
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    const canSaveBookmark =
      Boolean(fetchedBooking) &&
      user?.role !== "officer" &&
      (!fetchedBooking.user_id ||
        Boolean(user && isBookingOwnedByUser(fetchedBooking, user)));

    if (canSaveBookmark) {
      saveBookingEntry({
        booking_code: fetchedBooking.booking_code,
        guest_token: bookingData?.guest_access_token || null,
      });
    }

    if (fetchedBooking) {
      const fetchedOrderState = resolveOrderPaymentState(
        fetchedBooking,
        bookingData?.event,
        bookingData?.tickets
      );
      if (fetchedOrderState.code !== "pending_payment") {
        clearPaymentReturnContext();
      }
    }
  }, [
    authLoading,
    bookingCode,
    bookingData,
    isAuthenticated,
    isPaymentReturn,
    router,
    user,
    verificationMode,
  ]);

  useEffect(() => {
    let isMounted = true;
    if (!bookingCode || authLoading) return;

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      setNotFound(false);
      setVerificationMode(null);
      try {
        const guestToken = getGuestTokenForBooking(String(bookingCode));
        const res = await api.get(
          `/checkout/${encodeURIComponent(bookingCode)}`,
          {},
          {
            silent: true,
            ...(guestToken ? { headers: { "X-Guest-Token": guestToken } } : {}),
          }
        );
        if (isMounted) {
          if (res.success && res.data?.booking) {
            setBookingData(res.data);
            if (res.data.guest_access_token) {
              saveBookingEntry({
                booking_code: res.data.booking.booking_code,
                guest_token: res.data.guest_access_token,
              });
            }
          } else {
            setError(res.message || "Pesanan tidak ditemukan");
          }
        }
      } catch (err) {
        if (isMounted) {
          const reqMode = err?.data?.errors?.requires_verification;
          if (err.status === 404) {
            setNotFound(true);
            setError(
              `Kode pesanan '${bookingCode}' tidak ditemukan dalam basis data sistem. Pastikan kode booking yang Anda masukkan benar atau lakukan pemesanan baru.`
            );
          } else if (reqMode === "login") {
            setVerificationMode("login");
            setError(err.message || "Login diperlukan untuk melihat pesanan ini.");
          } else if (reqMode === "guest_email") {
            setVerificationMode("guest_email");
            setError(
              err.message ||
                "Verifikasi email pembeli diperlukan untuk melihat pesanan guest."
            );
          } else if (err.status === 403) {
            setVerificationMode("forbidden");
            setError(err.message || "Anda tidak memiliki izin mengakses pesanan ini.");
          } else {
            setError(err.message || "Gagal memuat detail pesanan");
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDetail();

    return () => {
      isMounted = false;
    };
  }, [authLoading, bookingCode, detailReloadKey, isAuthenticated]);

  const handleGuestVerifySubmit = async (e) => {
    e.preventDefault();
    const email = guestEmailInput.trim();
    if (!email || !bookingCode) return;

    setVerifyingGuest(true);
    setGuestVerifyError(null);
    try {
      const res = await api.get(
        `/checkout/${encodeURIComponent(bookingCode)}`,
        {},
        { silent: true, headers: { "X-Buyer-Email": email } }
      );
      if (res?.success && res.data?.booking) {
        if (res.data.guest_access_token) {
          saveBookingEntry({
            booking_code: res.data.booking.booking_code,
            guest_token: res.data.guest_access_token,
          });
        }
        setBookingData(res.data);
        setVerificationMode(null);
        setError(null);
      } else {
        setGuestVerifyError(res?.message || "Verifikasi email gagal.");
      }
    } catch (err) {
      setGuestVerifyError(
        err?.message || "Email pembeli tidak cocok dengan pesanan ini."
      );
    } finally {
      setVerifyingGuest(false);
    }
  };

  const handleCopyBookingCode = () => {
    if (!bookingData?.booking?.booking_code) return;
    navigator.clipboard?.writeText(bookingData.booking.booking_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCancel = async () => {
    if (!bookingData?.booking?.booking_code) return;
    const currentOrderState = resolveOrderPaymentState(
      bookingData.booking,
      bookingData.event,
      bookingData.tickets,
      nowMs ?? undefined
    );
    if (!currentOrderState.canCancel) return;

    const confirmCancel = window.confirm(
      "Apakah Anda yakin ingin membatalkan pesanan ini? Kuota tiket yang dipesan akan dikembalikan ke sistem."
    );
    if (!confirmCancel) return;

    setCancelling(true);
    setActionMessage(null);

    try {
      const guestToken = getGuestTokenForBooking(bookingData.booking.booking_code);
      const res = await api.post(
        `/checkout/${encodeURIComponent(bookingData.booking.booking_code)}/cancel`,
        {},
        guestToken ? { headers: { "X-Guest-Token": guestToken } } : {}
      );
      if (res?.success === true && res.data?.booking?.status === "cancelled") {
        setBookingData((prev) => ({
          ...prev,
          booking: res.data.booking,
        }));
        setActionMessage({
          tipe: "sukses",
          teks: "Pesanan berhasil dibatalkan dan stok tiket telah dikembalikan.",
        });
      } else {
        setActionMessage({
          tipe: "error",
          teks: res.message || "Gagal membatalkan pesanan.",
        });
        setDetailReloadKey((n) => n + 1);
      }
    } catch (err) {
      setActionMessage({
        tipe: "error",
        teks: err.message || "Terjadi kesalahan saat membatalkan pesanan.",
      });
      setDetailReloadKey((n) => n + 1);
    } finally {
      setCancelling(false);
    }
  };

  const handleSyncPaymentStatus = async () => {
    const currentOrderState = bookingData?.booking
      ? resolveOrderPaymentState(
          bookingData.booking,
          bookingData.event,
          bookingData.tickets,
          nowMs ?? undefined
        )
      : null;
    if (syncLockRef.current || syncingStatus || !currentOrderState?.canSyncPayment) {
      return;
    }

    syncLockRef.current = true;
    setSyncingStatus(true);
    setActionMessage(null);

    try {
      const guestToken = getGuestTokenForBooking(String(bookingCode));
      const guestOpts = guestToken ? { headers: { "X-Guest-Token": guestToken } } : {};
      await api.syncPaymentStatus(bookingCode, guestOpts);
      const detailRes = await api.get(
        `/checkout/${encodeURIComponent(bookingCode)}`,
        {},
        guestOpts
      );
      if (!detailRes.success || !detailRes.data?.booking) {
        throw new Error("Respons pesanan tidak valid.");
      }
      setBookingData(detailRes.data);

      const updatedStatus = detailRes.data.booking.status;
      if (updatedStatus === "paid") {
        setActionMessage({
          tipe: "sukses",
          teks: "Pembayaran terverifikasi lunas. E-Ticket dan QR Code Anda kini aktif.",
        });
      } else {
        setActionMessage({
          tipe: "sukses",
          teks: "Status pembayaran terbaru berhasil diperiksa dari server.",
        });
      }
    } catch (err) {
      setActionMessage({
        tipe: "error",
        teks:
          err.status === 401
            ? "Silakan masuk ke akun pemilik pesanan atau verifikasi email pembeli untuk memeriksa status pembayaran."
            : err.message || "Gagal memeriksa status pembayaran dari server.",
      });
    } finally {
      syncLockRef.current = false;
      setSyncingStatus(false);
    }
  };

  const formatTanggal = (d) => {
    if (!d) return "Jadwal Menyusul";
    try {
      return new Date(d).toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  const formatRupiah = (n) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n || 0);

  const booking = bookingData?.booking;
  const requiresLoginRedirect =
    verificationMode === "login" ||
    Boolean(booking && booking.user_id != null && (!isAuthenticated || !user));

  if (loading || authLoading || requiresLoginRedirect) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center dark:bg-slate-950">
        <Loader2 className="mb-4 h-8 w-8 animate-spin text-slate-600" />
        <p className="font-medium text-slate-600 dark:text-slate-400">
          {requiresLoginRedirect
            ? "Mengarahkan ke halaman login..."
            : "Memuat data pesanan dari server..."}
        </p>
      </div>
    );
  }

  if (verificationMode === "guest_email") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center dark:bg-slate-950">
        <div className="w-full max-w-md rounded-xl border border-slate-200/80 bg-white p-6 text-left shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#0080f2] dark:bg-blue-950/40">
            <Mail className="h-5 w-5" />
          </div>
          <h2 className="text-center text-base font-semibold text-slate-900 dark:text-white">
            Verifikasi Email Pembeli Guest
          </h2>
          <p className="mt-1.5 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Untuk melindungi privasi pesanan <strong className="font-mono text-slate-700 dark:text-slate-200">{String(bookingCode)}</strong>, masukkan email pembeli yang digunakan saat checkout.
          </p>

          <form onSubmit={handleGuestVerifySubmit} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="guest-verify-email"
                className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Email Pembeli
              </label>
              <input
                id="guest-verify-email"
                type="email"
                required
                value={guestEmailInput}
                onChange={(e) => setGuestEmailInput(e.target.value)}
                placeholder="nama@email.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[#0080f2] focus:ring-1 focus:ring-[#0080f2] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {guestVerifyError && (
              <p
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
              >
                {guestVerifyError}
              </p>
            )}

            <button
              type="submit"
              disabled={verifyingGuest}
              className="w-full rounded-xl bg-[#0080f2] px-4 py-2.5 text-xs font-medium text-white shadow-xs transition hover:bg-[#0070d4] disabled:opacity-60"
            >
              {verifyingGuest ? "Memverifikasi..." : "Buka Detail Pesanan"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link
              href="/user/pesanan"
              className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              &larr; Kembali ke Pesanan Saya
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center dark:bg-slate-950">
        <div className="w-full max-w-md rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          {verificationMode === "forbidden" ? (
            <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          ) : (
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-slate-500" />
          )}
          <h2 className="mb-1.5 text-base font-semibold text-slate-900 dark:text-white">
            {notFound
              ? "Pesanan Tidak Ditemukan"
              : verificationMode === "forbidden"
              ? "Akses Pesanan Ditolak"
              : "Gagal Memuat Pesanan"}
          </h2>
          <p className="mb-5 text-xs text-slate-500 dark:text-slate-400">
            {error || "Data pesanan dengan kode tersebut tidak ditemukan di database."}
          </p>
          <Link
            href="/user/pesanan"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-xs transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Kembali ke Pesanan Saya
          </Link>
        </div>
      </div>
    );
  }

  const shouldEnforceOwnership = Boolean(user) && (booking.user_id != null || isPaymentReturn);
  if (shouldEnforceOwnership && !isBookingOwnedByUser(booking, user)) {
    const loginNext = `/login?next=${encodeURIComponent(
      `/user/pesanan/${booking.booking_code}${isPaymentReturn ? "?payment_return=1" : ""}`
    )}`;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center dark:bg-slate-950">
        <div className="w-full max-w-md rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <h2 className="mb-1.5 text-base font-semibold text-slate-900 dark:text-white">
            Akses Pesanan Ditolak
          </h2>
          <p className="mb-5 text-xs text-slate-500 dark:text-slate-400">
            Pesanan <strong>{booking.booking_code}</strong> bukan milik akun yang sedang aktif ({user.email}).
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href={loginNext}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0080f2] px-4 py-2.5 text-xs font-medium text-white shadow-xs transition hover:bg-[#0070d4]"
            >
              <LogIn size={14} />
              Masuk dengan Akun Pemilik Pesanan
            </Link>
            <Link
              href="/user/pesanan"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Kembali ke Pesanan Saya
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { event, ticket_type, tickets = [] } = bookingData;
  const effectiveNowMs = nowMs ?? undefined;
  const orderState = resolveOrderPaymentState(booking, event, tickets, effectiveNowMs);
  const resolvedPaymentUrl = orderState.paymentUrl;

  const handleContinuePayment = () => {
    if (!orderState.canPay || !resolvedPaymentUrl || !booking?.booking_code) return;
    savePaymentReturnContext({
      booking_code: booking.booking_code,
      return_path: `/user/pesanan/${encodeURIComponent(booking.booking_code)}?payment_return=1`,
      owner_user_id: user?.id ?? booking.user_id ?? null,
      owner_email: user?.email || booking.buyer_email || null,
      is_guest: booking.user_id == null && !isAuthenticated,
    });
    window.location.assign(resolvedPaymentUrl);
  };

  return (
    <div className="min-h-screen bg-slate-50 transition-colors dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link
          href="/user/pesanan"
          className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke Daftar Pesanan
        </Link>

        {/* Payment Return Banner (Status murni dibaca dari Backend & kontrak resmi) */}
        {(isPaymentReturn || returnedViaBack) && (
          <div
            role="status"
            className={`mb-5 flex items-start gap-2.5 rounded-xl border p-3.5 text-xs ${
              orderState.code === "paid"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
                : orderState.code === "pending_payment"
                ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
                : "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            <p>
              {orderState.code === "paid"
                ? orderState.isEventEnded
                  ? "Pembayaran tercatat lunas (Dibayar). Acara telah selesai sehingga QR tiket tidak lagi aktif, namun riwayat Anda tetap tersimpan."
                  : "Pembayaran Berhasil — e-ticket dan QR Code Anda telah aktif."
                : orderState.code === "pending_payment"
                ? "Anda kembali dari halaman pembayaran Midtrans. Pembayaran belum tercatat lunas (Menunggu Pembayaran). Anda dapat melanjutkan pembayaran yang sama atau memeriksa status pembayaran."
                : `Anda kembali dari halaman pembayaran Midtrans. Status pesanan saat ini: ${
                    orderState.label
                  }${orderState.description ? ` — ${orderState.description}` : "."}`}
            </p>
          </div>
        )}

        {/* Action / Error Banner */}
        {actionMessage && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-slate-300 bg-slate-100 p-3.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-slate-600 dark:text-slate-400" />
            <p>{actionMessage.teks}</p>
          </div>
        )}

        {/* Booking Code Tracking Banner */}
        <div className="mb-5 flex flex-col justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Kode Booking Resmi
            </p>
            <p className="mt-0.5 font-mono text-base font-bold text-slate-900 dark:text-white">
              {booking.booking_code}
            </p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Gunakan kode ini di menu <strong>Pesanan Saya</strong> atau <strong>Tiket Saya</strong> untuk melacak tiket kapan saja.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyBookingCode}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {copiedCode ? (
              <>
                <Check size={14} />
                Kode Tersalin!
              </>
            ) : (
              <>
                <Copy size={14} />
                Salin Kode Booking
              </>
            )}
          </button>
        </div>

        {/* Pending Payment Notice / Non-Payable Status Notice */}
        {orderState.showDeadline && booking.expired_at && (
          <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-700 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <Clock className="h-4 w-4 shrink-0 text-slate-500" />
            <div>
              <span className="font-semibold">Batas Waktu Pembayaran: </span>
              Selesaikan sebelum{" "}
              <strong>{formatWibDateTime(booking.expired_at)}</strong>
              . Melewati batas waktu, kuota otomatis dikembalikan.
            </div>
          </div>
        )}

        {!orderState.showDeadline &&
          orderState.description &&
          ["expired", "event_ended", "cancelled", "sales_closed"].includes(
            orderState.code
          ) && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-700 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {orderState.label}
                </p>
                <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                  {orderState.description}
                </p>
              </div>
            </div>
          )}

        {/* Header Card */}
        <div className="mb-5 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Bukti Reservasi Resmi
              </span>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                Detail Pesanan
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-900 dark:bg-slate-800 dark:text-slate-200">
                  <span>{booking.booking_code}</span>
                  <button
                    type="button"
                    onClick={handleCopyBookingCode}
                    className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    title="Salin kode booking"
                  >
                    {copiedCode ? (
                      <Check size={12} className="text-slate-900 dark:text-white" />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${orderState.badgeClass}`}
                >
                  {orderState.label}
                </span>
              </div>
            </div>
            <div className="text-left lg:text-right">
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Total Pembayaran
              </p>
              <p className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
                {formatRupiah(booking.total_price)}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Informasi Event
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-base font-semibold text-slate-900 dark:text-white">
                  {event?.name || "Event TicketWave"}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {event?.artist_name ||
                    (event?.event_type === "festival"
                      ? `Festival ${event?.days_count || 1} Hari`
                      : "Konser Resmi")}
                </p>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    {formatTanggal(event?.event_date)}{" "}
                    {event?.event_time && event?.event_end_time
                      ? `• ${event.event_time.slice(0, 5)} – ${event.event_end_time.slice(0, 5)} WIB`
                      : event?.event_time
                      ? `• ${event.event_time.slice(0, 5)} WIB`
                      : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    {event?.venue || "-"}, {event?.city || "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Buyer Info */}
        <div className="mb-5 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
            Informasi Pembeli &amp; Penerima
          </h2>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="flex items-center gap-2.5">
              <User className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Nama Pembeli
                </p>
                <p className="text-xs font-medium text-slate-900 dark:text-white">
                  {booking.buyer_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Email Pembeli
                </p>
                <p className="text-xs font-medium text-slate-900 dark:text-white">
                  {booking.buyer_email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Nomor Telepon
                </p>
                <p className="text-xs font-medium text-slate-900 dark:text-white">
                  {booking.buyer_phone}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Email Penerima E-Ticket
                </p>
                <p className="text-xs font-medium text-slate-900 dark:text-white">
                  {booking.recipient_email || booking.buyer_email}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tickets */}
        <div className="mb-5 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Daftar E-Ticket ({tickets.length > 0 ? tickets.length : booking.quantity})
            </h2>
            <Link
              href="/user/ticket"
              className="text-xs font-medium text-[#0080f2] hover:underline"
            >
              Buka Halaman Tiket Saya &rarr;
            </Link>
          </div>
          <div className="space-y-3">
            {tickets.length > 0 ? (
              tickets.map((rawTicket, idx) => {
                const ticket = {
                  ...rawTicket,
                  status: getTicketDisplayStatus(booking, rawTicket, event, effectiveNowMs),
                  booking_code: booking.booking_code,
                  booking_status: booking.status,
                  buyer_name: booking.buyer_name,
                  event_name: event?.name || "Event TicketWave",
                  ticket_type_name: ticket_type?.name || "Standard",
                };
                const isEndedTicket = ticket.status === "event_ended";
                const canShowActiveQr =
                  booking.status === "paid" &&
                  ticket.status === "valid" &&
                  !isEndedTicket &&
                  Boolean(ticket.qr_token);
                const isUsedTicket = ticket.status === "used";

                return (
                  <div
                    key={ticket.id || idx}
                    className="rounded-xl border border-slate-100 p-4 transition-colors dark:border-slate-800"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#0080f2] dark:bg-blue-950/40 dark:text-blue-400">
                          <QrCode className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                            {ticket.ticket_code}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Kategori:{" "}
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {ticket.ticket_type_name}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`w-fit rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            ticket.status === "valid"
                              ? "border-emerald-200/60 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : isUsedTicket
                              ? "border-amber-200/60 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                              : ticket.status === "pending_payment"
                              ? "border-amber-200/60 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                              : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {TICKET_STATUS_LABELS[ticket.status] || "Tidak Berlaku"}
                        </span>

                        {canShowActiveQr && (
                          <button
                            type="button"
                            onClick={() => setSelectedQrTicket(ticket)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0080f2] px-3 py-1.5 text-xs font-medium text-white shadow-xs transition hover:bg-[#0070d4]"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            Tampilkan QR
                          </button>
                        )}

                        {booking.status === "paid" && (isUsedTicket || isEndedTicket) && (
                          <button
                            type="button"
                            onClick={() => setSelectedQrTicket(ticket)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            Detail Tiket
                          </button>
                        )}
                      </div>
                    </div>

                    {canShowActiveQr && (
                      <div className="mt-4 flex flex-col items-center rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                        <TicketQr
                          value={ticket.qr_token}
                          ticketCode={ticket.ticket_code}
                          size={220}
                          showCode
                        />
                        <p className="mt-2.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
                          Tunjukkan QR resmi ini kepada petugas di pintu masuk (gate).
                        </p>
                      </div>
                    )}

                    {booking.status === "paid" && isUsedTicket && (
                      <div className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                        Status Tiket: <strong>Sudah Digunakan</strong>
                        {ticket.checked_in_at
                          ? ` pada ${new Date(
                              /Z$|[+-]\d{2}:?\d{2}$/.test(ticket.checked_in_at)
                                ? ticket.checked_in_at
                                : `${ticket.checked_in_at}Z`
                            ).toLocaleString("id-ID")}`
                          : ""}
                        . Tiket tidak lagi valid untuk masuk kembali.
                      </div>
                    )}

                    {booking.status === "paid" && !isUsedTicket && isEndedTicket && (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                        Status Tiket: <strong>Acara Selesai</strong>. QR tiket tidak lagi aktif untuk check-in, tetapi status pembayaran tetap Dibayar dan riwayat pesanan Anda tersimpan.
                      </div>
                    )}

                    {booking.status !== "paid" && (
                      <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {orderState.code === "pending_payment"
                          ? "QR tiket akan aktif otomatis setelah pembayaran selesai diverifikasi."
                          : orderState.description ||
                            "QR tiket tidak aktif karena pesanan tidak berstatus dibayar."}
                      </p>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Tidak ada data tiket spesifik untuk pesanan ini.
              </div>
            )}
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="mb-5 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
            Rincian Harga
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>
                {ticket_type?.name || "Tiket"} ({booking.quantity} ×{" "}
                {formatRupiah(booking.unit_price)})
              </span>
              <span className="font-medium text-slate-900 dark:text-white">
                {formatRupiah(Number(booking.unit_price || 0) * Number(booking.quantity || 0))}
              </span>
            </div>
            {Number(booking.discount_percent) > 0 && (
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Diskon Fase Aktif ({booking.discount_percent}%)</span>
                <span>Termasuk dalam harga satuan</span>
              </div>
            )}
            <div className="border-t border-slate-100 pt-2.5 dark:border-slate-800">
              <div className="flex justify-between text-sm font-semibold text-slate-900 dark:text-white">
                <span>Total Pembayaran</span>
                <span className="text-[#0080f2] font-bold">
                  {formatRupiah(booking.total_price)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 sm:flex-row">
          {orderState.code === "pending_payment" && (
            <>
              {isSandboxSyncAllowed && orderState.canSyncPayment && (
                <button
                  type="button"
                  onClick={handleSyncPaymentStatus}
                  disabled={syncingStatus || cancelling}
                  className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-center text-xs font-semibold text-[#0080f2] transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300"
                >
                  {syncingStatus ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {syncingStatus
                      ? "Memeriksa Status..."
                      : "Periksa Status Pembayaran"}
                  </span>
                </button>
              )}

              {orderState.canPay && resolvedPaymentUrl ? (
                <button
                  type="button"
                  onClick={handleContinuePayment}
                  disabled={cancelling || syncingStatus}
                  className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#0080f2] px-4 py-2.5 text-center text-xs font-medium text-white shadow-xs transition hover:bg-[#0070d4] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Lanjutkan Pembayaran
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              ) : (
                <p
                  role="alert"
                  className="flex-1 rounded-xl border border-amber-200 p-3 text-xs text-slate-700 dark:text-slate-300"
                >
                  Tautan pembayaran resmi belum tersedia. Pembayaran belum dikonfirmasi; hubungi penyelenggara atau periksa kembali status.
                </p>
              )}

              {orderState.canCancel && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={cancelling || syncingStatus}
                  className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-center text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {cancelling ? "Membatalkan..." : "Batalkan Pesanan"}
                </button>
              )}
            </>
          )}

          {orderState.code === "paid" && (
            <Link
              href="/user/ticket"
              className="flex-1 rounded-xl bg-[#0080f2] px-4 py-2.5 text-center text-xs font-medium text-white shadow-xs transition hover:bg-[#0070d4]"
            >
              Lihat E-Ticket &amp; QR Code Saya
            </Link>
          )}

          {orderState.code !== "pending_payment" && orderState.code !== "paid" && (
            <div className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-center text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {orderState.label}
              </span>
              {orderState.description ? ` — ${orderState.description}` : ""}
            </div>
          )}
        </div>

        <TicketQrModal
          isOpen={Boolean(selectedQrTicket)}
          tickets={selectedQrTicket ? [selectedQrTicket] : []}
          initialTicketCode={selectedQrTicket?.ticket_code}
          showOrderLink={false}
          onClose={() => setSelectedQrTicket(null)}
        />
      </div>
    </div>
  );
}

export default function PesananDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center dark:bg-slate-950">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-slate-600" />
          <p className="font-medium text-slate-600 dark:text-slate-400">
            Memuat detail pesanan...
          </p>
        </div>
      }
    >
      <PesananDetailContent />
    </Suspense>
  );
}
