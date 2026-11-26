"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { resolveOrderPaymentState } from "@/app/lib/payment";

export default function OrderCard({ order, event = null, tickets = [] }) {
  if (!order) return null;

  const formatRupiah = (n) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n);

  const formatTanggal = (d) => {
    if (!d) return "-";
    try {
      return new Date(d).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  const normalizedBooking = {
    ...order,
    status:
      order.status === "menunggu_pembayaran"
        ? "pending_payment"
        : order.status === "dibatalkan"
        ? "cancelled"
        : order.status === "selesai"
        ? "paid"
        : order.status,
  };
  const orderState = resolveOrderPaymentState(normalizedBooking, event, tickets);
  const bisaLanjutBayar =
    orderState.code === "pending_payment" &&
    (!order.payment_url || orderState.canPay);
  const orderId = order.id || order.booking_code;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            No. Pesanan
          </p>
          <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
            {order.nomor || order.booking_code}
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${orderState.badgeClass}`}
        >
          {orderState.label}
        </span>
      </div>

      {orderState.description &&
        ["expired", "event_ended", "sales_closed"].includes(orderState.code) && (
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            {orderState.description}
          </p>
        )}

      <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
        <div>
          <p className="text-xs font-medium text-slate-500">Event</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
            {order.eventNama || order.event_name}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Tanggal Pesan</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
            <CalendarDays size={14} className="text-slate-400" />
            {formatTanggal(order.dibuatPada || order.created_at)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Jumlah Tiket</p>
          <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">
            {order.jumlahTiket || order.quantity} tiket
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Total</p>
          <p className="mt-0.5 text-sm font-bold text-[#0080f2]">
            {formatRupiah(order.total || order.total_price)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2.5">
        <Link
          href={`/user/pesanan/${orderId}`}
          className="flex items-center gap-1.5 rounded-xl bg-[#0080f2] hover:bg-[#0070d4] px-4 py-2 text-xs font-medium text-white shadow-xs transition"
        >
          Lihat Detail
          <ChevronRight size={14} />
        </Link>
        {bisaLanjutBayar && (
          <Link
            href={`/user/pesanan/${orderId}`}
            className="flex items-center rounded-xl border border-[#0080f2] px-4 py-2 text-xs font-medium text-[#0080f2] transition hover:bg-blue-50/50 dark:border-blue-500/60 dark:text-blue-400 dark:hover:bg-blue-950/30"
          >
            Lanjutkan Pembayaran
          </Link>
        )}
      </div>
    </div>
  );
}
