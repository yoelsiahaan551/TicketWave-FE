"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  CheckCircle,
  AlertCircle,
  KeyRound,
  RefreshCw,
  LogIn,
  Info,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import api from "@/app/lib/api";

const roleStyles = {
  admin: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  officer: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  user: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const roleLabels = {
  admin: "Administrator",
  officer: "Officer",
  user: "Pengguna Terdaftar",
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated, fetchCurrentUser } = useAuth();
  const [verificationToken, setVerificationToken] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        sessionStorage.getItem("ticketwave_verification_token") ||
        localStorage.getItem("ticketwave_verification_token") ||
        ""
      );
    }
    return "";
  });
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user)) {
      router.replace("/login?next=/user/profile");
    }
  }, [authLoading, isAuthenticated, user, router]);

  const handleRefreshProfile = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const currentUser = await fetchCurrentUser();
      if (!currentUser) throw new Error("Data profil terbaru belum dapat dimuat. Silakan coba lagi.");
    } catch (err) {
      setRefreshError(err.message || "Gagal menyinkronkan profil.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    const token = verificationToken.trim();
    if (!token) return;

    setVerifying(true);
    setVerifyMsg(null);
    try {
      const res = await api.get(`/auth/verify-email/${encodeURIComponent(token)}`);
      if (res?.success !== true) throw new Error("Verifikasi email belum dikonfirmasi server.");
      setVerifyMsg({
        type: "success",
        text: res.message || "Email Anda berhasil diverifikasi!",
      });
      if (typeof window !== "undefined") {
        localStorage.removeItem("ticketwave_verification_token");
        sessionStorage.removeItem("ticketwave_verification_token");
        setVerificationToken("");
      }
      await fetchCurrentUser();
    } catch (err) {
      setVerifyMsg({
        type: "error",
        text: err.message || "Token verifikasi tidak valid atau sudah digunakan.",
      });
    } finally {
      setVerifying(false);
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="h-56 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <div className="rounded-xl border border-slate-200/80 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <LogIn size={24} />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
            Anda Belum Masuk
          </h1>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Silakan masuk menggunakan akun TicketWave Anda untuk melihat profil dan status verifikasi email.
          </p>
          <div className="mt-6 flex justify-center gap-2.5">
            <Link
              href="/login"
              className="rounded-xl bg-[#0080f2] px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-[#0070d4] transition-colors"
            >
              Masuk Sekarang
            </Link>
            <Link
              href="/register"
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              Daftar Akun
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 transition-colors dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#0080f2]">
              Identitas Pengguna
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Profil Saya
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Data akun sinkron langsung dari sistem autentikasi TicketWave.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefreshProfile}
            disabled={refreshing}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-xs transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            Sinkronkan Data
          </button>
        </div>

        {refreshError && <p role="alert" className="mb-4 text-sm text-red-700 dark:text-red-300">{refreshError}</p>}
        {/* Profile Summary Card */}
        <div className="mb-5 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0080f2] text-xl font-bold text-white shadow-xs">
              {user.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>

            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {user.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {user.email}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    roleStyles[user.role] || roleStyles.user
                  }`}
                >
                  {roleLabels[user.role] || user.role}
                </span>

                {user.email_verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/60 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <CheckCircle className="h-3 w-3" />
                    Email Terverifikasi
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/60 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                    <AlertCircle className="h-3 w-3" />
                    Email Belum Diverifikasi
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <Shield className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">User ID</p>
                <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                  #{user.id}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Nomor Telepon</p>
                <p className="text-xs font-medium text-slate-900 dark:text-white">
                  {user.phone || "-"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Calendar className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Terdaftar Sejak
                </p>
                <p className="text-xs font-medium text-slate-900 dark:text-white">
                  {user.created_at
                    ? new Date(user.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "-"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Email Verification Section */}
        {!user.email_verified && (
          <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Verifikasi Alamat Email Anda
                </h3>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  Masukkan <code className="font-mono text-[11px] font-semibold">verification_token</code> yang diterima saat registrasi.
                </p>

                <form
                  onSubmit={handleVerifyEmail}
                  className="mt-3 flex flex-col gap-2 sm:flex-row"
                >
                  <input
                    type="text"
                    value={verificationToken}
                    onChange={(e) => setVerificationToken(e.target.value)}
                    placeholder="Tempel verification_token di sini..."
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-mono text-xs text-slate-900 outline-none focus:border-[#0080f2] focus:ring-1 focus:ring-[#0080f2] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-[#0080f2]"
                  />
                  <button
                    type="submit"
                    disabled={verifying || !verificationToken.trim()}
                    className="rounded-xl bg-[#0080f2] px-4 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-[#0070d4] disabled:opacity-50"
                  >
                    {verifying ? "Memverifikasi..." : "Verifikasi Email"}
                  </button>
                </form>

                {verifyMsg && (
                  <p
                    className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    {verifyMsg.text}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Read-Only Profile Details */}
        <section
          aria-labelledby="detail-profil-heading"
          className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900 sm:p-6"
        >
          <div className="mb-5 flex items-center justify-between gap-2">
            <h3
              id="detail-profil-heading"
              className="text-sm font-semibold text-slate-900 dark:text-white"
            >
              Detail Informasi Profil
            </h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Hanya Lihat
            </span>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <User className="h-3.5 w-3.5 text-slate-400" />
                Nama Lengkap
              </dt>
              <dd className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                {user.name || "-"}
              </dd>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                Alamat Email
              </dt>
              <dd className="mt-1 break-all text-xs font-semibold text-slate-900 dark:text-white">
                {user.email || "-"}
              </dd>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                Nomor Telepon
              </dt>
              <dd className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                {user.phone || "-"}
              </dd>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <Shield className="h-3.5 w-3.5 text-slate-400" />
                Peran Akun
              </dt>
              <dd className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                {roleLabels[user.role] || user.role}
              </dd>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {user.email_verified ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                )}
                Status Verifikasi Email
              </dt>
              <dd className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                {user.email_verified ? "Terverifikasi" : "Belum Diverifikasi"}
              </dd>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Terdaftar Sejak
              </dt>
              <dd className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                {user.created_at
                  ? new Date(user.created_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "-"}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
            <span>
              Informasi profil pada area User bersifat hanya lihat (read-only). Untuk pengaturan tema atau reset kata sandi, buka{" "}
              <Link
                href="/user/settings"
                className="font-medium text-[#0080f2] hover:underline"
              >
                Pengaturan Akun
              </Link>
              .
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
