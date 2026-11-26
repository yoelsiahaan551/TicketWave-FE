"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, LogIn, RefreshCw, ShieldAlert } from "lucide-react";
import api from "@/app/lib/api";
import { useAuth } from "@/app/context/AuthContext";
import { getGuestTokenForBooking, saveBookingEntry } from "@/app/lib/bookingStorage";
import {
  isBookingOwnedByUser,
  readPaymentReturnContext,
} from "@/app/lib/paymentContext";

function PaymentReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [state, setState] = useState({
    status: "checking", // checking | mismatch | denied | error
    message: "Memverifikasi sesi dan mengarahkan ke detail pesanan Anda...",
    bookingCode: "",
  });
  const [retryCount, setRetryCount] = useState(0);

  const paramBookingCode =
    searchParams.get("booking_code") || searchParams.get("order_id") || "";

  useEffect(() => {
    if (authLoading) return undefined;

    let active = true;
    const context = readPaymentReturnContext(paramBookingCode || null);
    const resolvedBookingCode = (paramBookingCode || context?.booking_code || "")
      .trim()
      .toUpperCase();

    const finishReturn = async () => {
      await Promise.resolve();
      if (!active) return;

      const returnDetailPath = resolvedBookingCode
        ? `/user/pesanan/${encodeURIComponent(resolvedBookingCode)}?payment_return=1`
        : "/user/pesanan";

      if (isAuthenticated && user?.role === "officer") {
        setState({
          status: "mismatch",
          bookingCode: resolvedBookingCode,
          message:
            "Halaman kembali pembayaran hanya diperuntukkan bagi akun pemilik pesanan (User) atau Guest. Sesi aktif Anda saat ini adalah Officer.",
        });
        return;
      }

      if (!resolvedBookingCode) {
        if (!isAuthenticated || !user) {
          router.replace("/user/pesanan");
        } else {
          router.replace(user.role === "admin" ? "/admin" : "/user/pesanan");
        }
        return;
      }

      // Guest return (belum login): langsung arahkan ke detail pesanan agar guest
      // bisa lanjut dengan X-Guest-Token tersimpan atau verifikasi buyer_email tanpa dipaksa login.
      if (!isAuthenticated || !user) {
        router.replace(returnDetailPath);
        return;
      }

      try {
        const guestToken = getGuestTokenForBooking(resolvedBookingCode);
        const res = await api.get(
          `/checkout/${encodeURIComponent(resolvedBookingCode)}`,
          {},
          {
            silent: true,
            ...(guestToken ? { headers: { "X-Guest-Token": guestToken } } : {}),
          }
        );
        if (!active) return;

        if (!res?.success || !res?.data?.booking) {
          setState({
            status: "error",
            bookingCode: resolvedBookingCode,
            message: `Pesanan ${resolvedBookingCode} tidak ditemukan di server.`,
          });
          return;
        }

        if (res.data.booking.user_id != null && !isBookingOwnedByUser(res.data.booking, user)) {
          setState({
            status: "denied",
            bookingCode: resolvedBookingCode,
            message:
              "Akses ditolak. Pesanan ini terdaftar atas akun pengguna yang berbeda.",
          });
          return;
        }

        saveBookingEntry({
          booking_code: res.data.booking.booking_code,
          guest_token: res.data.guest_access_token || guestToken || null,
        });
        router.replace(returnDetailPath);
      } catch (err) {
        if (!active) return;
        if (err?.status === 401 || err?.status === 403) {
          if (err?.data?.errors?.requires_verification === "guest_email") {
            router.replace(returnDetailPath);
            return;
          }
          setState({
            status: "denied",
            bookingCode: resolvedBookingCode,
            message:
              err?.message ||
              "Akses ditolak. Pesanan ini terdaftar atas akun pengguna lain atau memerlukan verifikasi.",
          });
          return;
        }
        setState({
          status: "error",
          bookingCode: resolvedBookingCode,
          message:
            err?.message ||
            "Gagal memverifikasi detail pesanan setelah kembali dari Midtrans.",
        });
      }
    };

    const timer = setTimeout(finishReturn, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [authLoading, isAuthenticated, user, paramBookingCode, router, retryCount]);

  const loginNextHref = state.bookingCode
    ? `/login?next=${encodeURIComponent(`/user/pesanan/${state.bookingCode}?payment_return=1`)}`
    : "/login?next=%2Fuser%2Fpesanan";

  if (authLoading || state.status === "checking") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center dark:bg-slate-950">
        <Loader2 className="h-9 w-9 animate-spin text-[#0080f2]" />
        <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-200">
          Kembali ke TicketWave
        </p>
        <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
          {state.message}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
          {state.status === "error" ? <AlertCircle size={24} /> : <ShieldAlert size={24} />}
        </div>

        <h1 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
          {state.status === "mismatch"
            ? "Sesi Role Tidak Sesuai"
            : state.status === "denied"
            ? "Akses Pesanan Ditolak"
            : "Tidak Dapat Membuka Detail Pesanan"}
        </h1>

        <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {state.message}
        </p>

        {state.bookingCode && (
          <p className="mt-2 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
            Kode Booking: {state.bookingCode}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {(state.status === "mismatch" || state.status === "denied") && (
            <Link
              href={loginNextHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0080f2] px-4 py-2.5 text-xs font-medium text-white shadow-xs transition hover:bg-[#0070d4]"
            >
              <LogIn size={14} />
              Masuk dengan Akun Pemilik Pesanan
            </Link>
          )}

          {state.status === "error" && (
            <button
              type="button"
              onClick={() => {
                setState((prev) => ({
                  ...prev,
                  status: "checking",
                  message: "Memeriksa ulang pesanan...",
                }));
                setRetryCount((n) => n + 1);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0080f2] px-4 py-2.5 text-xs font-medium text-white shadow-xs transition hover:bg-[#0070d4]"
            >
              <RefreshCw size={14} />
              Coba Lagi
            </button>
          )}

          <Link
            href={user?.role === "officer" ? "/officer" : "/user/pesanan"}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={14} />
            {user?.role === "officer"
              ? "Kembali ke Portal Officer"
              : "Buka Daftar Pesanan Saya"}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentReturnHandler() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center dark:bg-slate-950">
          <Loader2 className="h-9 w-9 animate-spin text-[#0080f2]" />
          <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-400">
            Menyiapkan halaman kembali pembayaran...
          </p>
        </div>
      }
    >
      <PaymentReturnContent />
    </Suspense>
  );
}
