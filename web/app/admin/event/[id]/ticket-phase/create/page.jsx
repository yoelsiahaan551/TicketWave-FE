"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import api from "@/app/lib/api";

function CreateTicketPhaseContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = params?.id;
  const queryTicketTypeId = searchParams.get("ticketTypeId");

  const [ticketTypes, setTicketTypes] = useState([]);
  const [ticketTypeId, setTicketTypeId] = useState(queryTicketTypeId || "");
  const [phaseName, setPhaseName] = useState("early_bird");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [discount, setDiscount] = useState(10);

  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    api
      .get(`/events/${eventId}`)
      .then((res) => {
        if (!active) return;
        const tts = res.data?.ticket_types || [];
        setTicketTypes(tts);
        setTicketTypeId(tts.some((tt) => String(tt.id) === queryTicketTypeId)
          ? queryTicketTypeId : String(tts[0]?.id || ""));
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setTicketTypes([]);
        setError(err.message || "Gagal memuat kategori tiket.");
        setLoading(false);
      });
    return () => { active = false; };
  }, [eventId, queryTicketTypeId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || submitting) return;
    if (!ticketTypes.some((tt) => String(tt.id) === String(ticketTypeId))) {
      setError("Pilih kategori tiket terlebih dahulu.");
      return;
    }

    if (!startDate || !endDate || startDate >= endDate || !Number.isFinite(Number(discount)) || Number(discount) < 0 || Number(discount) > 100) {
      setError("Tanggal akhir harus setelah tanggal mulai dan diskon harus 0–100%.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      await api.post(`/ticket-types/${ticketTypeId}/phases`, {
        phase_name: phaseName,
        start_date: startDate,
        end_date: endDate,
        discount_percent: parseFloat(discount),
      });
      router.push(
        `/admin/event/${eventId}/ticket-phase?ticketTypeId=${ticketTypeId}`
      );
    } catch (err) {
      setError(
        err.message ||
          "Gagal membuat fase harga. Pastikan start_date < end_date dan tidak tumpang tindih dengan fase lain."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/event/${eventId}/ticket-phase${
          ticketTypeId ? `?ticketTypeId=${ticketTypeId}` : ""
        }`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft size={14} />
        Kembali ke Daftar Fase Tiket
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
          Tambah Fase Harga Tiket
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Terhubung dengan <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">POST /api/ticket-types/&lt;ticket_type_id&gt;/phases</code>. Sistem otomatis memvalidasi tumpang tindih tanggal.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Main Info (Left 8 cols) */}
          <div className="space-y-6 xl:col-span-8">
            <div className="space-y-5 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Pengaturan Periode &amp; Diskon
              </h2>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-300 bg-slate-100 p-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Kategori Tiket *
                </label>
                <select
                  required
                  value={ticketTypeId}
                  onChange={(e) => setTicketTypeId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                >
                  <option value="">-- Pilih Kategori Tiket --</option>
                  {ticketTypes.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name} (Rp {Number(tt.base_price).toLocaleString("id-ID")})
                    </option>
                  ))}
                </select>
              </div>

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
                    Tanggal Mulai (Start Date) *
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
                    Tanggal Berakhir (End Date) *
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
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Isi 0% untuk fase harga normal tanpa potongan.
                </p>
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
                Fase yang aktif pada tanggal hari ini otomatis menjadi harga penawaran di halaman checkout publik.
              </p>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting || loading || !ticketTypes.length}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-xs transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 disabled:opacity-50"
                >
                  {submitting ? "Menyimpan..." : "Simpan Fase Harga"}
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

export default function CreateTicketPhasePage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-xs text-slate-500">
          Memuat formulir fase tiket...
        </div>
      }
    >
      <CreateTicketPhaseContent />
    </Suspense>
  );
}
