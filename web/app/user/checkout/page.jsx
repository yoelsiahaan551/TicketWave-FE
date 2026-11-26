"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  MapPin,
  ArrowLeft,
  ShieldAlert,
  UserCheck,
  Sparkles,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import CheckoutSummary from "@/app/components/user/CheckoutSummary";
import PaymentMethod, { PAYMENT_METHODS } from "@/app/components/user/PaymentMethod";
import EmptyState from "@/app/components/user/EmptyState";
import { useIsMounted } from "@/app/context/ThemeContext";
import { useAuth } from "@/app/context/AuthContext";
import api from "@/app/lib/api";
import { saveBookingEntry } from "@/app/lib/bookingStorage";
import { reconcileCheckout } from "@/app/lib/checkout";
import { getOfficialPaymentUrl } from "@/app/lib/payment";
import {
  readPaymentReturnContext,
  savePaymentReturnContext,
} from "@/app/lib/paymentContext";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CheckoutPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [data, setData] = useState(null);
  const [selectionError, setSelectionError] = useState(null);
  const [selectionLoading, setSelectionLoading] = useState(true);
  const [selectionReload, setSelectionReload] = useState(0);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [paymentMethodError, setPaymentMethodError] = useState(null);
  const [createdBooking, setCreatedBooking] = useState(null);

  const paymentMethodSectionRef = useRef(null);
  const submitLockRef = useRef(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      let redirected = false;
      try {
        const raw = sessionStorage.getItem("ticketwave_checkout");
        if (!raw) {
          const returnCtx = readPaymentReturnContext();
          if (returnCtx?.booking_code) {
            redirected = true;
            router.replace(
              `/user/pesanan/${encodeURIComponent(returnCtx.booking_code)}?payment_return=1`
            );
          }
          return;
        }
        const selected = JSON.parse(raw);
        if (
          !Number.isInteger(Number(selected?.eventId)) ||
          Number(selected.eventId) < 1
        ) {
          throw new Error("Pilihan event tidak valid.");
        }
        const response = await api.get(`/public/events/${selected.eventId}`);
        const verified = reconcileCheckout(selected, response);
        if (active) {
          setData(verified);
          setSelectionError(null);
        }
      } catch (error) {
        if (active) {
          setSelectionError(error.message || "Gagal memverifikasi tiket.");
        }
      } finally {
        if (active && !redirected) setSelectionLoading(false);
      }
    };
    const timer = setTimeout(load, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectionReload, router]);

  const ready = useIsMounted();
  const [submitting, setSubmitting] = useState(false);
  const [pesan, setPesan] = useState(null);

  useEffect(() => {
    const handlePageShow = (event) => {
      if (!event.persisted && !submitLockRef.current) return;
      let hasCheckoutSelection = false;
      try {
        hasCheckoutSelection = Boolean(sessionStorage.getItem("ticketwave_checkout"));
      } catch {
        hasCheckoutSelection = false;
      }
      if (!hasCheckoutSelection) {
        const returnCtx = readPaymentReturnContext();
        if (returnCtx?.booking_code) {
          router.replace(
            `/user/pesanan/${encodeURIComponent(returnCtx.booking_code)}?payment_return=1`
          );
          return;
        }
      }
      if (event.persisted) {
        submitLockRef.current = false;
        setSubmitting(false);
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [router]);

  const [manualBuyerName, setManualBuyerName] = useState(null);
  const [manualBuyerEmail, setManualBuyerEmail] = useState(null);
  const [manualBuyerPhone, setManualBuyerPhone] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState("");

  const buyerName =
    manualBuyerName !== null ? manualBuyerName : user?.name || "";
  const buyerEmail =
    manualBuyerEmail !== null ? manualBuyerEmail : user?.email || "";
  const buyerPhone =
    manualBuyerPhone !== null ? manualBuyerPhone : user?.phone || "";

  const formatRupiah = (n) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n || 0);

  const formatTanggal = (d) => {
    if (!d) return "Jadwal Festival";
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

  const items = Array.isArray(data?.items) ? data.items : [];
  const total = items.reduce((acc, i) => acc + i.harga * i.jumlah, 0);
  const diskonFase = items.reduce(
    (acc, i) => acc + Math.max(0, (i.base_price ?? i.harga) - i.harga) * i.jumlah,
    0
  );
  const totalTiket = items.reduce((acc, i) => acc + i.jumlah, 0);

  const trimmedName = buyerName.trim();
  const trimmedEmail = buyerEmail.trim();
  const trimmedPhone = buyerPhone.trim();
  const trimmedRecipientEmail = recipientEmail.trim();

  const isBuyerNameValid =
    trimmedName.length >= 2 && trimmedName.length <= 120;
  const isBuyerEmailValid =
    trimmedEmail.length > 0 && EMAIL_REGEX.test(trimmedEmail);
  const isBuyerPhoneValid =
    trimmedPhone.length >= 10 &&
    trimmedPhone.length <= 20 &&
    /^[0-9+\-\s()]+$/.test(trimmedPhone);
  const isRecipientEmailValid =
    !trimmedRecipientEmail || EMAIL_REGEX.test(trimmedRecipientEmail);
  const isTicketSelectionValid =
    items.length === 1 &&
    totalTiket >= 1 &&
    totalTiket <= 10 &&
    Number.isInteger(Number(data?.eventId)) &&
    Number(data?.eventId) >= 1 &&
    items.every(
      (item) =>
        Number.isInteger(Number(item.jumlah)) &&
        Number(item.jumlah) >= 1 &&
        Number.isInteger(Number(item.ticket_type_id || item.id)) &&
        Number(item.ticket_type_id || item.id) >= 1
    );
  const isPaymentMethodSelected = Boolean(
    selectedPaymentMethod &&
      PAYMENT_METHODS.some((m) => m.id === selectedPaymentMethod)
  );

  const isCheckoutDisabled =
    submitting ||
    Boolean(createdBooking) ||
    selectionLoading ||
    Boolean(selectionError) ||
    !isTicketSelectionValid ||
    !isBuyerNameValid ||
    !isBuyerEmailValid ||
    !isBuyerPhoneValid ||
    !isRecipientEmailValid ||
    !isPaymentMethodSelected;

  const handleSelectPaymentMethod = (methodId) => {
    setSelectedPaymentMethod(methodId);
    setPaymentMethodError(null);
  };

  const focusPaymentMethodSection = () => {
    const sectionEl = paymentMethodSectionRef.current;
    if (!sectionEl) return;
    sectionEl.scrollIntoView({ behavior: "smooth", block: "center" });
    const firstRadio = sectionEl.querySelector('[role="radio"]');
    if (firstRadio && typeof firstRadio.focus === "function") {
      firstRadio.focus();
    } else if (typeof sectionEl.focus === "function") {
      sectionEl.focus();
    }
  };

  const konfirmasiPesanan = async () => {
    if (submitLockRef.current || submitting || createdBooking) return;

    if (!isTicketSelectionValid) {
      if (items.length > 1) {
        setPesan({
          tipe: "error",
          teks: "Sistem hanya mendukung 1 kategori tiket per transaksi. Silakan pilih 1 kategori tiket saja.",
        });
      } else if (items[0]?.jumlah > 10) {
        setPesan({
          tipe: "error",
          teks: "Maksimal pemesanan tiket adalah 10 tiket per transaksi.",
        });
      } else {
        setPesan({
          tipe: "error",
          teks: "Data event atau pilihan tiket tidak valid. Silakan pilih kembali dari detail event.",
        });
      }
      return;
    }

    if (!isBuyerNameValid) {
      setPesan({
        tipe: "error",
        teks: "Nama lengkap pembeli harus terdiri dari 2–120 karakter.",
      });
      return;
    }

    if (!isBuyerEmailValid) {
      setPesan({
        tipe: "error",
        teks: "Format email pembeli tidak valid.",
      });
      return;
    }

    if (!isBuyerPhoneValid) {
      setPesan({
        tipe: "error",
        teks: "Nomor telepon pembeli harus terdiri dari 10–20 karakter.",
      });
      return;
    }

    if (!isRecipientEmailValid) {
      setPesan({
        tipe: "error",
        teks: "Format email penerima tiket tidak valid.",
      });
      return;
    }

    if (!isPaymentMethodSelected) {
      const msg = "Pilih metode pembayaran terlebih dahulu.";
      setPaymentMethodError(msg);
      setPesan({
        tipe: "error",
        teks: msg,
      });
      focusPaymentMethodSection();
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    setPesan(null);
    setPaymentMethodError(null);

    const primaryItem = items[0];
    const ticketTypeId = Number(primaryItem.ticket_type_id || primaryItem.id);
    const quantity = Number(primaryItem.jumlah);

    const payload = {
      event_id: Number(data.eventId),
      ticket_type_id: ticketTypeId,
      quantity,
      buyer_name: trimmedName,
      buyer_email: trimmedEmail,
      buyer_phone: trimmedPhone,
      payment_method: selectedPaymentMethod,
    };

    if (trimmedRecipientEmail) {
      payload.recipient_email = trimmedRecipientEmail;
    }

    try {
      const res = await api.post("/checkout", payload);
      if (res.success && res.data?.booking) {
        const bookingObj = res.data.booking;
        const rawPaymentUrl =
          res.data.payment_url || bookingObj.payment_url || null;

        saveBookingEntry({
          booking_code: bookingObj.booking_code,
          guest_token: res.data.guest_access_token || null,
          payment_url: rawPaymentUrl,
          recipient_email:
            trimmedRecipientEmail ||
            res.data.recipient_email ||
            bookingObj.recipient_email ||
            trimmedEmail,
          event_name: data.eventNama,
        });

        try {
          sessionStorage.removeItem("ticketwave_checkout");
        } catch {
          // ignore
        }

        const officialPaymentUrl = getOfficialPaymentUrl({
          status: bookingObj.status || "pending_payment",
          booking_code: bookingObj.booking_code,
          payment_url: rawPaymentUrl,
        });

        if (officialPaymentUrl) {
          savePaymentReturnContext({
            booking_code: bookingObj.booking_code,
            return_path: `/user/pesanan/${encodeURIComponent(bookingObj.booking_code)}?payment_return=1`,
            owner_user_id: user?.id ?? null,
            owner_email: user?.email || trimmedEmail,
            is_guest: !isAuthenticated,
          });
          window.location.assign(officialPaymentUrl);
          return;
        }

        setCreatedBooking({
          booking_code: bookingObj.booking_code,
          payment_url: rawPaymentUrl,
          selected_method: selectedPaymentMethod,
        });
        setPesan({
          tipe: "warning",
          teks: "Pesanan berhasil dibuat, tetapi layanan pembayaran belum tersedia.",
        });
        setSubmitting(false);
      } else {
        submitLockRef.current = false;
        setSubmitting(false);
        setPesan({
          tipe: "error",
          teks: res.message || "Gagal membuat pesanan.",
        });
      }
    } catch (err) {
      submitLockRef.current = false;
      setSubmitting(false);
      setPesan({
        tipe: "error",
        teks: err.message || "Terjadi kesalahan saat menghubungi server.",
      });
    }
  };

  if (!ready || selectionLoading) {
    return (
      <p className="px-6 py-16 text-center">
        Memverifikasi harga dan stok tiket...
      </p>
    );
  }

  if (selectionError) {
    return (
      <div role="alert" className="mx-auto max-w-3xl px-6 py-16">
        <p>{selectionError}</p>
        <button
          type="button"
          onClick={() => {
            setSelectionLoading(true);
            setSelectionReload((value) => value + 1);
          }}
        >
          Coba Lagi
        </button>
        <Link href="/user/event"> Pilih Event</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <EmptyState
          judul="Belum ada tiket yang dipilih"
          deskripsi="Pilih event dan tiket terlebih dahulu untuk melanjutkan ke checkout."
          aksiLabel="Jelajahi Event"
          aksiHref="/user/event"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <Link
        href={`/user/event/${data.eventId}`}
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#0080f2] dark:text-slate-400 dark:hover:text-[#0080f2]"
      >
        <ArrowLeft size={17} />
        Kembali ke Detail Event
      </Link>

      <h1 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        Konfirmasi Checkout
      </h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Kiri: 1. Informasi Event -> 2. Tiket Dipilih -> 3. Data Pembeli & Penerima E-Ticket -> 4. Metode Pembayaran */}
        <div className="space-y-6">
          {/* 1. Informasi Event */}
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col sm:flex-row">
              <img
                src={data.gambar}
                alt={data.eventNama}
                className="h-40 w-full object-cover sm:h-auto sm:w-52"
              />

              <div className="p-5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {data.eventNama}
                </h2>

                <div className="mt-3 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                  <p className="flex items-center gap-2">
                    <CalendarDays size={14} className="text-slate-400" />
                    {formatTanggal(data.eventTanggal)}
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock size={14} className="text-slate-400" />
                    {data.eventWaktu}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin size={14} className="text-slate-400" />
                    {data.venue ? `${data.venue}, ${data.lokasi}` : data.lokasi}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Tiket Dipilih */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Tiket Dipilih
            </h3>

            <div className="mt-4 space-y-3">
              {items.map((item, idx) => (
                <div
                  key={item.ticket_type_id || item.id || idx}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70"
                >
                  <div>
                    <p className="text-xs font-medium text-slate-900 dark:text-white">
                      {item.nama}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {item.jumlah} tiket × {formatRupiah(item.harga)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatRupiah(item.harga * item.jumlah)}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-3 text-[11px] text-slate-400">
              Total {totalTiket} tiket (Maksimal 10 tiket per transaksi)
            </p>
          </div>

          {/* 3. Data Pembeli & Penerima E-Ticket */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Data Pembeli &amp; Penerima E-Ticket
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Data ini dikirim ke endpoint{" "}
                  <code className="font-medium">POST /api/checkout</code> untuk
                  penerbitan kode booking dan e-ticket.
                </p>
              </div>

              {ready && isAuthenticated && user ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/60 bg-blue-50 px-3 py-1 text-xs font-medium text-[#0080f2] dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
                  <UserCheck size={13} />
                  Terisi Otomatis
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <Sparkles size={13} />
                  Guest Checkout
                </span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="checkout-buyer-name"
                  className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Nama Lengkap Pembeli *
                </label>
                <input
                  id="checkout-buyer-name"
                  type="text"
                  value={buyerName}
                  disabled={submitting || Boolean(createdBooking)}
                  onChange={(e) => setManualBuyerName(e.target.value)}
                  placeholder="Nama lengkap sesuai identitas"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0080f2] focus:ring-1 focus:ring-[#0080f2] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-[#0080f2]"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="checkout-buyer-email"
                    className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Email Pembeli *
                  </label>
                  <input
                    id="checkout-buyer-email"
                    type="email"
                    value={buyerEmail}
                    disabled={submitting || Boolean(createdBooking)}
                    onChange={(e) => setManualBuyerEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0080f2] focus:ring-1 focus:ring-[#0080f2] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-[#0080f2]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="checkout-buyer-phone"
                    className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Nomor Telepon / WhatsApp *
                  </label>
                  <input
                    id="checkout-buyer-phone"
                    type="tel"
                    value={buyerPhone}
                    disabled={submitting || Boolean(createdBooking)}
                    onChange={(e) => setManualBuyerPhone(e.target.value)}
                    placeholder="081234567890"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0080f2] focus:ring-1 focus:ring-[#0080f2] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-[#0080f2]"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="checkout-recipient-email"
                  className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Email Penerima Tiket (Opsional)
                </label>
                <input
                  id="checkout-recipient-email"
                  type="email"
                  value={recipientEmail}
                  disabled={submitting || Boolean(createdBooking)}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="Kosongkan jika sama dengan email pembeli"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0080f2] focus:ring-1 focus:ring-[#0080f2] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-[#0080f2]"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Jika diisi, e-tiket dan salinan booking juga akan dikirimkan ke
                  alamat email ini.
                </p>
              </div>
            </div>
          </div>

          {/* 4. Metode Pembayaran */}
          <PaymentMethod
            selectedPaymentMethod={selectedPaymentMethod}
            onSelectPaymentMethod={handleSelectPaymentMethod}
            error={paymentMethodError}
            disabled={submitting || Boolean(createdBooking)}
            sectionRef={paymentMethodSectionRef}
          />
        </div>

        {/* Kanan: 5. Ringkasan Pembayaran -> 6. Tombol Lanjut ke Pembayaran */}
        <div className="h-fit space-y-4 lg:sticky lg:top-28">
          <CheckoutSummary items={items} diskon={diskonFase} total={total} />

          {!isPaymentMethodSelected && !createdBooking && (
            <p className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              Pilih metode pembayaran terlebih dahulu untuk mengaktifkan tombol pembayaran.
            </p>
          )}

          {pesan && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-xl border border-slate-300 bg-slate-100 p-4 text-xs leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <div className="flex items-start gap-2.5">
                {pesan.tipe === "error" || pesan.tipe === "warning" ? (
                  <ShieldAlert
                    size={16}
                    className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                  />
                ) : (
                  <CheckCircle2
                    size={16}
                    className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  />
                )}
                <div className="space-y-1">
                  <p className="font-medium">{pesan.teks}</p>
                  {createdBooking?.booking_code && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Kode Booking Resmi:{" "}
                      <strong className="font-mono text-slate-900 dark:text-white">
                        {createdBooking.booking_code}
                      </strong>
                    </p>
                  )}
                </div>
              </div>

              {createdBooking?.booking_code && (
                <Link
                  href={`/user/pesanan/${encodeURIComponent(
                    createdBooking.booking_code
                  )}`}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                >
                  <span>Lihat Detail Pesanan</span>
                  <ArrowRight size={14} />
                </Link>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={konfirmasiPesanan}
            disabled={isCheckoutDisabled}
            className="w-full cursor-pointer rounded-xl bg-[#0080f2] hover:bg-[#0070d4] py-3 text-sm font-medium text-white shadow-xs transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? "Memproses Pesanan..."
              : `Lanjut ke Pembayaran — ${formatRupiah(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
