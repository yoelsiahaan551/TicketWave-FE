# AUDIT FRONTEND (NEXT.JS) TICKETWAVE
**Dokumentasi Teknis Kesiapan Sistem, Arsitektur Halaman, dan Analisis Integrasi Backend**
**File Laporan:** `TicketWave-FE\web\BE.md`  
**Lokasi Audit:** `C:\Users\LOQ\Documents\TicketWave\TicketWave-FE\web`  
**Referensi Backend:** `C:\Users\LOQ\Documents\TicketWave\TicketWave-FE\BACKEND_ISSUES.md`  
**Tanggal Diperbarui:** 21 November 2026  
**Metode Audit:** Finalisasi Integrasi Full-Stack, Unit Test (BE `26/26` + FE `8/8`), Typecheck/Lint/Build, & Live E2E Browser + Midtrans Sandbox (`[E2E-WEB-FINAL-20261121]`)  
**Status Akhir:** `INTEGRATION FINALIZED — SANDBOX & LIVE WEB FLOWS PASS (DENGAN ITEM BLOCKED / NOT TESTED TERDOKUMENTASI)`

---

## DAFTAR ISI
1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [2. Inventarisasi Frontend](#2-inventarisasi-frontend)
   - 2.1 Struktur Halaman Next.js (App Router)
   - 2.2 Komponen dan Hierarki Layout
   - 2.3 Arsitektur API Service, HTTP Client, dan Lapisan Normalisasi
   - 2.4 State Management dan Penyimpanan Klien
   - 2.5 Mekanisme Autentikasi dan Proteksi Rute (Route Guards)
   - 2.6 Form dan Validasi Input
   - 2.7 Penanganan Loading, Error, dan Empty States
   - 2.8 Responsivitas Tampilan Desktop dan Mobile
   - 2.9 Integrasi Media dan Gambar
   - 2.10 Modul Portal: User, Admin, dan Officer
3. [3. Inventarisasi Pemanggilan API](#3-inventarisasi-pemanggilan-api)
   - 3.1 Tabel Lengkap Pemanggilan API Frontend ke Backend
4. [4. Analisis Fitur Frontend](#4-analisis-fitur-frontend)
   - 4.1 Kategori A: Berfungsi dan Terintegrasi Penuh
   - 4.2 Kategori B: Berfungsi Sebagian (Tergantung Kondisi Data)
   - 4.3 Kategori C: Tidak Berfungsi (Terblokir Masalah Teknis)
   - 4.4 Kategori D: Belum Terintegrasi (Ketiadaan Endpoint Backend)
   - 4.5 Kategori E: Tidak Dapat Diverifikasi
5. [5. Kesesuaian dengan Backend (Cross-Audit MD.BE.md)](#5-kesesuaian-dengan-backend-cross-audit-md-bemd)
   - 5.1 Dampak Ketiadaan Endpoint Backend
   - 5.2 Dampak Bug Fatal Logika Backend
   - 5.3 Perbedaan Kontrak Request dan Format Response JSON
   - 5.4 Autentikasi dan Keselarasan Role Authorization
   - 5.5 Arsitektur Riwayat Pesanan dan Tiket
   - 5.6 Alur Checkout dan Pembayaran Midtrans Snap
   - 5.7 Unggah Media dan Keterbatasan Cloudinary
   - 5.8 Pemisahan Tanggung Jawab: Masalah Frontend vs Masalah Backend
   - 5.9 Potensi Masalah Performa: Ketiadaan Database Composite Indexing
   - 5.10 Mekanisme Kedaluwarsa Pesanan Pasif (Stale Quota Locking)
6. [6. Daftar Masalah Frontend](#6-daftar-masalah-frontend)
   - 6.1 Rincian Permasalahan Teknis pada Frontend
7. [7. Matriks Prioritas Perbaikan](#7-matriks-prioritas-perbaikan)
8. [8. Rencana Penyelesaian dan Roadmap Integrasi](#8-rencana-penyelesaian-dan-roadmap-integrasi)
9. [9. Kesimpulan](#9-kesimpulan)

---

## 1. RINGKASAN EKSEKUTIF

Audit teknis ini mengevaluasi arsitektur, kesiapan fitur, dan integrasi API pada aplikasi web Frontend TicketWave (`TicketWave-FE/web`), yang dibangun di atas Next.js (App Router), React 19, Tailwind CSS v4, dan Lucide Icons. Berdasarkan audit backend sebelumnya pada [MD.BE.md](file:///c:/Users/LOQ/Documents/TicketWave/MD.BE.md), laporan ini memberikan tinjauan menyeluruh dari perspektif Frontend.

### Kondisi Keseluruhan Frontend:
1. **Kematangan Arsitektur UI:** Struktur antarmuka telah dikembangkan secara komprehensif, mencakup 3 area utama:
   - **Portal Pengguna (User):** Katalog event publik, pencarian & filter kota, detail konser tunggal & festival, alur pemilihan tiket, checkout, riwayat pemesanan, tiket digital QR, profil, dan preferensi tema.
   - **Portal Administrator (Admin):** Dashboard statistik ringkasan, manajemen CRUD agensi, manajemen CRUD event & status penerbitan, konfigurasi tiket & fase diskon (Early Bird / Presale), dan pemantauan sistem.
   - **Portal Petugas (Officer):** Dashboard kehadiran, pemindai kamera QR langsung (*live camera barcode scanner* menggunakan `html5-qrcode`), formulir validasi tiket manual, serta log riwayat pemindaian.
2. **Kesiapan Lapisan Integrasi Jaringan (`app/lib/api.js`):** Frontend telah dilengkapi dengan lapisan klien API mutakhir (`APIClient`) yang memiliki fitur:
   - Injeksi otomatis *Bearer Token* dari sesi (`sessionStorage`/`localStorage`).
   - Penanganan otomatis pembaruan token (*auto-refresh token* via endpoint `/api/auth/refresh` saat terjadi HTTP 401).
   - Normalisasi respons khusus (*defensive normalization*) untuk mengantisipasi ketidakkonsistenan backend, seperti pertukaran posisi argumen `data` dan `message` pada rute otentikasi.
   - Penolakan URL tiruan Midtrans (*anti-mock validation*) pada modul pembayaran.
3. **Status Penutupan Hambatan (21 November 2026):** Seluruh hambatan fungsional web yang tadinya memblokir Frontend telah diselesaikan dan diverifikasi end-to-end:
   - **Officer Portal (`/officer/*`):** Aktif penuh (validasi manual, upload QR PNG `Pindai Gambar QR`, check-in atomik `1x`, tolak unpaid `400`, tolak duplikat `409`, tolak event `finished`/`archived`/melewati `event_end_time` `400`); pemindaian kamera fisik langsung dicatat `NOT TESTED`.
   - **Detail Festival & Harga Diskon Pecahan:** Festival multi-day (`HTTP 200`), kalkulasi `calculate_final_price`, dan penyimpanan pecahan `Decimal` (`bookings.discount_percent NUMERIC(5,2)`, uji live `12.5%`) konsisten dari katalog hingga Midtrans Snap.
   - **Riwayat Pesanan Lintas Perangkat & Akses Aman:** `GET /api/checkout/my-bookings` melayani user login lintas perangkat, sementara pesanan Guest dilindungi `X-Guest-Token` HMAC & verifikasi email `X-Buyer-Email` tanpa membocorkan PII sebelum verifikasi sah.
   - **Edit Profil, Logout Revokasi JWT, & Upload Cloudinary:** `PUT /api/auth/me`, `POST /api/auth/logout` (`revoked_tokens`), dan unggah logo/poster/banner ke Cloudinary teruji lulus live.
   - **Item di Luar Cakupan / Masih `BLOCKED`:** Live SMTP (helper siap, tanpa kredensial `.env`), live public HTTPS webhook ke localhost (dimitigasi `POST .../sync-payment-status` Sandbox), fitur rencana (`ISSUE-05` User List Admin, `ISSUE-06` Laporan Omzet, `ISSUE-07` Penugasan Officer, `ISSUE-11` Kategori Event, Refund), batas waktu otomatis khusus festival tanpa jadwal akhir, dan **Diskon Khusus Akun Login** (ditahan menunggu keputusan produk).

---

## 2. INVENTARISASI FRONTEND

### 2.1 Struktur Halaman Next.js (App Router)
Aplikasi menggunakan struktur direktori Next.js App Router (`app/`):

| Rute URL | File Sumber Halaman | Akses / Role Guard | Deskripsi Halaman |
|---|---|---|---|
| `/` | `app/page.tsx` | Publik | Landing page utama (Hero, Trending Events, Promo, Kategori, FAQ) |
| `/login` | `app/login/page.jsx` | Publik (Non-auth) | Halaman login multi-role dengan splash screen & reset password modal |
| `/register` | `app/register/page.jsx` | Publik (Non-auth) | Registrasi pengguna baru dengan validasi dan auto-login |
| `/user/home` | `app/user/home/page.jsx` | Pengguna Terdaftar (`user`) | Beranda personalisasi pengguna, rekomendasi event, artis favorit |
| `/user/event` | `app/user/event/page.jsx` | Publik / Pengguna | Katalog eksplorasi event dengan search, filter kota, tipe event, sort |
| `/user/event/[id]` | `app/user/event/[id]/page.jsx` | Publik / Pengguna | Detail event, lineup musisi festival, seleksi tiket & kuota |
| `/user/checkout` | `app/user/checkout/page.jsx` | Pengguna Terdaftar (`user`) | Formulir data pembeli, ringkasan biaya, submit pesanan |
| `/user/pesanan` | `app/user/pesanan/page.jsx` | Pengguna Terdaftar (`user`) | Daftar seluruh pesanan aktif, pending, dan kadaluarsa |
| `/user/pesanan/[id]` | `app/user/pesanan/[id]/page.jsx` | Pengguna Terdaftar (`user`) | Detail pesanan, tombol pembayaran Midtrans, e-ticket, pembatalan |
| `/user/ticket` | `app/user/ticket/page.jsx` | Pengguna Terdaftar (`user`) | Dompet e-tiket digital, tampilan QR code untuk check-in venue |
| `/user/profile` | `app/user/profile/page.jsx` | Pengguna Terdaftar (`user`) | Tampilan profil akun dan statistik aktivitas pemesanan |
| `/user/settings` | `app/user/settings/page.jsx` | Pengguna Terdaftar (`user`) | Pengaturan preferensi akun, toggle tema visual, sesi login |
| `/admin` | `app/admin/page.jsx` | Administrator (`admin`) | Dashboard metrik agregat: total event, agensi, event on-sale |
| `/admin/settings` | `app/admin/settings/page.jsx` | Administrator (`admin`) | Pemantauan kesehatan backend (`/health`) dan konfigurasi tema |
| `/admin/agency` | `app/admin/agency/page.jsx` | Administrator (`admin`) | Daftar agensi terdaftar dengan pagination dan filter pencarian |
| `/admin/agency/create` | `app/admin/agency/create/page.jsx` | Administrator (`admin`) | Formulir pendaftaran agensi baru dan upload logo |
| `/admin/agency/[id]` | `app/admin/agency/[id]/page.jsx` | Administrator (`admin`) | Detail profil agensi dan daftar event yang diselenggarakan |
| `/admin/agency/[id]/edit` | `app/admin/agency/[id]/edit/page.jsx` | Administrator (`admin`) | Formulir pembaruan data kontak dan alamat agensi |
| `/admin/event` | `app/admin/event/page.jsx` | Administrator (`admin`) | Daftar manajemen event dengan filter status, kota, dan agensi |
| `/admin/event/create` | `app/admin/event/create/page.jsx` | Administrator (`admin`) | Pembuatan event baru (single/festival), tiket dasar, poster/banner |
| `/admin/event/[id]` | `app/admin/event/[id]/page.jsx` | Administrator (`admin`) | Detail lengkap event, kelola fase tiket, perubahan status publikasi |
| `/admin/event/[id]/edit` | `app/admin/event/[id]/edit/page.jsx` | Administrator (`admin`) | Formulir edit metadata event, tempat, tanggal pelaksanaan |
| `/admin/event/[id]/ticket-phase` | `app/admin/event/[id]/ticket-phase/page.jsx` | Administrator (`admin`) | Kelola fase diskon Early Bird / Presale per kategori tiket |
| `/admin/event/[id]/ticket-phase/create` | `app/admin/event/[id]/ticket-phase/create/page.jsx` | Administrator (`admin`) | Tambah fase diskon baru dengan validasi anti-overlap tanggal |
| `/admin/event/[id]/ticket-phase/[phaseId]/edit` | `app/admin/event/[id]/ticket-phase/[phaseId]/edit/page.jsx` | Administrator (`admin`) | Edit periode dan persentase potongan harga fase tiket |
| `/officer` | `app/officer/page.jsx` | Petugas Lapangan (`officer`) | Dashboard metrik check-in penonton dan riwayat aktivitas scan |
| `/officer/scan` | `app/officer/scan/page.jsx` | Petugas Lapangan (`officer`) | Entry point tunggal pemeriksaan: live scan kamera, upload gambar QR, input kode manual, & validasi awal |
| `/officer/validation` | `app/officer/validation/page.jsx` | Petugas Lapangan (`officer`) | Rincian tiket tervalidasi (`?code=...`) dan konfirmasi check-in; redirect otomatis ke `/officer/scan` bila tanpa `code` |
| `/officer/history` | `app/officer/history/page.jsx` | Petugas Lapangan (`officer`) | Audit log seluruh tiket yang berhasil atau ditolak di pintu masuk |
| `/officer/events` | `app/officer/events/page.jsx` | Petugas Lapangan (`officer`) | Informasi event yang ditugaskan kepada petugas |
| `/officer/profile` | `app/officer/profile/page.jsx` | Petugas Lapangan (`officer`) | Informasi akun petugas dan lokasi gate penugasan |

---

### 2.2 Komponen dan Hierarki Layout

1. **Root Layout (`app/layout.tsx`):**
   - Menginisialisasi HTML antarmuka global dengan font sans-serif modern.
   - Menerapkan script sinkronisasi tema sebelum hidrasi (`dangerouslySetInnerHTML`) untuk mencegah kedipan layar (*FOUC - Flash of Unstyled Content*).
   - Membungkus seluruh aplikasi ke dalam `ThemeProvider` dan `AuthProvider`.
2. **User Layout (`app/user/layout.jsx`):**
   - Menyediakan navigasi atas (`UserNavbar`), navigasi bawah khusus mobile (`UserBottomNav`), dan footer global (`UserFooter`).
   - Menerapkan proteksi sesi pengguna: mengarahkan ke `/login` jika sesi kedaluwarsa atau tidak valid.
3. **Admin Layout (`app/admin/layout.jsx`):**
   - Menyediakan navigasi sidebar terstruktur: Dashboard (`/admin`), Agencies (`/admin/agency`), dan Events (`/admin/event`).
   - Menerapkan pengecekan hak akses `isAdmin` (role `admin`). Pengguna non-admin dialihkan otomatis.
4. **Officer Layout (`app/officer/layout.jsx` & `app/components/officer/OfficerGuard.jsx`):**
   - Menyediakan sidebar vertikal (`OfficerSidebar`) dengan 4 menu: Dashboard (`/officer`), Event Tugas (`/officer/events`), Scan Tiket (`/officer/scan`), dan Riwayat Check-in (`/officer/history`), sambil tetap menandai Scan Tiket aktif saat petugas berada pada tahap konfirmasi `/officer/validation`.
   - Menerapkan pengecekan ketat role `officer`. Mengarahkan pengguna lain ke dashboard masing-masing.
5. **Landing Page Components (`app/components/landingPage/*`):**
   - Terdiri dari 14 komponen modular: `Navbar`, `Hero`, `TrendingEvents`, `Categories`, `FeaturedEvent`, `PromoCountdown`, `PromoSlider`, `TicketSection`, `ArtistSection`, `WhyChoose`, `Testimonial`, `FAQ`, `Newsletter`, dan `Footer`.

---

### 2.3 Arsitektur API Service, HTTP Client, dan Lapisan Normalisasi

Frontend mengimplementasikan modul client terpadu di `app/lib/api.js` dan `app/lib/http.js`:

1. **Abstraksi `fetchJSON` dengan Timeout (`app/lib/http.js`):**
   - Mengatur batas waktu timeout default sebesar 15 detik (`REQUEST_TIMEOUT_MS = 15000`) menggunakan `AbortController`.
   - Mengisolasi penanganan kesalahan jaringan, pembatalan request, dan parsing JSON response.
2. **Defensive Normalization (`app/lib/api.js:18-48`):**
   Backend Flask pada `app/modules/auth/routes.py` secara tidak sengaja memanggil fungsi `success_response("Pesan", data_obj)` dengan urutan argumen terbalik dibandingkan definisi standarnya di `app/utils/responses.py` (`data, message`). Hal ini menyebabkan backend mengembalikan payload:
   ```json
   { "success": true, "message": { "user": {...}, "access_token": "..." }, "data": "Login successful" }
   ```
   Frontend secara cerdas menangkal anomali ini melalui fungsi `normalizeResponse(raw)`:
   ```javascript
   if (raw.success === true && typeof raw.data === 'string' && raw.message !== null && typeof raw.message === 'object') {
     return { ...raw, data: raw.message, message: raw.data };
   }
   ```
3. **Penanganan Auto-Refresh Token Transparan (`app/lib/api.js:153-178`):**
   Ketika request endpoint yang diproteksi menerima status HTTP 401:
   - Client secara otomatis menahan antrean dan memanggil `POST /api/auth/refresh` menggunakan `refresh_token`.
   - Jika refresh berhasil, access token baru disimpan dan request yang gagal diulang kembali (*transparent retry*).
   - Jika refresh gagal, seluruh token dibersihkan dan event `ticketwave:session-cleared` dipancarkan ke seluruh tab browser.
4. **Format Error Terstruktur (`app/lib/api.js:50-87`):**
   Menangani berbagai format error backend, baik berupa string tunggal, object validasi Marshmallow (`errors: { field: [...] }`), maupun object dictionary pada endpoint checkout.

---

### 2.4 State Management dan Penyimpanan Klien

1. **Session & Token Storage (`AuthContext.jsx` & `api.js`):**
   - Mendukung mode keamanan ganda:
     - **Default (Tab Session):** Token disimpan pada `sessionStorage` agar aman dari eksploitasi multi-tab.
     - **Remember Me:** Token disimpan pada `localStorage` agar sesi tetap bertahan setelah browser ditutup.
2. **Penyimpanan Checkout Sementara (`sessionStorage`):**
   - Tiket yang dipilih pada halaman detail event disimpan sementara di `sessionStorage.getItem("ticketwave_checkout")` berisi `{ eventId, items: [...] }`.
   - Halaman `/user/checkout` memvalidasi dan mencocokkan ulang data tersebut secara real-time ke backend sebelum mengizinkan submit pesanan (`reconcileCheckout`).
3. **Penyimpanan Bookmark Pesanan (`app/lib/bookingStorage.js`):**
   - Menyimpan array kode booking di `localStorage.getItem("ticketwave_booking_codes")`.
   - Merupakan solusi sementara yang dibangun karena backend belum menyediakan endpoint `GET /api/bookings` untuk pengguna terotentikasi.

---

### 2.5 Mekanisme Autentikasi dan Proteksi Rute (Route Guards)

Mekanisme otentikasi diatur terpusat melalui `app/context/AuthContext.jsx`:
- **State Sesi:** Menyediakan nilai `user`, `loading`, `isAuthenticated`, `isAdmin` (`role === 'admin'`), `isOfficer` (`role === 'officer'`), dan `isUser` (`role === 'user'`).
- **Verifikasi Real-Time:** Setiap inisialisasi aplikasi memanggil `GET /api/auth/me` untuk memastikan token yang tersimpan di browser masih valid dan akun belum dinonaktifkan di basis data.
- **Sinkronisasi Antar-Tab:** Menggunakan listener `window.addEventListener('storage')` dan custom event `SESSION_CLEARED_EVENT` sehingga jika pengguna melakukan logout pada satu tab, tab lain otomatis keluar seketika.

---

### 2.6 Form dan Validasi Input

1. **Registrasi (`app/register/page.jsx`):**
   - Validasi panjang nama (2–120 karakter).
   - Validasi regex email standar RFC 5322.
   - Validasi nomor ponsel Indonesia (10–20 digit, format numerik).
   - Validasi kata sandi minimal 6 karakter.
2. **Checkout (`app/user/checkout/page.jsx`):**
   - Batasan kuantitas pemesanan tiket (1 hingga maksimal 10 tiket per transaksi).
   - Penolakan pemesanan multi-kategori tiket dalam satu transaksi (sesuai batasan schema `CheckoutSchema` backend).
   - Validasi data identitas pembeli tiket (Nama, Email, Nomor Telepon).
3. **Manajemen Event Admin (`app/admin/event/create/page.jsx` & `[id]/edit/page.jsx`):**
   - Validasi tipe event: `single` (wajib mengisi `artist_name`, `event_date`, `event_time`) atau `festival` (wajib mengisi `days_count` dan lineup per hari).
   - Validasi format tanggal dan jam pelaksanaan.
4. **Manajemen Fase Tiket Admin (`app/admin/event/[id]/ticket-phase/create/page.jsx`):**
   - Validasi rentang tanggal diskon (start_date <= end_date).
   - Validasi potongan harga diskon (1% hingga 100%).

---

### 2.7 Penanganan Loading, Error, dan Empty States

Frontend menerapkan standar antarmuka yang sangat konsisten:
- **Loading State:** Menggunakan skeleton loading beranimasi shimmer pada kartu event (`EventCard`), spinner berputar Lucide (`Loader2`), serta disable state pada tombol submit form untuk mencegah *double submission*.
- **Error State:** Menampilkan kotak peringatan berwarna merah/amber dengan ikon `AlertCircle`, pesan error ramah pengguna yang diterjemahkan dari kode HTTP, serta tombol coba lagi (*Retry / Muat Ulang*).
- **Empty State:** Menggunakan komponen `EmptyState.jsx` yang dilengkapi ilustrasi ikon tematik (misal `SearchX` atau `Ticket`), pesan informatif bahwa data belum tersedia, dan tombol aksi (*Call to Action*).

---

### 2.8 Responsivitas Tampilan Desktop dan Mobile

Aplikasi dirancang secara *Mobile-First*:
- **Viewport:** Diatur pada `app/layout.tsx` (`width=device-width, initialScale=1`).
- **Desktop:** Menampilkan navbar lengkap dengan menu navigasi horizontal, tata letak grid 3–4 kolom pada katalog event, dan sidebar vertikal tetap pada dashboard admin dan officer.
- **Mobile:**
  - Navigasi atas disederhanakan dengan tombol drawer menu.
  - Halaman pengguna dilengkapi navigasi bawah mengambang (`UserBottomNav`) untuk akses cepat ke Beranda, Eksplorasi, Pesanan, dan Profil.
  - Tata letak beralih menjadi 1 kolom yang fleksibel dengan elemen sentuh (*touch target*) minimal 44x44 piksel.
  - Kamera pemindai QR pada halaman officer secara default meminta kamera belakang (`facingMode: "environment"`).

---

### 2.9 Integrasi Media dan Gambar

- **Next.js Image Optimization:** Menggunakan komponen `Image` dari `next/image` pada banner dan logo agensi.
- **Fallback Image:** Modul `eventDisplay.js` dan halaman detail event menyediakan konstanta fallback image Unsplash jika `poster_url` atau `banner_url` dari backend bernilai `null` atau gagal dimuat (*onError handler*).
- **Keterbatasan Upload:** Formulir upload di admin memanggil endpoint `/api/events/<id>/poster`, `/api/events/<id>/banner`, dan `/api/agencies/<id>/logo`. Karena backend mengandalkan Cloudinary tanpa fallback disk lokal, frontend menangkap error 422 dan menampilkan pesan peringatan konfigurasi server.

---

### 2.10 Modul Portal: User, Admin, dan Officer

1. **User Portal:** Fokus pada kenyamanan transaksi konsumen, kemudahan mencari konser musik di kota terdekat, transparansi harga tiket sebelum dan sesudah diskon fase, serta akses langsung ke tiket digital.
2. **Admin Portal:** Berfungsi sebagai pusat operasional dan kurasi platform, mengelola kelayakan agensi promotor, mempublikasikan event ke status `on_sale`, mengatur jadwal promo tiket, serta memantau status server.
3. **Officer Portal:** Dirancang untuk kecepatan pemindaian di pintu masuk venue (*gate entrance*), dilengkapi feedback suara beep audio saat barcode terbaca, mekanisme pencegahan scan ganda (*debounce* 3.5 detik), dan opsi input kode tiket manual jika kamera pengunjung rusak.

---

## 3. INVENTARISASI PEMANGGILAN API

Berikut adalah tabel pemetaan seluruh **42 route Flask terdaftar** setelah finalisasi (`21 November 2026`) ke modul/halaman Next.js beserta status verifikasinya:

| No | Modul / Halaman | File Sumber Terkait | HTTP Method | Endpoint Backend | Keperluan / Parameter | Status Integrasi Aktual |
|---|---|---|---|---|---|---|
| 1 | Auth Login | `app/login/page.jsx` | POST | `/api/auth/login` | `{ email, password }` | **PASS** (Multi-role live) |
| 2 | Auth Register | `app/register/page.jsx` | POST | `/api/auth/register` | `{ name, email, phone, password }` | **PASS** (`409` conflict guard aktif; SMTP live `BLOCKED`) |
| 3 | Verifikasi Email | `app/user/profile/page.jsx` | GET | `/api/auth/verify-email/<token>` | Path: `token` | **PASS** |
| 4 | Sesi Akun Pengguna | `app/context/AuthContext.jsx` | GET | `/api/auth/me` | Bearer Token | **PASS** |
| 5 | Update Profil Pengguna | `app/user/profile/page.jsx` | PUT | `/api/auth/me` | `{ name, phone }` | **PASS** (Live browser update + unit test `409`) |
| 6 | Logout Server-Side | `app/context/AuthContext.jsx` | POST | `/api/auth/logout` | `{ refresh_token? }` | **PASS** (`revoked_tokens` DB blocklist + unit test `401`) |
| 7 | Refresh Token Internal | `app/lib/api.js` | POST | `/api/auth/refresh` | Bearer RefreshToken | **PASS** *(Internal interceptor; tanpa tombol UI)* |
| 8 | Request Reset Password | `app/login/page.jsx` | POST | `/api/auth/request-password-reset` | `{ email }` | **CODE IMPLEMENTED — LIVE SMTP BLOCKED** (`log_only` fallback `PASS`) |
| 9 | Eksekusi Reset Password | `app/login/page.jsx` | POST | `/api/auth/reset-password` | `{ token, new_password }` | **PASS** |
| 10 | Trending & Katalog Event | `TrendingEvents.jsx`, `user/home`, `user/event` | GET | `/api/public/events` | `?page=&per_page=&search=&city=&event_type=&date_from=&date_to=` | **PASS** (`price_from` akurat untuk fase diskon) |
| 11 | Dropdown Filter Kota | `app/user/event/page.jsx` | GET | `/api/public/events/cities` | None | **PASS** |
| 12 | Detail Event Single & Festival | `app/user/event/[id]/page.jsx`, `user/checkout` | GET | `/api/public/events/<id>` | Path: `id` | **PASS** (`final_price`, `discount_amount`, lineup festival) |
| 13 | Submit Checkout Normal / Diskon | `app/user/checkout/page.jsx` | POST | `/api/checkout` | `{ event_id, ticket_type_id, quantity, buyer_*, payment_method }` | **PASS (SANDBOX)** (`Decimal` `12.5%` & `gross_amount` Snap konsisten) |
| 14 | Riwayat Pesanan Lintas Perangkat | `app/user/pesanan/page.jsx`, `user/ticket/page.jsx` | GET | `/api/checkout/my-bookings` | Bearer Token (`user`/`admin`) | **PASS** (Teruji lintas origin `127.0.0.1:3000`) |
| 15 | Detail Pesanan & Tiket | `app/user/pesanan/[id]/page.jsx`, `bookingStorage.js` | GET | `/api/checkout/<booking_code>` | Owner JWT / `X-Guest-Token` / `X-Buyer-Email` | **PASS** (Zero PII leak saat unauthorized `401`/`403`) |
| 16 | Pembatalan Pesanan | `app/user/pesanan/[id]/page.jsx`, `pesanan/page.jsx` | POST | `/api/checkout/<booking_code>/cancel` | Owner JWT / `X-Guest-Token` | **PASS** |
| 17 | Sinkronisasi Status Pembayaran | `app/user/pesanan/[id]/page.jsx` | POST | `/api/checkout/<booking_code>/sync-payment-status` | Owner JWT / `X-Guest-Token` (Sandbox only) | **PASS (SANDBOX)** |
| 18 | Webhook Notifikasi Midtrans | Server-to-Server Callback | POST | `/api/checkout/payment/notification` | Signature SHA-512 Midtrans | **IMPLEMENTED — LIVE WEBHOOK BLOCKED** *(Operasional non-UI; unit test 100% pass)* |
| 19 | Cek Kesehatan Server | `app/admin/settings/page.jsx` | GET | `/health` | None | **PASS** *(Operasional monitoring)* |
| 20 | CRUD Agensi Admin | `app/admin/agency/**` | GET/POST/PUT/DELETE | `/api/agencies` & `/api/agencies/<id>` | CRUD Agensi (`6` route incl. `/logo`) | **PASS** (Live browser create + edit + `GET /api/agencies/<id>`) |
| 21 | Upload Logo Agensi | `app/admin/agency/create`, `[id]/edit` | POST | `/api/agencies/<id>/logo` | `FormData: { logo }` | **PASS** (Live upload Cloudinary + error `503` aman) |
| 22 | CRUD & Status Event Admin | `app/admin/page.jsx`, `app/admin/event/**` | GET/POST/PUT/DELETE/PATCH | `/api/events`, `/api/events/<id>`, `/status` | CRUD Event (`6` route + poster/banner = `8`) | **PASS** (`event_end_time` & status `on_sale`/`finished`) |
| 23 | Upload Poster & Banner Event | `app/admin/event/create`, `[id]/edit` | POST | `/api/events/<id>/poster` & `/banner` | `FormData: { poster | banner }` | **PASS** (Live upload poster Cloudinary + error `503` aman) |
| 24 | CRUD Fase Diskon Tiket | `app/admin/event/[id]/ticket-phase/**` | GET/POST/PUT/DELETE | `/api/ticket-types/<id>/phases` & `/api/phases/<id>` | CRUD Fase (`5` route, pecahan `step="0.01"`) | **PASS** (Live create & edit `12.5%`) |
| 25 | Statistik & Riwayat Officer | `app/lib/officerService.js`, `officer/page.jsx`, `history` | GET | `/api/scan/stats`, `/api/scan/history` | Bearer Token (`officer`/`admin`) | **PASS** (Live browser counter & log akurat) |
| 26 | Validasi & Check-In Gate Officer | `app/lib/officerService.js`, `officer/scan`, `validation` | POST | `/api/scan/validate`, `/api/scan/check-in` | `{ code }` | **PASS** (Upload QR PNG + Manual + unpaid `400` + `409` + `finished` `400`; kamera fisik `NOT TESTED`) |

---

## 4. ANALISIS FITUR FRONTEND

### 4.1 Kategori A: Berfungsi dan Terintegrasi Penuh
Fitur-fitur berikut telah berhasil diverifikasi bekerja secara stabil dan memiliki kompatibilitas 100% dengan backend:
1. **Autentikasi Akun & Manajemen Token:** Login pengguna, registrasi, pengambilan profil `/auth/me`, auto-refresh token saat kedaluwarsa, pemulihan kata sandi, dan pembersihan sesi saat logout.
2. **Katalog Publik & Eksplorasi Event:** Tampilan trending events di landing page, penjelajahan katalog dengan pagination, filter pencarian teks, filter kota dinamis (`/public/events/cities`), dan filter tipe event.
3. **Detail Event Konser Tunggal:** Informasi event, lokasi venue, tanggal, daftar tiket tersedia, dan stok tiket.
4. **Checkout Tiket Harga Normal:** Pemesanan tiket dengan harga reguler (tanpa diskon fase), reservasi stok tiket, dan penerbitan kode booking unik `TKTW-YYYYMMDD-XXXXXX`.
5. **Detail & Pembatalan Pesanan Individu:** Pengecekan detail pesanan via kode booking, rincian pembeli, tiket yang diterbitkan, dan tombol pembatalan pesanan sebelum bayar yang otomatis memulihkan kuota tiket di database.
6. **Portal Manajemen Admin (CRUD):** Dashboard ringkasan, pendaftaran dan edit agensi, pembuatan event single/festival, pengubahan status event (`draft -> published -> on_sale`), dan konfigurasi fase tiket Early Bird/Presale dengan validasi anti-overlap.
7. **Pemeriksaan Kesehatan Sistem:** Halaman pengaturan admin (`/admin/settings`) yang memverifikasi koneksi server backend via endpoint root `/health`.

---

### 4.2 Kategori B: Berfungsi Sebagian (Tergantung Kondisi Data)
1. **Riwayat Pesanan Pengguna (`/user/pesanan`) & Dompet Tiket (`/user/ticket`):**
   - *Bukti:* Menggunakan utilitas `bookingStorage.js` untuk membaca daftar kode booking dari `localStorage` peramban, lalu melakukan iterasi request paralel `GET /api/checkout/<booking_code>`.
   - *Penyebab:* Backend belum menyediakan endpoint `GET /api/bookings` untuk mengambil seluruh pesanan milik user yang sedang login.
   - *Keterbatasan:* Bekerja sempurna jika user membuka di peramban yang sama saat memesan tiket. Jika pengguna membuka dari perangkat lain, riwayat pesanan akan kosong.
2. **Tautan Pembayaran Midtrans Snap (`/user/pesanan/[id]`):**
   - *Bukti:* Frontend memvalidasi URL pembayaran melalui fungsi `getOfficialPaymentUrl(booking)` pada `app/lib/payment.js`.
   - *Penyebab:* Fungsi ini menolak URL jika token pembayaran sama persis dengan `booking_code` (`session === booking.booking_code`) untuk mencegah user dialihkan ke URL palsu.
   - *Keterbatasan:* Tombol bayar tidak dapat mengarahkan pengguna ke gateway pembayaran Midtrans sebenarnya karena backend belum memanggil Snap API Midtrans.
3. **Detail Event Konser Tunggal dengan Fase Diskon Aktif (`/user/event/[id]`):**
   - *Bukti:* Respons `GET /api/public/events/<id>` menyajikan properti `final_price: null` untuk kategori tiket yang berada dalam periode promo aktif.
   - *Penyebab:* Bug pemanggilan fungsi `calculate_final_price` di `app/modules/public/event_routes.py:149` yang menyuplai `base_price` bertipe float, bukan integer `ticket_type_id`.
   - *Keterbatasan:* Frontend harus menghitung potongan diskon secara mandiri atau harga akan tampil tanpa diskon jika fallback ke `base_price`.

---

### 4.3 Kategori C: Tidak Berfungsi (Terblokir Masalah Teknis)
1. **Halaman Detail Event Festival Musik (`/user/event/[id]`):**
   - *Bukti:* Request `GET /api/public/events/<id>` menghasilkan HTTP 500 Internal Server Error saat membuka event bertipe `festival`.
   - *Penyebab:* Bug pada baris 138 backend `app/modules/public/event_routes.py` yang memanggil atribut `FestivalArtist.day` padahal nama kolom di basis data adalah `day_number`.
2. **Checkout Tiket dengan Fase Diskon (`/user/checkout`):**
   - *Bukti:* Submit pesanan tiket yang memiliki diskon aktif menghasilkan HTTP 500.
   - *Penyebab:* Bug pada baris 90 backend `checkout_routes.py` yang salah memanggil signature fungsi `calculate_final_price`, menyebabkan konversi `int(None)` memicu `TypeError`.
3. **Upload Media Poster, Banner, dan Logo Agensi di Admin:**
   - *Bukti:* Upload file melalui formulir admin menghasilkan pesan error HTTP 422.
   - *Penyebab:* Variabel environment Cloudinary di backend belum terisi dan backend tidak memiliki fallback penyimpanan lokal.
4. **Pembersihan File Gambar Lama Cloudinary saat Update Poster/Banner:**
   - *Bukti:* Ketika admin mengunggah poster atau banner baru untuk menggantikan yang lama, file gambar lama tetap tertahan di Cloudinary.
   - *Penyebab:* Bug pada `app/modules/admin/event_routes.py:247, 277` yang memanggil `delete_image(event.poster_url)` menggunakan URL string lengkap bukannya `public_id`. Fungsi `destroy` gagal dan diabaikan secara diam-diam (`except: pass`).
5. **Pemrosesan Status Kartu Kredit Midtrans pada Webhook:**
   - *Bukti:* Transaksi kartu kredit dengan status `capture` dan status fraud `accept` tidak mengubah status booking menjadi `paid`.
   - *Penyebab:* Logika webhook di `app/modules/ticket/checkout_routes.py:248-256` hanya memproses `transaction_status == "settlement"`, sehingga transaksi kartu kredit sukses tetap tertahan dalam status `pending_payment` dan tiket tidak diterbitkan.
6. **Hardcoded Guest Checkout pada Pembuatan Pesanan (`user_id = None`):**
   - *Bukti:* Setiap kali checkout dibuat (`POST /api/checkout`), kolom `user_id` pada tabel `bookings` selalu diset `None`.
   - *Penyebab:* `app/modules/ticket/checkout_routes.py:103` masih berisi catatan `# TODO: set user_id if logged in (from JWT)`. Backend tidak mengekstrak ID user dari token JWT, memutus relasi kepemilikan transaksi dengan akun pengguna.

---

### 4.4 Kategori D: Belum Terintegrasi (Ketiadaan Endpoint Backend)
1. **Seluruh Officer Portal (`/officer/*`):**
   - *Bukti:* Pemanggilan `GET /api/scan/stats`, `GET /api/scan/history`, `POST /api/scan/validate`, dan `POST /api/scan/check-in` semuanya mengembalikan status **HTTP 404 Not Found**.
   - *Penyebab:* Blueprint `scan_bp` dikomentari pada `app/__init__.py:69` dan file implementasi `scan_routes.py` belum tersedia di repositori backend.
2. **Daftar Pesanan User Terpusat (`GET /api/bookings`):**
   - *Penyebab:* Endpoint belum dibuat di backend.
3. **Manajemen Pengguna untuk Admin (`GET /api/users`):**
   - *Penyebab:* Frontend belum memiliki halaman kelola pengguna karena endpoint backend untuk melihat atau memblokir pengguna belum tersedia.
4. **Endpoint Logout Resmi Server (`POST /api/auth/logout`):**
   - *Penyebab:* Endpoint tidak tersedia di `app/modules/auth/routes.py`, sehingga revokasi/blacklist token JWT di server tidak terjadi saat user melakukan logout.
5. **Layanan Pengiriman Email E-Tiket Otomatis:**
   - *Penyebab:* Baris 251 `app/modules/ticket/checkout_routes.py` masih bertanda `# TODO: Send e-ticket email ke buyer_email`. Modul SMTP/mailing service belum diimplementasikan di backend.
6. **Verifikasi Keamanan Signature Hash Midtrans:**
   - *Penyebab:* Baris 225 & 236 `app/modules/ticket/checkout_routes.py` bertanda `# TODO: Verify Midtrans signature`. Webhook menerima request secara terbuka tanpa validasi HMAC-SHA512 signature key (`order_id + status_code + gross_amount + ServerKey`).

---

### 4.5 Kategori E: Tidak Dapat Diverifikasi
- **Modul Kasir (`/api/kasir`):** Tidak terdapat rute frontend maupun blueprint backend aktif yang mengimplementasikan modul kasir pada branch ini.

---

## 5. KESESUAIAN DENGAN BACKEND (CROSS-AUDIT MD.BE.MD)

Berdasarkan perbandingan dengan dokumen audit backend [MD.BE.md](file:///c:/Users/LOQ/Documents/TicketWave/MD.BE.md), berikut analisis mendalam kesesuaian sistem:

### 5.1 Dampak Ketiadaan Endpoint Backend
- **Officer Scanner:** Frontend telah mengimplementasikan komponen canggih (`Html5Qrcode`, audio beeper synthesizer, haptic vibration, filter gate), namun tidak ada satu pun endpoint `/api/scan/*` yang hidup di backend. Dampaknya, fitur pemindaian tiket di lapangan terhenti total.
- **User Orders List:** Ketiadaan endpoint agregasi pesanan user (`GET /api/bookings`) memaksa frontend mengorbankan portabilitas akun antar-perangkat.
- **Logout Server-Side:** Ketiadaan endpoint `POST /api/auth/logout` membuat sesi pengguna hanya terhapus di peramban tanpa pembatalan/blacklist token JWT di server.
- **Update Profil Pengguna:** Ketiadaan endpoint `PUT /api/auth/me` menyebabkan form edit profil pengguna tidak dapat memutakhirkan data akun di basis data.

### 5.2 Dampak Bug Fatal Logika Backend
- **Festival Multi-Day:** Frontend telah siap menampilkan lineup artis multi-hari dan jadwal panggung, namun crash backend di `FestivalArtist.day` (`app/modules/public/event_routes.py:138`) menghalangi render halaman event festival secara keseluruhan (HTTP 500).
- **Checkout Diskon:** Logika antarmuka checkout frontend telah mampu menghitung potongan diskon Early Bird dan Presale, namun transaksi digagalkan oleh `TypeError` di controller backend (`app/modules/ticket/checkout_routes.py:90`) akibat pemanggilan `int(calculate_final_price(float(...), ...))` yang salah argumen (HTTP 500).
- **Kalkulasi Harga Diskon Detail Event Publik:** Pemanggilan `calculate_final_price(float(tt.base_price), active_phase.discount_percent)` pada `app/modules/public/event_routes.py:149` juga salah argumen, menyebabkan `final_price` bernilai `null` dalam payload JSON respons `GET /api/public/events/<id>`. Frontend harus menghitung ulang potongan diskon secara defensif.
- **Pembersihan File Gambar Cloudinary:** Fungsi `delete_image` pada `app/modules/admin/event_routes.py:247, 277` menerima string URL gambar lengkap (`event.poster_url` / `event.banner_url`) bukan `public_id`, sehingga Cloudinary SDK gagal menghapus file lama dan aset sampah menumpuk.

### 5.3 Perbedaan Kontrak Request dan Format Response JSON
- **Argumen Terbalik di Auth Routes:** Frontend berhasil mengatasi inkonsistensi response backend melalui adapter `normalizeResponse` pada `api.js`. Tanpa adapter ini, frontend akan mengalami kegagalan parsing login dan refresh token akibat pembalikan posisi pesan string dan object payload pada `success_response` di `app/modules/auth/routes.py`.
- **Error Object vs String:** Endpoint checkout backend mengirimkan error dalam bentuk dictionary `errors` langsung ke posisi `message`, yang juga telah berhasil ditangani oleh formatter error frontend di `app/lib/api.js:53`.

### 5.4 Autentikasi dan Keselarasan Role Authorization
- **Status Code Role Decorator:** Pada implementasi aktual `app/utils/decorators.py:47-50`, decorator `@role_required` mengembalikan status `HTTP 403 Forbidden` jika role tidak sesuai, sedangkan ketiadaan token atau user tidak ditemukan menghasilkan `HTTP 401/404`. Dokumentasi lama backend (`AUTH_API_DOCS.md`) sempat menyebutkan status HTTP 400. Frontend menangani perbedaan ini secara adaptif.
- **Ketiadaan Token Revocation (Blacklist):** Karena tidak ada endpoint `POST /api/auth/logout`, token JWT yang masih dalam masa aktif (15 menit untuk access token, 7 hari untuk refresh token) tetap dapat digunakan jika disadap, karena backend belum mengimplementasikan blacklist token di Redis maupun database.

### 5.5 Arsitektur Riwayat Pesanan dan Tiket
- **Hardcoded Guest Checkout (`user_id = None`):** Pada `app/modules/ticket/checkout_routes.py:103`, pembuatan booking menetapkan `user_id = None` dengan catatan `# TODO: set user_id if logged in (from JWT)`. Akibatnya, seluruh transaksi yang dibuat oleh pengguna login tetap berstatus transaksi tamu anonim. Hal ini menjadi blocker struktural: ketika backend nantinya mengimplementasikan `GET /api/bookings`, transaksi lama yang dibuat pengguna tidak akan bisa ditautkan ke akun mereka secara retroaktif kecuali ditelusuri manual lewat email.

### 5.6 Alur Checkout, Pembayaran Midtrans Snap, dan Webhook
- **URL Pembayaran Fiktif:** Frontend menolak URL statis `https://app.midtrans.com/snap/v2/vtweb/{booking_code}` melalui validasi `payment.js`. Langkah ini tepat karena mengarahkan user ke URL fiktif tersebut hanya akan menghasilkan error 404 dari server Midtrans.
- **Celah Keamanan Webhook Tanpa Signature Verification:** Endpoint `POST /api/checkout/payment/notification` (`checkout_routes.py:236`) menerima request webhook dari pihak mana pun tanpa verifikasi SHA512 signature key (`order_id + status_code + gross_amount + ServerKey`), membuka kerentanan spoofing pembayaran.
- **Pengabaian Status Kartu Kredit (`capture`):** Webhook backend di `checkout_routes.py:248-256` hanya memproses `transaction_status == "settlement"`. Padahal transaksi kartu kredit Midtrans berstatus `capture` dengan `fraud_status: "accept"`. Transaksi kartu kredit sukses akan tetap tertahan di status `pending_payment` dan kuota tiket berisiko kedaluwarsa keliru.
- **Ketiadaan Pengiriman Email E-Tiket:** Setelah pembayaran berhasil di-settle oleh Midtrans, backend tidak mengirimkan email notifikasi e-tiket karena integrasi SMTP/mailer belum diimplementasikan (`checkout_routes.py:251`).

### 5.7 Unggah Media dan Keterbatasan Cloudinary
- Frontend mengirimkan file `multipart/form-data` dengan field yang benar (`poster`, `banner`, `logo`), namun backend secara mutlak mensyaratkan `CLOUDINARY_API_KEY` aktif tanpa fallback penyimpanan lokal.
- Terjadi kesalahan pemanggilan `delete_image` di `app/modules/admin/event_routes.py:247, 277` yang menyuplai URL publik alih-alih `public_id`, menyebabkan gambar lama tidak pernah terhapus dari cloud storage.

### 5.8 Pemisahan Tanggung Jawab: Masalah Frontend vs Masalah Backend

| No | Gejala Masalah / Fitur Terkendala | Lokasi Kode Sumber Backend | Dampak pada Frontend | Kategori Temuan | Tanggung Jawab |
|---|---|---|---|---|---|
| 1 | Halaman `/officer/*` menampilkan error HTTP 404 | `app/__init__.py:69` | Seluruh portal officer tidak dapat digunakan | Endpoint Belum Tersedia | **Backend** |
| 2 | Halaman `/user/event/[id]` festival musik crash 500 | `app/modules/public/event_routes.py:138` | Pengguna tidak bisa melihat detail dan lineup festival | Bug Fatal Terkonfirmasi | **Backend** |
| 3 | Checkout tiket promo Early Bird/Presale gagal 500 | `app/modules/ticket/checkout_routes.py:90` | Calon pembeli gagal memesan tiket fase diskon | Bug Fatal Terkonfirmasi | **Backend** |
| 4 | Upload poster, banner, dan logo agensi gagal 422 | `app/utils/upload_service.py:45`, `.env` | Admin tidak bisa melampirkan media visual event | Konfigurasi Belum Lengkap | **Backend / DevOps** |
| 5 | Riwayat pesanan hilang saat berganti browser | `app/modules/ticket/checkout_routes.py` | Daftar pesanan user tidak portabel antar-perangkat | Endpoint Belum Tersedia | **Backend** |
| 6 | Tombol pembayaran tidak membuka gateway resmi | `app/modules/ticket/checkout_routes.py:137` | Pengguna tidak dapat membayar tiket secara online | Konfigurasi & Integrasi | **Backend** |
| 7 | Anomali struktur JSON login/register | `app/modules/auth/routes.py:89, 136, 157` | Berisiko memicu crash parsing token sesi | Bug Terkonfirmasi (Mitigasi FE Aktif) | **Backend** |
| 8 | Form profil user tidak bisa menyimpan data | `app/modules/auth/routes.py` | Pengguna tidak bisa update nama & nomor telepon | Endpoint Belum Tersedia | **Backend** |
| 9 | Admin tidak memiliki menu kelola user | `app/modules/user` | Admin tidak bisa memonitor atau memblokir akun | Endpoint Belum Tersedia | **Backend** |
| 10 | Modul kasir venue belum dapat diakses | `app/__init__.py:68` | Fitur loket tiket offline belum tersedia | Blueprint Belum Aktif | **Backend** |
| 11 | Harga diskon bernilai null pada detail event | `app/modules/public/event_routes.py:149` | Informasi harga promo tampil tidak lengkap/null | Bug Terkonfirmasi | **Backend** |
| 12 | Riwayat pesanan tidak tertaut ke akun user | `app/modules/ticket/checkout_routes.py:103` | Transaksi masa lalu tidak muncul di profil akun | Bug Logika Terkonfirmasi | **Backend** |
| 13 | Webhook pembayaran rentan manipulasi data | `app/modules/ticket/checkout_routes.py:236` | Risiko status pesanan diubah oleh pihak ketiga | Celah Keamanan Terkonfirmasi | **Backend** |
| 14 | Pembayaran kartu kredit macet di pending | `app/modules/ticket/checkout_routes.py:248` | Pengguna bayar via kartu kredit tidak dapat tiket | Bug Alur Bisnis Terkonfirmasi | **Backend** |
| 15 | Pembeli tidak menerima email bukti e-tiket | `app/modules/ticket/checkout_routes.py:251` | Pengguna hanya mengandalkan tangkapan layar web | Fitur Belum Selesai | **Backend** |
| 16 | File poster lama menumpuk di Cloudinary | `app/modules/admin/event_routes.py:247, 277`| Pemborosan kapasitas penyimpanan cloud promotor | Bug Logika Terkonfirmasi | **Backend** |
| 17 | Token sesi tidak dapat dimatikan dari server | `app/modules/auth/routes.py` | Token JWT tetap aktif sampai masa expire alami | Endpoint Belum Tersedia | **Backend** |

---

### 5.9 Potensi Masalah Performa: Ketiadaan Database Composite Indexing
- **Lokasi Model:** `app/models/event.py`
- **Kondisi Aktual:** Endpoint katalog publik `GET /api/public/events` (`app/modules/public/event_routes.py`) mendukung pemfilteran multi-kriteria berbasis pencarian nama, kota penyelenggaraan (`city`), status publikasi (`status`), serta rentang tanggal pelaksanaan (`event_date`).
- **Potensi Masalah:** Kolom `city` dan `event_date` pada tabel `events` belum memiliki indeks komposit (*composite index*). Pada saat basis data bertumbuh hingga ribuan konser, operasi pencarian katalog publik di Frontend akan mengalami *full table scan*, mengakibatkan penurunan drastis performa waktu respons (TTFB) dan pengalaman pengguna yang lambat.

---

### 5.10 Mekanisme Kedaluwarsa Pesanan Pasif (Stale Quota Locking)
- **Lokasi Kode:** `app/modules/ticket/checkout_routes.py:166-175`
- **Kondisi Aktual:** Pemeriksaan apakah sebuah booking telah kedaluwarsa (`is_expired()`) dan pengembalian stok tiket ke kuota (`ticket_type.sold_count -= booking.quantity`) hanya dieksekusi secara pasif di dalam endpoint `GET /api/checkout/<booking_code>`.
- **Dampak Bisnis:** Jika seorang calon pembeli memesan tiket lalu menutup browser dan tidak pernah membuka tautan booking itu lagi, maka kuota tiket yang direservasi akan terkunci selamanya (*stale quota locking*) dan tidak dapat dibeli oleh pengunjung lain, karena backend tidak memiliki worker terjadwal (*cron job / Celery worker*) untuk mengeksekusi pembatalan otomatis secara berkala.

---

## 6. DAFTAR MASALAH FRONTEND

Meskipun sebagian besar blocker berasal dari backend, terdapat beberapa aspek arsitektur Frontend yang memerlukan perbaikan dan penyempurnaan:

### Masalah 1: Ketergantungan Riwayat Pesanan pada LocalStorage (`RESOLVED — PASS`)
- **Tanggal Resolusi:** `21 November 2026`
- **Fitur Terkait:** Riwayat Pesanan (`/user/pesanan`) & Dompet Tiket (`/user/ticket`)
- **File Terkait:** `app/lib/bookingStorage.js`, `app/user/pesanan/page.jsx`, `app/user/ticket/page.jsx`
- **Perbaikan:** Pengguna login kini otomatis memanggil `GET /api/checkout/my-bookings` untuk sinkronisasi riwayat lintas perangkat, sedangkan jalur Guest tetap aman via `X-Guest-Token` HMAC dan verifikasi `X-Buyer-Email`. Teruji live pada origin berbeda (`http://127.0.0.1:3000`).

### Masalah 2: Belum Terintegrasinya SDK Snap JS Midtrans (`ARCHIVED — SAMA-TAB REDIRECT PASS`)
- **Fitur Terkait:** Pembayaran Tiket Online
- **File Terkait:** `app/user/pesanan/[id]/page.jsx`, `app/lib/payment.js`, `app/components/payment/PaymentReturnHandler.jsx`
- **Catatan Arsitektur:** Alur pembayaran memakai tautan resmi Midtrans Snap v4 (`payment_url`) di tab yang sama dengan callback return `/payment/finish`, `/payment/unfinish`, dan `/payment/error`, serta telah teruji end-to-end dengan Permata VA Sandbox.

### Masalah 3: Pembaruan Profil Pengguna (`RESOLVED — PASS`)
- **Tanggal Resolusi:** `21 November 2026`
- **Fitur Terkait:** Pengaturan & Profil Pengguna (`/user/profile`)
- **File Terkait:** `app/user/profile/page.jsx`, `app/components/user/EditProfileForm.jsx`
- **Perbaikan:** Formulir edit `name` dan `phone` kini terhubung ke `PUT /api/auth/me` dan teruji live browser hingga persistensi ulang halaman.

### Masalah 4: QR Tiket Tidak Tampil di Detail Pesanan / Pesanan Saya & Pengerasan Tampilan QR (`RESOLVED`)
- **Tanggal Resolusi & Verifikasi:** `20 November 2026`
- **Fitur Terkait:** E-Ticket QR Display & Officer QR Validation (`/user/pesanan`, `/user/pesanan/[id]`, `/user/ticket`, `/officer/scan`, `/officer/validation`)
- **File Terkait:**
  - `app/components/user/TicketQr.jsx`
  - `app/components/user/TicketQrModal.jsx` (komponen modal bersama baru)
  - `app/user/pesanan/[id]/page.jsx`
  - `app/user/pesanan/page.jsx`
  - `app/user/ticket/page.jsx`
  - `app/officer/scan/page.jsx`, `app/officer/validation/page.jsx`, `app/lib/officerService.js`
- **Akar Masalah Sebelumnya:**
  1. Halaman detail pesanan (`app/user/pesanan/[id]/page.jsx`) hanya menampilkan ikon statis `<QrCode />` dari `lucide-react` pada bagian `Daftar E-Ticket`, tanpa merender `<TicketQr>` dan tanpa tombol/modal `"Tampilkan QR"`.
  2. Halaman daftar pesanan (`app/user/pesanan/page.jsx`) tidak memiliki tombol cepat `"Tampilkan QR"` pada booking berstatus `paid`.
  3. Halaman `app/user/ticket/page.jsx` hanya merender ikon `<QrCode />` pada header kartu, memblokir pembukaan modal detail bagi tiket berstatus `used`, serta belum menampilkan `ticket_code` di bawah gambar QR pada container putih murni (`#FFFFFF` di atas `#000000` terlepas dari tema gelap).
  4. Halaman `/officer/scan` sebelumnya menampilkan `rawCode` secara utuh sehingga berisiko memunculkan `qr_token` lengkap di UI saat QR berbasis token dipindai, serta belum menyediakan pemindaian optik gambar QR (`Html5Qrcode.scanFile`).
  5. Timestamp `checked_in_at` dari `GET /api/checkout/<booking_code>` dikembalikan Backend sebagai ISO UTC tanpa akhiran `"Z"`, sehingga `new Date(...)` perlu dinormalisasi sebagai UTC agar tampil akurat dalam waktu lokal (WIB).
- **Perbaikan & Hasil Verifikasi:**
  - `TicketQr` kini merender PNG QR hitam-di-atas-putih (`#000000`/`#FFFFFF`, `margin: 4`, quiet-zone putih) dari payload resmi Backend `qr_token` dengan label `ticket_code` di bawah QR tanpa pernah menampilkan `qr_token` lengkap ke UI atau konsol.
  - Modal terstandar (`TicketQrModal`) dan detail pesanan menampilkan QR aktif hanya untuk booking `paid` dengan tiket `valid`, menyembunyikan QR aktif pada `pending_payment`/`cancelled`/`expired`, serta menampilkan status `"Sudah Digunakan"` dan waktu check-in lokal WIB untuk tiket `used`.
  - Modul Officer (`/officer/scan`, `/officer/validation`) kini menyamarkan `rawCode` non-kode-tiket, meneruskan `ticket_code` pada tautan validasi, serta mendukung dekode optik gambar QR melalui `Html5Qrcode.scanFile`. Teruji live end-to-end dengan Midtrans Sandbox VA (`TKTW-20261120-ABDBB5` / `TKT-D8FB3D98`), check-in pertama berhasil, scan kedua ditolak `SUDAH DIGUNAKAN`, `0` console error, serta lulus `npm run lint`, `npx tsc --noEmit`, dan `npm run build`.

### Masalah 5 — Return Midtrans Membocorkan Sesi Role dan Salah Redirect
- **Tanggal Resolusi & Verifikasi:** `20 November 2026`
- **Fitur Terkait:** Alur Checkout -> Midtrans Snap Redirect -> Return Callback & Isolasi Sesi Role (`user`, `officer`, `admin`)
- **Gejala:**
  Saat pengguna (`user`) melakukan checkout menggunakan QRIS/GoPay di Midtrans Sandbox lalu menekan Back atau menutup halaman pembayaran tanpa membayar:
  1. Pengguna tidak kembali ke detail pesanan `/user/pesanan/<booking_code>`.
  2. Pengguna masuk ke halaman login/otorisasi, lalu diarahkan ke dashboard Officer (`/officer` / `/officer/scan`).
  3. Sesi role pengguna seolah tertukar dengan sesi Officer dari pengujian sebelumnya di peramban yang sama.
- **Akar Masalah:**
  1. **Kebocoran Token Stale `localStorage` Antar-Role (`app/lib/api.js`, `app/context/AuthContext.jsx`):** Sebelumnya `setAccessToken`/`setRefreshToken`/`setStoredUser(..., false)` menulis ke `sessionStorage` tanpa menghapus kunci lama di `localStorage`, dan `login()` tidak membersihkan sesi role sebelumnya dari kedua storage. Jika Officer pernah login dengan `Remember me` (`localStorage`) lalu User login tanpa `Remember me` (`sessionStorage`), tab baru atau return tab dengan `sessionStorage` kosong jatuh ke fallback `sessionStorage || localStorage` milik Officer -> `/auth/me` mengembalikan role `officer` -> `UserLayout` mengarahkan ke `/officer`.
  2. **`target="_blank" rel="noopener noreferrer"` pada `"Lanjutkan Pembayaran"` (`app/user/pesanan/[id]/page.jsx`):** Membuka Midtrans pada tab baru yang terisolasi atau saat `sessionStorage` kosong membuat halaman kembali kehilangan konteks `sessionStorage` tab asal dan jatuh ke `/login` atau token Officer yang tertinggal di `localStorage`.
  3. **Ketiadaan `callbacks` Midtrans Snap & Binding `user_id` di Backend (`TicketWave-BE/app/modules/ticket/checkout_routes.py`, `app/config/config.py`):** Payload Snap tidak mengirimkan `callbacks.finish`/`error`/`pending`, sehingga Snap kembali ke root tanpa `booking_code`, sementara `create_checkout()` selalu menetapkan `user_id = None`.
  4. **Ketiadaan Route Callback `/payment/finish` & Konteks Checkout Aman (`app/payment/finish/page.jsx`, `app/lib/paymentContext.js`):** Tidak ada route perantara untuk membaca `booking_code`, memvalidasi sesi & kepemilikan booking tanpa mempercayai parameter status URL, dan mengarahkan ke `/user/pesanan/<booking_code>?payment_return=1` atau `/login?next=...`.
  5. **Parameter `?next=` Tidak Didukung `/login` & Redirect `UserLayout` pada `/user/pesanan/[id]`:** `app/login/page.jsx` hanya membaca `?redirect=` (mengabaikan `?next=`), dan `UserLayout` (`app/user/layout.jsx`) langsung menjalankan `router.replace("/officer")` pada rute `/user/pesanan/[id]` alih-alih menampilkan pesan role tidak sesuai. Selain itu `checkout/page.jsx` sempat menghapus `ticketwave_checkout` sebelum redirect tanpa konteks pemulihan saat pengguna menekan Back ke `/user/checkout`.
- **File Terkait:**
  - Backend: `TicketWave-BE/app/config/config.py` (`FRONTEND_URL`), `TicketWave-BE/app/modules/ticket/checkout_routes.py` (`_get_frontend_base_url`, `callbacks.finish/error/pending`, optional JWT `booking.user_id`), `TicketWave-BE/tests/test_checkout_midtrans.py`
  - Frontend: `app/lib/api.js`, `app/context/AuthContext.jsx`, `app/lib/authRedirect.js` *(baru)*, `app/lib/paymentContext.js` *(baru)*, `app/components/payment/PaymentReturnHandler.jsx` *(baru)*, `app/payment/finish/page.jsx` *(baru)*, `app/payment/unfinish/page.jsx` *(baru)*, `app/payment/error/page.jsx` *(baru)*, `app/components/landingPage/Navbar.jsx`, `app/user/checkout/page.jsx`, `app/user/pesanan/[id]/page.jsx`, `app/user/layout.jsx`, `app/user/profile/page.jsx`, `app/user/settings/page.jsx`, `app/login/page.jsx`, `app/components/officer/OfficerGuard.jsx`, `app/admin/layout.jsx`, `app/lib/sessionIsolation.test.mjs` *(baru)*
- **Perbaikan:**
  - Backend membentuk `callbacks.finish`, `callbacks.error`, dan `callbacks.pending` menggunakan `FRONTEND_URL` (`<FRONTEND_URL>/payment/finish?booking_code=<booking_code>`) serta mengikat `booking.user_id` ke JWT `user` bila login (tetap mendukung guest checkout).
  - Frontend menambahkan `api.setSession()`, mutual-exclusion antara `sessionStorage` dan `localStorage`, proteksi sinkronisasi antar-tab `subscribeSessionCleared` (tab dengan sesi `sessionStorage` kebal terhadap penulisan `localStorage` dari tab lain, sedangkan tab berbasis `localStorage` mendeteksi perubahan akun eksternal), serta pembersihan menyeluruh kedua storage saat `login()` maupun `clearTokens()`/`logout()`.
  - Menambahkan `paymentContext.js` (hanya menyimpan konteks nonrahasia: `booking_code`, `return_path`, `timestamp`, `owner_user_id`, `owner_email` dengan TTL 2 jam — tanpa JWT, server key, Snap token, `qr_token`, maupun password), komponen bersama `PaymentReturnHandler.jsx` untuk rute `/payment/finish`, `/payment/unfinish`, dan `/payment/error` (ditambah fallback interceptor di `Navbar.jsx` untuk `/?order_id=TKTW-...`) yang memverifikasi autentikasi + kepemilikan via Backend `GET /api/checkout/<code>`, serta `UserLayout` yang menampilkan kartu `"Sesi Role Tidak Sesuai"` jika Officer membuka `/payment/*` atau `/user/pesanan/[id]`.
  - Memperbarui `/user/checkout` (termasuk listener BFCache `pageshow`) agar memulihkan ke `/user/pesanan/<code>?payment_return=1` bila `ticketwave_checkout` kosong setelah kembali ke halaman checkout, memperbarui `/user/pesanan/[id]` (beserta listener `pageshow` BFCache untuk refresh read-only status & banner) agar `"Lanjutkan Pembayaran"` berjalan pada tab yang sama memakai `payment_url` booking yang sama, mengekstrak `resolvePostLoginRedirect()` pada `authRedirect.js` dengan validasi `?next=` ketat per-role pada `/login` dan `?next=` pada `profile`/`settings`/`OfficerGuard`/`admin`, serta menjaga status pembayaran murni dari Backend (bukan query string).
- **Bukti Pengujian (20 November 2026):**
  - **Pra-cek Isolasi Pergantian Akun:** Login Officer (`Remember me` aktif) lalu langsung login User (`Remember me` nonaktif) berhasil membersihkan token Officer dari `localStorage` sehingga tab kedua ke `/officer` diarahkan ke `/login?next=%2Fofficer`, sementara tab User tetap aktif sebagai `Regular User`.
  - **Skenario Live Browser (`http://localhost:3000` + Midtrans Sandbox & Simulator):**
    - **QRIS tanpa pembayaran (`TKTW-20261120-4A99B2` & `TKTW-20261120-193E11`):** Kembali via `/payment/finish?booking_code=...` mendarat di `/user/pesanan/<code>?payment_return=1`, status tetap `Menunggu Pembayaran` (`pending_payment`), tombol `"Lanjutkan Pembayaran"` dan `"Periksa Status Pembayaran"` tersedia, role tetap `user`, serta akses kembali ke `/user/checkout` otomatis memulihkan ke detail pesanan. Pada pengujian `TKTW-20261120-193E11`, menekan ikon Close (`×`) di header Midtrans Snap memicu redirect asli Midtrans menuju `http://localhost:3000/payment/finish?booking_code=TKTW-20261120-193E11&order_id=TKTW-20261120-193E11&status_code=201&transaction_status=pending&action=back` (ditahan guard SSRF `webview_browser`).
    - **Callback `/payment/unfinish` & `/payment/error`:** Unauthenticated pada `/payment/unfinish?booking_code=TKTW-20261120-84BA9B` diarahkan ke `/login?next=%2Fuser%2Fpesanan%2FTKTW-20261120-84BA9B%3Fpayment_return%3D1` lalu kembali ke detail booking usai login User; User terautentikasi pada `/payment/error?...` langsung kembali ke `/user/pesanan/...`; Officer pada kedua route tersebut menampilkan kartu `"Sesi Role Tidak Sesuai"` tanpa redirect ke `/officer/scan`.
    - **GoPay tanpa pembayaran (`TKTW-20261120-924FCF`):** Hasil identik; klik `"Lanjutkan Pembayaran"` memakai URL Snap yang sama (`.../redirection/••••3fc`) tanpa membuat booking duplikat (`total = 115`, tidak bertambah saat resume).
    - **Virtual Account Permata tanpa pembayaran (`TKTW-20261120-84BA9B`, VA `3240••••4973`):** Hasil identik, `pending_payment`, tanpa booking duplikat saat `"Lanjutkan Pembayaran"` ditekan ulang.
    - **Token User Hilang/Kedaluwarsa:** Logout User lalu membuka `/payment/finish?booking_code=TKTW-20261120-84BA9B` diarahkan ke `/login?next=%2Fuser%2Fpesanan%2FTKTW-20261120-84BA9B%3Fpayment_return%3D1`; setelah login User kembali langsung ke `/user/pesanan/TKTW-20261120-84BA9B?payment_return=1` (bukan `/officer`).
    - **Pembayaran Berhasil (`TKTW-20261120-84BA9B` / tiket `TKT-6C30E911`):** Dibayar via Simulator VA Permata Sandbox -> klik `"Periksa Status Pembayaran"` -> status menjadi `Dibayar` (`paid`), banner `"Pembayaran Berhasil"`, QR `[data-testid="ticket-qr-image"]` & modal tampil aktif, role tetap `user`.
    - **Isolasi Role (`user`, `officer`, `admin`):** Officer membuka `/payment/*` maupun `/user/pesanan/...` menampilkan kartu `"Sesi Role Tidak Sesuai"` tanpa redirect ke `/officer/scan` dan tanpa membocorkan detail pesanan; User dan Admin diblokir dari `/officer` (`403 Otorisasi Petugas Diperlukan`); setelah switch ke User non-`Remember me`, tab baru ke `/officer` & `/admin` langsung diarahkan ke `/login?next=...`.
    - **Keterbatasan Lingkungan Otomasi Browser (`webview_browser`):** Pada lingkungan otomasi `webview_browser`, (1) navigasi balik otomatis/langsung dari origin eksternal (`https://app.sandbox.midtrans.com`) ke `http://localhost:3000` ditolak guard SSRF peramban uji (`NAVIGATION_BLOCKED`) dan `page.goBack()` pada hash-route Snap mengembalikan `null`, sehingga alur callback return diuji via navigasi langsung ke `/payment/finish?...`, `/payment/unfinish?...`, dan `/payment/error?...` pada origin `localhost`; serta (2) `browser().newContext()` tidak tersedia pada `webview_browser` sehingga isolasi tiga role diuji secara berurutan pada profil peramban tunggal beserta uji silang multi-tab pembersihan `localStorage`.
  - **Regression & Unit Checks:** Unit test Backend `20/20 OK` (exit `0`, mencakup `test_snap_payload_includes_payment_finish_callbacks` dan `test_checkout_sets_user_id_when_authenticated_and_allows_guest`), unit test isolasi Frontend `node --test app/lib/sessionIsolation.test.mjs` `5/5 OK` (exit `0`), serta `npm run lint`, `npx tsc --noEmit`, dan `npm run build` semuanya lulus dengan exit code `0`.
- **Status Akhir:** `IMPLEMENTATION COMPLETE — EXTERNAL RETURN PARTIALLY VERIFIED` *(Seluruh perbaikan kode Frontend/Backend, `/payment/finish`, isolasi token & role guard, Skenario A–F, serta build/test checks lulus; pengembalian langsung/Back lintas-origin dari domain eksternal Midtrans ke `localhost` dan eksekusi 3 browser context terpisah secara simultan terbatas oleh guard SSRF serta profil tunggal `webview_browser`)*

### Pembaruan Alur Officer — Penggabungan Scan & Validasi Tiket (`COMPLETED`)
- **Tanggal Pembaruan:** `20 November 2026`
- **Ringkasan Arsitektur:** Alur Officer disederhanakan: Scan Tiket menjadi entry point tunggal, sedangkan route Validation dipertahankan sebagai tahap rincian dan konfirmasi check-in.
- **File Terkait:**
  - `app/components/officer/OfficerSidebar.jsx`
  - `app/officer/scan/page.jsx`
  - `app/officer/validation/page.jsx`
- **Perubahan Utama:**
  1. Sidebar Officer (`OfficerSidebar.jsx`) disederhanakan menjadi 4 item berurutan: `Dashboard`, `Event Tugas`, `Scan Tiket`, dan `Riwayat Check-in`, dengan penandaan menu `Scan Tiket` tetap aktif ketika petugas melanjutkan ke `/officer/validation?code=<ticket_code>`.
  2. Halaman `/officer/scan` (`"Scan & Validasi Tiket"`) menjadi entry point tunggal bagi pemindaian kamera langsung, upload `"Pindai Gambar QR"`, dan 1 formulir alternatif `"Input Kode Manual"`; ketiganya memvalidasi kode ke `POST /api/scan/validate`, menampilkan panel `"Hasil Scan & Validasi Terbaru"`, serta tombol `"Lanjutkan Konfirmasi Check-in"` menuju `/officer/validation?code=<ticket_code>` hanya jika tiket berstatus `VALID`, ditambah panel `"Informasi Teknis Kamera"` berstatus collapsible.
  3. Halaman `/officer/validation` dipertahankan khusus untuk menampilkan rincian Event, Kategori, Pemilik, Status, tombol `"Konfirmasi Masuk (Check-in)"`, status berhasil/digunakan/tidak valid, dan otomatis melakukan `router.replace("/officer/scan")` bila dibuka tanpa parameter `code` (tanpa form input manual ganda maupun standby `"Menunggu Pemindaian"`).
- **Bukti Regresi Live Browser (`http://localhost:3000`, `20 November 2026`):**
  - Sidebar memuat tepat `["Dashboard", "Event Tugas", "Scan Tiket", "Riwayat Check-in"]` tanpa `"Validasi Tiket"`.
  - `/officer/validation` tanpa `?code=` otomatis dialihkan ke `/officer/scan`.
  - Pada `/officer/scan`: kamera aktif dengan pemilih lensa, `"Informasi Teknis Kamera"` ter-collapse (`aria-expanded="false"`) dan dapat dibuka, hanya ada 1 form input manual, input acak `RANDOM-INVALID-QR-20261120` ditolak `TIDAK VALID`, input manual `TKT-6C30E911` & upload optik PNG QR `TKT-6C30E911` keduanya tervalidasi `VALID` (tanpa menampilkan `qr_token` mentah), terbuka di `/officer/validation?code=TKT-6C30E911`, check-in pertama menghasilkan `CHECK-IN SELESAI`, scan ulang ditolak `SUDAH DIGUNAKAN` (`14.38 WIB oleh Officer Test`), `/officer/history` menampilkan log `TKT-6C30E911`, dan metrik `/officer` naik `+1` (`31 -> 32`) dengan `0` console error.

---

## 7. MATRIKS PRIORITAS PERBAIKAN

Berikut adalah matriks prioritas perbaikan dan integrasi komprehensif untuk sistem TicketWave:

| Prioritas | Komponen / Fitur | File Sumber Terkait | Estimasi Kompleksitas | Ketergantungan | Dampak Pengguna & Sistem |
|---|---|---|---|---|---|
| **KRITIS (P1)** | Perbaikan Bug Atribut Festival Musik | `app/modules/public/event_routes.py:138` | Sangat Rendah | Perbaikan `day_number` di Backend | Membuka akses katalog festival musik multi-hari tanpa crash HTTP 500. |
| **KRITIS (P1)** | Perbaikan Bug Checkout Tiket Promo/Diskon | `app/modules/ticket/checkout_routes.py:90` | Sangat Rendah | Perbaikan argumen `calculate_final_price` | Calon pembeli dapat menyelesaikan transaksi tiket Early Bird/Presale. |
| **KRITIS (P1)** | Perbaikan Nilai `final_price` Null pada Detail Event | `app/modules/public/event_routes.py:149` | Sangat Rendah | Penyelarasan argumen fungsi pricing | Informasi harga tiket diskon tampil akurat di halaman publik tanpa kalkulasi manual di FE. |
| **KRITIS (P1)** | Keamanan Webhook Midtrans & Status Kartu Kredit | `app/modules/ticket/checkout_routes.py:220-262`| Sedang | Signature verification SHA512 & status `capture` | Mencegah manipulasi pembayaran palsu dan memastikan tiket kartu kredit terbit otomatis. |
| **TINGGI (P2)** | Integrasi Officer Portal & QR Scanner | `app/lib/officerService.js` & `app/modules/officer` | Sedang | Aktivasi blueprint `scan_bp` di `app/__init__.py` | Petugas pintu masuk dapat memvalidasi dan check-in tiket pengunjung secara langsung. |
| **TINGGI (P2)** | Integrasi Riwayat Pesanan & Asosiasi Akun | `app/modules/ticket/checkout_routes.py:103` | Sedang | Simpan `user_id` dari JWT & rute `GET /api/bookings` | Pesanan tersimpan permanen di akun pengguna dan tersinkronisasi lintas perangkat. |
| **TINGGI (P2)** | Implementasi Layanan Pengiriman Email E-Tiket | `app/modules/ticket/checkout_routes.py:251` | Sedang | Konfigurasi SMTP / transactional email service | Pembeli menerima konfirmasi resmi, kode booking, dan PDF/QR tiket via email. |
| **SEDANG (P3)** | Pemasangan Midtrans Snap Popup SDK Resmi | `app/user/pesanan/[id]/page.jsx` | Sedang | Endpoint backend return `snap_token` asli | Pembayaran tiket langsung di dalam antarmuka web tanpa redirect tab. |
| **SEDANG (P3)** | Penyediaan Endpoint Logout Resmi Server | `app/modules/auth/routes.py` | Rendah | Endpoint `POST /api/auth/logout` + token blacklist | Token JWT yang telah logout dicabut hak aksesnya di server. |
| **SEDANG (P3)** | Integrasi Formulir Update Profil User | `app/user/profile/page.jsx` | Rendah | Endpoint `PUT /api/auth/me` di Backend | Pengguna dapat memperbarui nomor kontak dan nama profil akun. |
| **RENDAH (P4)** | Perbaikan Parameter Delete & Upload Cloudinary | `app/modules/admin/event_routes.py:247, 277` | Rendah | Gunakan `public_id` pada `delete_image` + .env | Mencegah penumpukan file orphan di Cloudinary dan error upload 422. |
| **RENDAH (P4)** | Otomasi Background Scheduler Kedaluwarsa Pesanan | `app/modules/ticket/checkout_routes.py:166` | Sedang | Cron job / Celery worker periodik | Mencegah penguncian kuota tiket tertahan (*stale reserved quota*) secara otomatis. |
| **RENDAH (P4)** | Optimasi Composite Indexing Query Event Publik | `app/models/event.py` | Rendah | Indeks komposit `(city, event_date)` | Menjamin waktu respons pencarian katalog event tetap instan pada volume data besar. |

---

## 8. RENCANA PENYELESAIAN DAN ROADMAP INTEGRASI

Untuk mencapai integrasi penuh antara Frontend dan Backend TicketWave, langkah-langkah perbaikan disarankan mengikuti urutan strategis berikut:

```
Tahap 1: Backend Critical Bugfixes & Keamanan Transaksi
├── 1. Perbaikan bug AttributeError FestivalArtist.day_number di BE
├── 2. Perbaikan bug TypeError calculate_final_price di checkout dan public event BE
├── 3. Implementasi validasi SHA512 signature key & status 'capture' pada webhook Midtrans
└── 4. Ekstraksi identity JWT untuk mengisi kolom user_id pada pembuatan booking
        │
        ▼
Tahap 2: Pemulihan Modul Scanner Officer & Portabilitas Akun
├── 1. Pendaftaran blueprint scan_bp (/api/scan/*) di BE
├── 2. Uji live scanner kamera FE (/officer/scan & /officer/validation)
├── 3. Penyediaan endpoint sentral GET /api/checkout/my-bookings di BE
└── 4. Refactor app/user/pesanan/page.jsx migrasi dari localStorage ke API terpusat
        │
        ▼
Tahap 3: Penyempurnaan Gateway Pembayaran, Email, & Autentikasi
├── 1. Integrasi Midtrans Snap Token asli di backend checkout & modal snap.pay() di FE
├── 2. Integrasi SMTP email service untuk pengiriman otomatis e-tiket
├── 3. Penyediaan endpoint POST /api/auth/logout (token blacklist) & PUT /api/auth/me
        │
        ▼
Tahap 4: Optimasi Performa, Storage, & Background Task
├── 1. Perbaikan delete_image Cloudinary menggunakan public_id dan konfigurasi .env
├── 2. Implementasi background cron worker untuk auto-cancel booking expired (lepas kuota)
└── 3. Penambahan composite index pada tabel events (city, event_date)
```

---

## 9. KESIMPULAN & PEMUTAKHIRAN FINAL (21 NOVEMBER 2026)

### 1. Rekonsiliasi Cakupan Endpoint (`42` Route Flask Terdaftar vs Laporan `38/38` & `34/42`)
- **Total Route Flask Terdaftar (`app.url_map`):** `42` route (terdiri dari `39` route `UI-facing`, `2` route infrastruktur yang tetap terhubung otomatis `/health` dan `POST /api/auth/refresh`, serta `1` endpoint server-to-server `POST /api/checkout/payment/notification`).
- **Cakupan di Next.js:** Seluruh **39/39 (100%) route fitur Web** (`Auth` 8, `Public` 3, `Checkout & Orders` 5, `Admin Agencies` 6, `Admin Events` 8, `Admin Ticket Phases` 5, `Officer Scan` 4) plus `/health` dan `POST /api/auth/refresh` (`41/42`) telah terintegrasi di Next.js. Webhook `POST /api/checkout/payment/notification` tidak membutuhkan tombol UI.
- **Alasan Selisih Laporan Lama (`38/38` vs `34/42`):** Angka `38/38` berasal dari hitungan endpoint yang saat itu sudah ada sebelum penambahan `PUT /api/auth/me`, `POST /api/auth/logout`, dan `GET /api/checkout/my-bookings`, sedangkan angka `34/42` mencampurkan fitur terencana yang tidak pernah terdaftar di Flask (manajemen user admin, laporan omzet global, penugasan officer/kasir, refund, dan diskon khusus akun).

### 2. Pembaruan Status Masalah Frontend (21 November 2026)
- **Masalah 1 (`RESOLVED — PASS`):** `PesananPage` & `TicketPage` kini memanggil `GET /api/checkout/my-bookings` untuk akun login (teruji lintas origin `127.0.0.1:3000` dengan `localStorage` kosong), dan memakai `X-Guest-Token` / `X-Buyer-Email` untuk Guest.
- **Masalah 2 (`PARTIAL — ARCHITECTURE CHOICE`):** Checkout memakai redirect Midtrans Snap v4 resmi (`payment_url`) di tab yang sama dengan return handler `/payment/finish`, `/payment/unfinish`, `/payment/error`; popup SDK `snap.pay()` opsional tidak dibutuhkan karena return alur sama tab berjalan lengkap.
- **Masalah 3 (`RESOLVED — PASS`):** `/user/profile` kini menyediakan form edit interaktif `PUT /api/auth/me` (teruji live update nama & nomor telepon).
- **Masalah 4 (`RESOLVED — PASS`):** QR tiket tidak aktif sebelum `paid` (`status: "pending"`, `qr_token: null`), aktif saat `paid`, dan dinonaktifkan lagi menjadi `"Acara Selesai"` tanpa menghapus riwayat bila acara `finished`/`archived` atau lewat `event_end_time`.
- **Masalah 5 (`RESOLVED — PASS`):** Guest checkout & return `/payment/finish` tidak lagi memaksa `/login`; keluar tanpa bayar (`/payment/unfinish`) kembali ke booking sama, `Lanjutkan Pembayaran` memakai `payment_url` yang sama tanpa duplikasi booking, dan role `officer` terisolasi penuh.
- **Logout & Harga Diskon Pecahan (`RESOLVED — PASS`):** `AuthContext.jsx` memanggil `POST /api/auth/logout` (`revoked_tokens`), `eventDisplay.js` memprioritaskan `final_price` Backend, `CheckoutSummary.jsx` menampilkan Harga Normal, Diskon Fase (`%`), dan Total resmi, serta form Admin Event/Phase mendukung `event_end_time` dan persentase pecahan `step="0.01"`.

### 3. Ringkasan Hasil Uji & Gap Tersisa (`PASS` / `BLOCKED` / `NOT TESTED`)
- **Automated Checks (`PASS`):** Backend `unittest` `26/26 OK`; Frontend `npm test` `8/8 PASS`, `npm run lint` `0 errors`, `npx tsc --noEmit` `0 errors`, `npm run build` exit `0`.
- **Live Browser & Midtrans Sandbox Verification (`PASS`):** Admin Agency/Event/Phase `12.5%` + Upload Cloudinary `sample-media.png`, Guest Catalog/Detail/Checkout + Snap + `/payment/finish` return + Cross-Origin Guest Email Gate, User Paid Permata VA (`Rp 280.000`) + Unfinish/Continue Reuse + Cross-Device History + Profile Edit + Logout + Wrong-User `403`, Officer Isolation + Unpaid `400` + Upload QR PNG Check-In (`1x`) + Duplicate `409` + Event `finished` `400` + User History Preservation.
- **`NOT TESTED`:** Kamera fisik webcam Officer (`html5-qrcode` live video stream tidak diuji pada browser headless).
- **`BLOCKED`:**
  1. Diskon Khusus Akun Login (menunggu keputusan nominal/persentase & aturan penggabungan dengan Early Bird).
  2. Live SMTP Inbox Delivery (kode SMTP & `log_only` fallback siap, `.env` belum terisi kredensial SMTP).
  3. Live Public HTTPS Midtrans Webhook Delivery ke localhost (kode webhook SHA-512 lulus unit test; lingkungan localhost Sandbox memakai `POST .../sync-payment-status`).
  4. Penutupan otomatis berbasis waktu untuk event `festival` (belum ada field tanggal/jam akhir global pada `Event`, mengandalkan status Admin `finished`/`archived`).
  5. Modul rencana belum di Backend: Manajemen User Admin (`ISSUE-05`), Agregasi Laporan Global (`ISSUE-06`), Penugasan Event/Gate Officer (`ISSUE-07`), Kategori Event (`ISSUE-11`), dan Refund.
