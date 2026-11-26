"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import api from "@/app/lib/api";

export default function EditTicketPhasePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params?.id;
  const phaseId = params?.phaseId;

  const [ticketTypeId, setTicketTypeId] = useState(null);
  const [phaseName, setPhaseName] = useState("early_bird");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [discount, setDiscount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (!phaseId) return;
    let ignore = false;
    api
      .get(`/phases/${phaseId}`)
      .then((res) => {
        if (ignore) return;
        const ph = res.data;
        if (ph) {
          setLoaded(true);
          setTicketTypeId(ph.ticket_type_id);
          setPhaseName(ph.phase_name || "early_bird");
          setStartDate(ph.start_date || "");
          setEndDate(ph.end_date || "");
          setDiscount(ph.discount_percent ?? 0);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || "Gagal memuat detail fase harga.");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [phaseId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!loaded || submitting) return;
    if (!startDate || !endDate || startDate >= endDate || !Number.isFinite(Number(discount)) || Number(discount) < 0 || Number(discount) > 100) {
      setError("Tanggal akhir harus setelah tanggal mulai dan diskon harus 0–100%.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await api.put(`/phases/${phaseId}`, {
        phase_name: phaseName,
        start_date: startDate,
        end_date: endDate,
        discount_percent: parseFloat(discount),
      });
      setSuccessMsg("Fase harga berhasil diperbarui!");
      setTimeout(() => {
        router.push(
          `/admin/event/${eventId}/ticket-phase${
            ticketTypeId ? `?ticketTypeId=${ticketTypeId}` : ""
          }`
        );
      }, 800);
    } catch (err) {
      setError(
        err.message ||
          "Gagal memperbarui fase harga. Periksa rentang tanggal agar tidak tumpang tindih."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="h-72 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800 xl:col-span-8" />
          <div className="h-56 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800 xl:col-span-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <Link
        href={`/admin/event/${eventId}/ticket-phase${
          ticketTypeId ? `?ticketTypeId=${ticketTypeId}` : ""
        }`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft size={14} />
        Kembali ke Fase Tiket
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
          Edit Fase Harga #{phaseId}
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Perbarui fase harga melalui <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">PUT /api/phases/{phaseId}</code>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Main Info (Left 8 cols) */}
          <div className="space-y-6 xl:col-span-8">
            <div className="space-y-5 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Informasi Periode &amp; Diskon
              </h2>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-300 bg-slate-100 p-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-300 bg-slate-100 p-3 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Nama Fase *
                </label>
                <select
                  value={phaseName}
                  onChange={(e) => setPhaseName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                >
                  <option value="early_bird">Early Bird</option>
                  <option value="presale">Presale</option>
                  <option value="normal">Normal</option>
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Tanggal Mulai *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Tanggal Berakhir *
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Persentase Diskon (0 – 100%) *
                </label>
                <div className="flex items-center gap-2.5">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    required
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-32 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    %
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Side Panel (Right 4 cols) */}
          <div className="space-y-6 xl:col-span-4">
            <div className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs xl:sticky xl:top-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Aksi Penyimpanan
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pastikan rentang tanggal tidak bertabrakan dengan fase lain pada kategori tiket yang sama.
              </p>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting || !loaded}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-xs transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 disabled:opacity-50"
                >
                  {submitting ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
                <Link
                  href={`/admin/event/${eventId}/ticket-phase${
                    ticketTypeId ? `?ticketTypeId=${ticketTypeId}` : ""
                  }`}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Batal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
