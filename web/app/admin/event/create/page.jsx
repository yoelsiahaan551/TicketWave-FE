"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Upload,
  Plus,
  Trash2,
  AlertCircle,
  Ticket,
} from "lucide-react";
import api from "@/app/lib/api";
import { ADMIN_MEDIA_ACCEPT, validateEventCreate } from "@/app/lib/adminForms";
import { useAdminMediaPreview } from "@/app/lib/useAdminMediaPreview";

export default function CreateEventPage() {
  const router = useRouter();

  const [agencies, setAgencies] = useState([]);
  const [eventType, setEventType] = useState("single");
  const [name, setName] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");

  // Single event fields
  const [artistName, setArtistName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("19:00");
  const [eventEndTime, setEventEndTime] = useState("");

  // Festival fields
  const [daysCount, setDaysCount] = useState(2);
  const [festivalArtists, setFestivalArtists] = useState([
    { day_number: 1, artist_name: "" },
  ]);

  // Nested Ticket Types (Required during POST /api/events because BE has no standalone POST /api/ticket-types)
  const [ticketTypes, setTicketTypes] = useState([
    {
      name: "Regular",
      base_price: 350000,
      quota: 200,
      description: "Tiket masuk reguler",
      phases: [],
    },
  ]);

  // Optional initial status transition after creation
  const [initialStatus, setInitialStatus] = useState("draft");

  // Media files
  const {
    file: posterFile,
    previewUrl: posterPreview,
    error: posterError,
    handleFileChange: handlePosterChange,
  } = useAdminMediaPreview();
  const {
    file: bannerFile,
    previewUrl: bannerPreview,
    error: bannerError,
    handleFileChange: handleBannerChange,
  } = useAdminMediaPreview();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [createdId, setCreatedId] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadAgencies() {
      try {
        const list = [];
        let page = 1;
        let totalPages = 1;
        do {
          const res = await api.get("/agencies", { page, per_page: 50 });
          list.push(...(res.data?.items || []));
          totalPages = res.data?.total_pages ?? 1;
          page += 1;
        } while (page <= totalPages);
        if (active) setAgencies(list);
      } catch (err) {
        if (active) setError(err.message || "Gagal memuat pilihan agency.");
      }
    }
    loadAgencies();
    return () => { active = false; };
  }, []);

  const addFestivalArtist = () => {
    setFestivalArtists((prev) => [...prev, { day_number: 1, artist_name: "" }]);
  };

  const removeFestivalArtist = (idx) => {
    setFestivalArtists((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateFestivalArtist = (idx, field, val) => {
    setFestivalArtists((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    );
  };

  const addTicketType = () => {
    setTicketTypes((prev) => [
      ...prev,
      { name: "", base_price: 500000, quota: 100, description: "", phases: [] },
    ]);
  };

  const removeTicketType = (idx) => {
    setTicketTypes((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateTicketType = (idx, field, val) => {
    setTicketTypes((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    );
  };

  const addNestedPhase = (ttIdx) => {
    setTicketTypes((prev) =>
      prev.map((item, i) =>
        i === ttIdx
          ? {
              ...item,
              phases: [
                ...(item.phases || []),
                {
                  phase_name: "early_bird",
                  start_date: "",
                  end_date: "",
                  discount_percent: 10,
                },
              ],
            }
          : item
      )
    );
  };

  const removeNestedPhase = (ttIdx, pIdx) => {
    setTicketTypes((prev) =>
      prev.map((item, i) =>
        i === ttIdx
          ? {
              ...item,
              phases: (item.phases || []).filter((_, j) => j !== pIdx),
            }
          : item
      )
    );
  };

  const updateNestedPhase = (ttIdx, pIdx, field, val) => {
    setTicketTypes((prev) =>
      prev.map((item, i) =>
        i === ttIdx
          ? {
              ...item,
              phases: (item.phases || []).map((ph, j) =>
                j === pIdx ? { ...ph, [field]: val } : ph
              ),
            }
          : item
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (createdId || submitting) return;
    if (!agencyId) {
      setError("Silakan pilih Agency penyelenggara terlebih dahulu.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      agency_id: Number(agencyId),
      name: name.trim(),
      event_type: eventType,
      venue: venue.trim(),
      city: city.trim(),
      description: description.trim() || undefined,
      ticket_types: ticketTypes
        
        .map((t) => {
          const validPhases = (t.phases || [])
            
            .map((p) => ({
              phase_name: p.phase_name,
              start_date: p.start_date,
              end_date: p.end_date,
              discount_percent: Number(p.discount_percent || 0),
            }));
          return {
            name: t.name.trim(),
            base_price: Number(t.base_price),
            quota: Number(t.quota),
            description: t.description?.trim() || undefined,
            ...(validPhases.length > 0 ? { phases: validPhases } : {}),
          };
        }),
    };

    if (eventType === "single") {
      payload.artist_name = artistName.trim();
      payload.event_date = eventDate;
      payload.event_time = eventTime;
      if (eventEndTime) {
        payload.event_end_time = eventEndTime;
      }
    } else {
      payload.days_count = Number(daysCount);
      payload.festival_artists = festivalArtists
        
        .map((fa) => ({
          day_number: Number(fa.day_number),
          artist_name: fa.artist_name.trim(),
        }));
    }

    try {
      validateEventCreate(payload);
      const res = await api.post("/events", payload);
      const createdId = res.data?.id;

      if (createdId) {
        setCreatedId(createdId);
        const failures = [];
        // Terapkan status awal (misalnya "on_sale" agar langsung muncul di katalog publik)
        if (initialStatus && initialStatus !== "draft") {
          try {
            await api.patch(`/events/${createdId}/status`, {
              status: initialStatus,
            });
          } catch (statusErr) {
            failures.push(`Status gagal diperbarui: ${statusErr.message}`);
          }
        }

        // Upload media secara non-blocking terhadap pembuatan event (antisipasi jika Cloudinary belum disetting)
        if (posterFile) {
          try {
            const fd = new FormData();
            fd.append("poster", posterFile);
            await api.upload(`/events/${createdId}/poster`, fd);
          } catch (uploadErr) {
            failures.push(`Poster gagal diunggah: ${uploadErr.message}`);
          }
        }
        if (bannerFile) {
          try {
            const fd = new FormData();
            fd.append("banner", bannerFile);
            await api.upload(`/events/${createdId}/banner`, fd);
          } catch (uploadErr) {
            failures.push(`Banner gagal diunggah: ${uploadErr.message}`);
          }
        }
        if (failures.length) {
          setError(`Event #${createdId} sudah dibuat. ${failures.join(" ")} Buka detail event untuk mencoba kembali.`);
          return;
        }
        router.push(`/admin/event/${createdId}`);
      } else {
        router.push("/admin/event");
      }
    } catch (err) {
      setError(err.message || "Gagal membuat event baru.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/event"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={15} />
        Kembali ke Daftar Event
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Buat Event Baru
        </h1>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Buat event beserta kategori tiket, fase harga, dan unggah poster/banner resmi.
        </p>
      </div>

      {createdId && <Link href={`/admin/event/${createdId}`} className="text-xs font-medium text-[#0080f2] underline">Buka event #{createdId}</Link>}
      <form onSubmit={handleSubmit} className="w-full">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Left Column: Form Details & Tickets */}
          <div className="space-y-6 xl:col-span-8">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-slate-300 bg-slate-100 p-3.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-5 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                1. Informasi Dasar Event
              </h2>

              {/* Event Type */}
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Tipe Event *
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      id: "single",
                      title: "Single Event / Konser",
                      desc: "Wajib mengisi nama artis, tanggal, dan jam mulai",
                    },
                    {
                      id: "festival",
                      title: "Festival Multi-Hari",
                      desc: "Wajib mengisi jumlah hari (1–10) dan lineup artis per hari",
                    },
                  ].map((t) => (
                    <label
                      key={t.id}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3.5 transition-colors ${
                        eventType === t.id
                          ? "border-[#0080f2] bg-blue-50/40 dark:border-blue-600 dark:bg-blue-950/30"
                          : "border-slate-200/80 hover:border-slate-300 dark:border-slate-800"
                      }`}
                    >
                      <input
                        type="radio"
                        name="event_type"
                        value={t.id}
                        checked={eventType === t.id}
                        onChange={() => setEventType(t.id)}
                        className="text-[#0080f2] focus:ring-[#0080f2]"
                      />
                      <div>
                        <p className="text-xs font-medium text-slate-900 dark:text-white">
                          {t.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t.desc}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Name & Agency */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Nama Event *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: SoundWave Jakarta 2026"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Agency Penyelenggara *
                  </label>
                  <select
                    required
                    value={agencyId}
                    onChange={(e) => setAgencyId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                  >
                    <option value="">-- Pilih Agency --</option>
                    {agencies.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.name} (ID #{ag.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {eventType === "single" ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Nama Artis Utama *
                    </label>
                    <input
                      type="text"
                      required
                      value={artistName}
                      onChange={(e) => setArtistName(e.target.value)}
                      placeholder="Contoh: Tulus"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Tanggal Event *
                    </label>
                    <input
                      type="date"
                      required
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Jam Mulai (WIB) *
                    </label>
                    <input
                      type="time"
                      required
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Jam Selesai (WIB, opsional)
                    </label>
                    <input
                      type="time"
                      value={eventEndTime}
                      onChange={(e) => setEventEndTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Jumlah Hari Festival (1 – 10 Hari) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        required
                        value={daysCount}
                        onChange={(e) => setDaysCount(Number(e.target.value) || 1)}
                        className="mt-1.5 w-28 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addFestivalArtist}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      <Plus size={14} />
                      Tambah Artis Lineup
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {festivalArtists.map((fa, idx) => (
                      <div key={idx} className="flex items-center gap-2.5">
                        <div className="w-28">
                          <label className="mb-0.5 block text-[10px] font-medium text-slate-400">
                            Hari ke-
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={daysCount}
                            required
                            value={fa.day_number}
                            onChange={(e) =>
                              updateFestivalArtist(idx, "day_number", e.target.value)
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="mb-0.5 block text-[10px] font-medium text-slate-400">
                            Nama Penampil / Artis *
                          </label>
                          <input
                            type="text"
                            required
                            value={fa.artist_name}
                            onChange={(e) =>
                              updateFestivalArtist(idx, "artist_name", e.target.value)
                            }
                            placeholder="Nama band / penyanyi"
                            className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </div>
                        {festivalArtists.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeFestivalArtist(idx)}
                            className="mt-4 rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Venue & City */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Nama Venue *
                  </label>
                  <input
                    type="text"
                    required
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="Contoh: Istora Senayan"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Kota *
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Contoh: Jakarta"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Deskripsi Event
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Jelaskan informasi lengkap mengenai event..."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                />
              </div>
            </div>

            {/* Ticket Types Section */}
            <div className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <Ticket size={16} className="text-slate-400" />
                    2. Kategori Tiket (Ticket Types)
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Kategori tiket dibuat bersama event. Anda dapat menambahkan fase diskon pada tiap kategori.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addTicketType}
                  className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-xs transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  <Plus size={14} />
                  Tambah Kategori
                </button>
              </div>

              <div className="space-y-3">
                {ticketTypes.map((tt, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                          Nama Kategori *
                        </label>
                        <input
                          type="text"
                          required
                          value={tt.name}
                          onChange={(e) =>
                            updateTicketType(idx, "name", e.target.value)
                          }
                          placeholder="VIP / Regular"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                          Harga Dasar (IDR) *
                        </label>
                        <input
                          type="number"
                          min={0}
                          required
                          value={tt.base_price}
                          onChange={(e) =>
                            updateTicketType(idx, "base_price", e.target.value)
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                          Kuota Tiket *
                        </label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={tt.quota}
                          onChange={(e) =>
                            updateTicketType(idx, "quota", e.target.value)
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={tt.description}
                        onChange={(e) =>
                          updateTicketType(idx, "description", e.target.value)
                        }
                        placeholder="Deskripsi singkat (opsional)"
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => addNestedPhase(idx)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <Plus size={12} />
                        Fase Diskon
                      </button>
                      {ticketTypes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTicketType(idx)}
                          className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                          Hapus
                        </button>
                      )}
                    </div>

                    {/* Optional Nested Phases */}
                    {tt.phases && tt.phases.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-slate-200 pt-2.5 dark:border-slate-700">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Fase Diskon
                        </p>
                        {tt.phases.map((ph, pIdx) => (
                          <div
                            key={pIdx}
                            className="grid gap-2 rounded-xl border border-slate-200 bg-white p-2.5 sm:grid-cols-5 dark:border-slate-700 dark:bg-slate-900"
                          >
                            <div>
                              <label className="mb-0.5 block text-[10px] text-slate-400">
                                Fase
                              </label>
                              <select
                                value={ph.phase_name}
                                onChange={(e) =>
                                  updateNestedPhase(idx, pIdx, "phase_name", e.target.value)
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              >
                                <option value="early_bird">Early Bird</option>
                                <option value="presale">Presale</option>
                                <option value="normal">Normal</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-0.5 block text-[10px] text-slate-400">
                                Mulai *
                              </label>
                              <input
                                type="date"
                                required
                                value={ph.start_date}
                                onChange={(e) =>
                                  updateNestedPhase(idx, pIdx, "start_date", e.target.value)
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="mb-0.5 block text-[10px] text-slate-400">
                                Berakhir *
                              </label>
                              <input
                                type="date"
                                required
                                value={ph.end_date}
                                onChange={(e) =>
                                  updateNestedPhase(idx, pIdx, "end_date", e.target.value)
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="mb-0.5 block text-[10px] text-slate-400">
                                Diskon (%)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                max={100}
                                value={ph.discount_percent}
                                onChange={(e) =>
                                  updateNestedPhase(
                                    idx,
                                    pIdx,
                                    "discount_percent",
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              />
                            </div>
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() => removeNestedPhase(idx, pIdx)}
                                className="w-full rounded-lg border border-slate-300 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                              >
                                Hapus
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Actions & Media */}
          <div className="space-y-5 xl:col-span-4">
            {/* Sticky Actions & Status */}
            <div className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs xl:sticky xl:top-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Status &amp; Publikasi
              </h3>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Status Awal Event
                </label>
                <select
                  value={initialStatus}
                  onChange={(e) => setInitialStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                >
                  <option value="on_sale">ON SALE — Langsung tampil di Katalog</option>
                  <option value="published">PUBLISHED — Terpublikasi</option>
                  <option value="draft">DRAFT — Simpan draf internal</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Catatan: Hanya status <strong className="text-emerald-600 dark:text-emerald-400">ON SALE</strong> yang otomatis tampil pada katalog publik User (<code className="font-mono text-[10px]">/user/event</code> dan Home).
                </p>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={submitting || Boolean(createdId)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0080f2] px-4 py-2.5 text-xs font-medium text-white shadow-xs transition hover:bg-[#0070d4] disabled:opacity-50"
                >
                  <Ticket size={15} />
                  {submitting ? "Membuat Event..." : "Simpan & Publikasikan Event"}
                </button>
                <Link
                  href="/admin/event"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200/80 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Batal
                </Link>
              </div>
            </div>

            {/* Poster Upload */}
            <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Poster Event (Opsional)
              </label>
              <label className="flex min-h-60 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-slate-500">
                {posterPreview ? (
                  <Image
                    width={600}
                    height={800}
                    unoptimized
                    src={posterPreview}
                    alt="Poster"
                    className="h-auto max-h-72 w-auto max-w-full rounded-lg object-contain"
                  />
                ) : (
                  <>
                    <Upload size={22} className="text-slate-400" />
                    <span className="mt-1.5 text-xs text-slate-500">
                      Klik untuk memilih Poster
                    </span>
                    <span className="text-[10px] text-slate-400">
                      JPG, PNG, WEBP (maks. 5MB)
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept={ADMIN_MEDIA_ACCEPT}
                  className="hidden"
                  onChange={handlePosterChange}
                />
              </label>
              {posterError && (
                <p
                  role="alert"
                  className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  <span>{posterError}</span>
                </p>
              )}
            </div>

            {/* Banner Upload */}
            <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Banner Event (Opsional)
              </label>
              <label className="flex h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-2 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-slate-500">
                {bannerPreview ? (
                  <Image
                    width={640}
                    height={360}
                    unoptimized
                    src={bannerPreview}
                    alt="Banner"
                    className="h-auto max-h-36 w-auto max-w-full rounded-lg object-contain"
                  />
                ) : (
                  <>
                    <Upload size={22} className="text-slate-400" />
                    <span className="mt-1.5 text-xs text-slate-500">
                      Klik untuk memilih Banner
                    </span>
                    <span className="text-[10px] text-slate-400">
                      JPG, PNG, WEBP (maks. 5MB, rasio 16:9)
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept={ADMIN_MEDIA_ACCEPT}
                  className="hidden"
                  onChange={handleBannerChange}
                />
              </label>
              {bannerError && (
                <p
                  role="alert"
                  className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  <span>{bannerError}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
