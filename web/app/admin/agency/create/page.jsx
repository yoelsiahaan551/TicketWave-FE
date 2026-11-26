"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Building2, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import api from "@/app/lib/api";
import { ADMIN_MEDIA_ACCEPT } from "@/app/lib/adminForms";
import { useAdminMediaPreview } from "@/app/lib/useAdminMediaPreview";

export default function CreateAgencyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [picName, setPicName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const {
    file: logoFile,
    previewUrl: logoPreview,
    error: logoError,
    clearPendingFile: clearLogoPending,
    handleFileChange: handleLogoChange,
  } = useAdminMediaPreview();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [createdId, setCreatedId] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || createdId || successMsg || warning) return;
    setSubmitting(true);
    setError(null);
    setWarning(null);
    setSuccessMsg(null);

    if (name.trim().length < 2 || name.trim().length > 150 || picName.trim().length < 2 || picName.trim().length > 120) {
      setError("Nama agency harus 2–150 karakter dan nama PIC 2–120 karakter.");
      setSubmitting(false);
      return;
    }
    const trimmedPhone = phone.trim();
    if (trimmedPhone.length < 8) {
      setError("Nomor telepon minimal 8 karakter.");
      setSubmitting(false);
      return;
    }
    if (trimmedPhone.length > 20) {
      setError("Nomor telepon maksimal 20 karakter.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await api.post("/agencies", {
        name: name.trim(),
        pic_name: picName.trim(),
        email: email.trim(),
        phone: trimmedPhone,
        address: address.trim() || undefined,
      });

      const createdAgencyId = res.data?.id;
      if (createdAgencyId) setCreatedId(createdAgencyId);
      let logoUploadFailed = false;

      if (createdAgencyId && logoFile) {
        try {
          const formData = new FormData();
          formData.append("logo", logoFile);
          const uploadRes = await api.upload(`/agencies/${createdAgencyId}/logo`, formData);
          clearLogoPending(uploadRes?.data?.logo_url);
        } catch (uploadErr) {
          setWarning(`Agency berhasil dibuat, tetapi logo gagal diunggah: ${uploadErr.message || "Gagal terhubung ke layanan unggahan."} Silakan unggah ulang melalui halaman edit Agency.`);
          logoUploadFailed = true;
        }
      }

      if (logoUploadFailed) {
        return;
      } else {
        setSuccessMsg("Agency berhasil ditambahkan!");
        setTimeout(() => {
          router.push("/admin/agency");
        }, 800);
      }
    } catch (err) {
      setError(err.message || "Gagal membuat agency baru.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/agency"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft size={14} />
        Kembali ke Daftar Agency
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
          Tambah Agency Baru
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Terhubung dengan <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">POST /api/agencies</code> dan <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">POST /api/agencies/&lt;id&gt;/logo</code>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Main Info (Left 8 cols) */}
          <div className="space-y-6 xl:col-span-8">
            <div className="space-y-5 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Informasi Utama Agency
              </h2>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-300 bg-slate-100 p-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400" />
                  <span>{error}</span>
                </div>
              )}

              {warning && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs font-medium text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1">
                    <span>{warning} {createdId && <Link href={`/admin/agency/${createdId}/edit`} className="underline">Unggah ulang logo</Link>}</span>
                    <div className="mt-2">
                      <Link
                        href="/admin/agency"
                        className="inline-flex items-center text-[11px] font-semibold text-amber-700 underline hover:text-amber-900 dark:text-amber-300"
                      >
                        Kembali ke Daftar Agency sekarang &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {successMsg && (
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-300 bg-slate-100 p-3 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <CheckCircle2 size={16} className="shrink-0 text-slate-500 dark:text-slate-400" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Nama Agency *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Live Nation Indonesia"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                />
              </div>

              {/* PIC Name */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Nama Penanggung Jawab (PIC) *
                </label>
                <input
                  type="text"
                  required
                  value={picName}
                  onChange={(e) => setPicName(e.target.value)}
                  placeholder="Nama lengkap PIC"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                />
              </div>

              {/* Email & Phone */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Email Resmi *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@agency.com"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Nomor Telepon *
                  </label>
                  <input
                    type="tel"
                    required
                    minLength={8}
                    maxLength={20}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="081234567890"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Minimal 8 karakter, maksimal 20 karakter.</p>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Alamat Kantor
                </label>
                <textarea
                  rows={4}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Alamat lengkap agency atau kantor perwakilan..."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Side Panel (Right 4 cols) */}
          <div className="space-y-6 xl:col-span-4">
            {/* Actions Card (Sticky on desktop) */}
            <div className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs xl:sticky xl:top-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Aksi Penyimpanan
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pastikan data PIC dan kontak sudah sesuai untuk pengiriman kredensial.
              </p>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting || Boolean(createdId) || Boolean(successMsg) || Boolean(warning)}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#0080f2] px-4 py-2.5 text-xs font-medium text-white shadow-xs transition hover:bg-[#0070d4] disabled:opacity-50"
                >
                  {submitting ? "Menyimpan..." : "Simpan Agency"}
                </button>
                <Link
                  href="/admin/agency"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Batal
                </Link>
              </div>
            </div>

            {/* Logo Card */}
            <div className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Logo Agency (Opsional)
              </label>
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-800">
                  {logoPreview ? (
                    <Image
                      width={112}
                      height={112}
                      unoptimized
                      src={logoPreview}
                      alt="Logo"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Building2 size={32} className="text-slate-300 dark:text-slate-600" />
                  )}
                </div>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white">
                    <Upload size={13} />
                    Pilih File Logo
                  </span>
                  <input
                    type="file"
                    accept={ADMIN_MEDIA_ACCEPT}
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </label>
                {logoError && (
                  <p
                    role="alert"
                    className="flex w-full items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                  >
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    <span>{logoError}</span>
                  </p>
                )}
                <p className="text-center text-[11px] text-slate-400">
                  JPG, PNG, atau WEBP maks. 5MB
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
