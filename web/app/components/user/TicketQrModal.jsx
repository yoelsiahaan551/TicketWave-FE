"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, CheckCircle2, Clock, AlertTriangle, Ban } from "lucide-react";
import TicketQr from "@/app/components/user/TicketQr";

const MODAL_STATUS_LABELS = {
  pending_payment: "Menunggu Pembayaran",
  expired: "Kedaluwarsa",
  valid: "Valid / Aktif",
  used: "Sudah Digunakan",
  event_ended: "Acara Selesai",
  cancelled: "Dibatalkan",
};

function formatCheckInTimestamp(rawValue) {
  if (typeof rawValue !== "string" || !rawValue.trim()) return "-";
  const trimmed = rawValue.trim();
  const normalized = /Z$|[+-]\d{2}:?\d{2}$/.test(trimmed)
    ? trimmed
    : `${trimmed}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toLocaleString("id-ID");
}

export default function TicketQrModal({
  isOpen,
  tickets,
  initialTicketCode = null,
  showOrderLink = true,
  onClose,
}) {
  const [selectedCode, setSelectedCode] = useState(initialTicketCode);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const ticketList = Array.isArray(tickets)
    ? tickets.filter(Boolean)
    : tickets
    ? [tickets]
    : [];

  if (!isOpen || ticketList.length === 0) return null;

  const activeTicket =
    ticketList.find((item) => item.ticket_code === selectedCode) ||
    ticketList.find((item) => item.ticket_code === initialTicketCode) ||
    ticketList[0];

  const isPaidOrder = activeTicket.booking_status === "paid";
  const isUsed = activeTicket.status === "used" || Boolean(activeTicket.checked_in_at);
  const isEventEnded = Boolean(activeTicket.is_event_ended) || activeTicket.status === "event_ended";
  const canShowActiveQr =
    isPaidOrder &&
    activeTicket.status === "valid" &&
    !isUsed &&
    !isEventEnded &&
    Boolean(activeTicket.qr_token);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Detail E-Ticket ${activeTicket.ticket_code || ""}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
      onClick={() => onClose?.()}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-slate-900 px-5 py-3.5 text-white dark:bg-slate-800">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              TicketWave Official Pass
            </p>
            <h3 className="font-mono text-sm font-semibold">{activeTicket.ticket_code}</h3>
          </div>
          <button
            type="button"
            aria-label="Tutup modal QR"
            onClick={() => onClose?.()}
            className="rounded-lg bg-white/10 p-1.5 text-white transition-colors hover:bg-white/20"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {ticketList.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {ticketList.map((item, idx) => {
                const isSelected = item.ticket_code === activeTicket.ticket_code;
                return (
                  <button
                    key={item.ticket_code || idx}
                    type="button"
                    onClick={() => setSelectedCode(item.ticket_code)}
                    className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-medium transition ${
                      isSelected
                        ? "bg-[#0080f2] text-white"
                        : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {item.ticket_code}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-col items-center justify-center">
            {canShowActiveQr ? (
              <TicketQr
                value={activeTicket.qr_token}
                ticketCode={activeTicket.ticket_code}
                size={240}
                showCode
              />
            ) : isUsed ? (
              <div className="w-full rounded-xl border border-amber-200 bg-amber-50/80 p-5 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
                <AlertTriangle className="mx-auto h-8 w-8 text-amber-600 dark:text-amber-400" />
                <p className="mt-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Sudah Digunakan
                </p>
                <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-300/90">
                  Tiket ini sudah selesai check-in di gate dan tidak lagi aktif sebagai QR masuk.
                </p>
                <p className="mt-3 font-mono text-xs font-bold tracking-wider text-slate-900 dark:text-white">
                  {activeTicket.ticket_code}
                </p>
              </div>
            ) : isEventEnded ? (
              <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-5 text-center dark:border-slate-700 dark:bg-slate-800/60">
                <Clock className="mx-auto h-8 w-8 text-slate-500 dark:text-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                  Acara Selesai
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Acara telah berakhir. QR pass tidak lagi berlaku untuk check-in, tetapi riwayat tiket Anda tetap tersimpan.
                </p>
                <p className="mt-3 font-mono text-xs font-bold tracking-wider text-slate-800 dark:text-slate-200">
                  {activeTicket.ticket_code}
                </p>
              </div>
            ) : (
              <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-5 text-center dark:border-slate-800 dark:bg-slate-800/60">
                {activeTicket.status === "cancelled" ? (
                  <Ban className="mx-auto h-8 w-8 text-slate-500" />
                ) : (
                  <Clock className="mx-auto h-8 w-8 text-slate-500" />
                )}
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                  QR Belum Aktif
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Status: {MODAL_STATUS_LABELS[activeTicket.status] || activeTicket.status}
                </p>
                <p className="mt-3 font-mono text-xs font-bold tracking-wider text-slate-800 dark:text-slate-200">
                  {activeTicket.ticket_code}
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2 text-xs">
            <div className="flex justify-between gap-3 border-b border-slate-100 pb-1.5 dark:border-slate-800">
              <span className="text-slate-500">Event</span>
              <span className="text-right font-medium text-slate-900 dark:text-white">
                {activeTicket.event_name || "Event TicketWave"}
              </span>
            </div>
            <div className="flex justify-between gap-3 border-b border-slate-100 pb-1.5 dark:border-slate-800">
              <span className="text-slate-500">Kategori Tiket</span>
              <span className="text-right font-medium text-slate-800 dark:text-slate-200">
                {activeTicket.ticket_type_name || "Standard"}
              </span>
            </div>
            <div className="flex justify-between gap-3 border-b border-slate-100 pb-1.5 dark:border-slate-800">
              <span className="text-slate-500">Pemegang / Pembeli</span>
              <span className="text-right font-medium text-slate-900 dark:text-white">
                {activeTicket.buyer_name || "-"}
              </span>
            </div>
            <div className="flex justify-between gap-3 border-b border-slate-100 pb-1.5 dark:border-slate-800">
              <span className="text-slate-500">Status Tiket</span>
              <span className="inline-flex items-center gap-1 font-medium text-slate-900 dark:text-white">
                {canShowActiveQr ? (
                  <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                ) : isUsed ? (
                  <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400" />
                ) : (
                  <Clock size={13} className="text-slate-500 dark:text-slate-400" />
                )}
                {isUsed
                  ? "Sudah Digunakan"
                  : MODAL_STATUS_LABELS[activeTicket.status] || activeTicket.status}
              </span>
            </div>
            {activeTicket.checked_in_at && (
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-1.5 dark:border-slate-800">
                <span className="text-slate-500">Waktu Check-In</span>
                <span className="text-right font-medium text-slate-900 dark:text-white">
                  {formatCheckInTimestamp(activeTicket.checked_in_at)}
                </span>
              </div>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            {showOrderLink && activeTicket.booking_code && (
              <Link
                href={`/user/pesanan/${activeTicket.booking_code}`}
                onClick={() => onClose?.()}
                className="flex-1 rounded-xl border border-slate-200/80 py-2 text-center text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Lihat Pesanan
              </Link>
            )}
            <button
              type="button"
              onClick={() => onClose?.()}
              className="flex-1 rounded-xl bg-[#0080f2] py-2 text-xs font-medium text-white shadow-xs transition-colors hover:bg-[#0070d4]"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
