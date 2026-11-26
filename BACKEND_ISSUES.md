# DOKUMENTASI MASALAH & KETERBATASAN ARSITEKTUR BACKEND TICKETWAVE
**File Path:** `C:\Users\LOQ\Documents\TicketWave\TicketWave-FE\BACKEND_ISSUES.md`  
**Target Komponen:** Backend Flask (`TicketWave-BE`)  
**Referensi Terkait:** Frontend Next.js (`TicketWave-FE/web`), Mobile Expo (`TicketWave-FE/mobile`), Laporan Audit Integrasi (`MD.BE.md`), Audit Frontend (`BE.md`)  
**Tanggal Diperbarui:** 21 November 2026  
**Status Audit:** Verifikasi Kode Aktual + Alembic Migration (`8b4e2f1a9c01`) + Unit Test (`26/26 PASS`) + Live End-to-End Browser & Midtrans Sandbox (`PASS` untuk fitur aktif, disertai daftar item `BLOCKED`/`NOT TESTED`)  

Dokumen ini adalah **sumber tunggal kebenaran (single source of truth)** untuk seluruh temuan teknis, bug kode, celah keamanan, dan keterbatasan desain API pada Backend Flask TicketWave. Dokumen ini membedakan secara tegas antara **Bug Internal Backend** (kesalahan sintaksis, nama kolom database, signature fungsi, exception handler) dengan **Keterbatasan Desain / Fitur Rencana** (ketiadaan endpoint spesifik, integrasi eksternal tanpa kredensial, atau fitur baru yang menunggu keputusan produk).

---

## Ringkasan Masalah Backend & Pembaruan Final (21 November 2026)

- **Total Issue Tercatat:** `15`
- **Status `RESOLVED — PASS`:** `9` (`ISSUE-01`, `ISSUE-02`, `ISSUE-03`, `ISSUE-04`, `ISSUE-08`, `ISSUE-09` [Sandbox PASS], `ISSUE-13`, `ISSUE-14`, `ISSUE-15`)
- **Status `BLOCKED` (Kredensial/Infrastruktur Eksternal):** `2` (`ISSUE-10` [Live Webhook tanpa HTTPS publik], `ISSUE-12` [Live SMTP tanpa kredensial di `.env` — kode SMTP & fallback log `PASS`])
- **Status `BLOCKED` (Fitur Rencana / Belum Diimplementasikan di Backend):** `4` (`ISSUE-05`, `ISSUE-06`, `ISSUE-07`, `ISSUE-11`) — ditambah **Fitur Baru `BLOCKED`**: *Diskon Khusus Akun Login* (ditahan menunggu keputusan nominal/persentase dan aturan penggabungan dengan Early Bird)
- **Status `NOT TESTED`:** Kamera fisik Officer (`html5-qrcode` webcam live stream tidak dijalankan di browser headless; jalur upload gambar QR PNG `jsQR`/`scanFile` + input manual lulus live `PASS`)

### Rekonsiliasi Cakupan Endpoint Backend (42 Route Flask Terdaftar vs Laporan 38/38 & 34/42)

Dari pemeriksaan langsung `app.url_map` setelah finalisasi (`21 November 2026`), Backend Flask mendaftarkan tepat **42 route**:
1. **Endpoint Operasional / Webhook / Internal (`3` route):**
   - `GET /health` (dipakai `/admin/settings` untuk monitoring opsional, tidak butuh menu user umum)
   - `POST /api/checkout/payment/notification` (server-to-server Midtrans webhook, tidak punya tombol UI)
   - `POST /api/auth/refresh` (refresh interceptor otomatis di `api.js`, tanpa tombol UI manual)
2. **Endpoint Fitur Web Aktif (`39` route `UI-facing`, seluruhnya terintegrasi dan dipakai di Next.js — `39/39` atau `41/42` termasuk `/health` & `/auth/refresh`; webhook server-only `1/42`):**
   - **Auth (`8` UI + `1` refresh = `9`):** `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` *(baru)*, `/api/auth/me` `GET` & `PUT` *(baru)*, `/api/auth/verify-email/<token>`, `/api/auth/request-password-reset`, `/api/auth/reset-password`, `/api/auth/refresh`.
   - **Public Catalog (`3`):** `/api/public/events`, `/api/public/events/<int:event_id>`, `/api/public/events/cities`.
   - **Checkout & Orders (`5` UI + `1` webhook = `6`):** `POST /api/checkout`, `GET /api/checkout/my-bookings` *(baru)*, `GET /api/checkout/<booking_code>`, `POST /api/checkout/<booking_code>/cancel`, `POST /api/checkout/<booking_code>/sync-payment-status`, `POST /api/checkout/payment/notification`.
   - **Admin Agencies (`6`):** `GET/POST /api/agencies`, `GET/PUT/DELETE /api/agencies/<id>`, `POST /api/agencies/<id>/logo`.
   - **Admin Events (`8`):** `GET/POST /api/events`, `GET/PUT/DELETE /api/events/<id>`, `POST /api/events/<id>/poster`, `POST /api/events/<id>/banner`, `PATCH /api/events/<id>/status`.
   - **Admin Ticket Phases (`5`):** `GET/POST /api/ticket-types/<id>/phases`, `GET/PUT/DELETE /api/phases/<id>`.
   - **Officer Scan (`4`):** `GET /api/scan/stats`, `GET /api/scan/history`, `POST /api/scan/validate`, `POST /api/scan/check-in`.
3. **Alasan Perbedaan Laporan `38/38` vs `34/42`:**
   - Sebelum finalisasi terdapat `39` route terdaftar (bukan `42`): laporan `38/38` menghitung route terintegrasi non-internal pada kondisi sebelum 3 endpoint baru ditambahkan (`logout`, `PUT /me`, `my-bookings`) dan tanpa menghitung rute yang memang belum ada; sedangkan angka `34/42` memasukkan fitur yang belum tersedia di Backend (manajemen user admin, laporan/analitik omzet, penugasan officer/kasir, dll.) atau mengabaikan perbedaan endpoint operasional/internal.

### Fitur & Gap Tambahan yang Diselesaikan / Dicatat (21 November 2026)
- **Akses Pesanan (Booking Ownership & Guest Verification — `PASS`):** `GET /api/checkout/<code>`, `POST .../cancel`, dan `POST .../sync-payment-status` kini memeriksa kepemilikan JWT `user_id` (`401`/`403` tanpa kebocoran PII/tiket) serta mendukung akses Guest yang aman via `X-Guest-Token` HMAC-SHA256 dan verifikasi `X-Buyer-Email` (`guest_email`).
- **Masa Berlaku Tiket & Pelestarian Riwayat (`PASS`, dengan Gap Festival):** Tiket baru dibuat dengan `status="pending"` dan `qr_token: null` hingga status booking `paid`; validasi dan check-in menolak tiket belum lunas (`400`) serta acara `finished`, `archived`, atau event `single` yang melewati `event_end_time` resmi / `event_date` (`400`) tanpa mengubah DB maupun statistik scan, sambil melestarikan riwayat pesanan/pembayaran/tiket User. **Gap tercatat:** event bertipe `festival` saat ini belum memiliki field jadwal tanggal/jam selesai per hari atau tanggal akhir global, sehingga penutupan otomatis berbasis waktu untuk festival ditandai sebagai gap dan mengandalkan transisi status Admin `finished` / `archived`.

| ID | Masalah | Prioritas | Status Terakhir | Dampak Next.js & Hasil Verifikasi | Dampak Mobile |
|---|---|:---:|:---:|---|---|
| **ISSUE-01** | Detail festival multi-day menghasilkan HTTP 500 (`FestivalArtist.day` vs `day_number`) | **P1** | **RESOLVED — PASS** | `/user/event/[id]` memuat detail & lineup festival (`HTTP 200 OK`) | Layar `event/[id].tsx` dapat memuat detail festival |
| **ISSUE-02** | Seluruh endpoint officer menghasilkan HTTP 404 (`scan_bp` & `kasir_bp` belum terdaftar) | **P1** | **RESOLVED — PASS** *(Kamera fisik: `NOT TESTED`)* | Seluruh `/officer/*` berfungsi penuh; live browser memverifikasi upload QR PNG `Pindai Gambar QR`, input manual, unpaid `400`, duplikat `409`, acara `finished` `400`, dan isolasi role (`PASS`); `/api/kasir/*` tetap `NOT APPLICABLE` | Kompatibel dengan `/api/scan/*` |
| **ISSUE-03** | Upload media logo, poster, dan banner gagal (`500` unhandled SDK, URL `delete_image` bug, whitespace/`.env` `@`) | **P2** | **RESOLVED — PASS** | Konfigurasi Cloudinary `.env` dibersihkan, `UploadGatewayError` -> HTTP `503` terpasang, `extract_cloudinary_public_id` & `delete_image` diperbaiki, **teruji live browser upload logo agensi & poster event berhasil (`200 OK` -> URL CDN `res.cloudinary.com`)** + unit test `422`/`503`/`destroy` mock lulus | Endpoint media konsisten |
| **ISSUE-04** | Ketiadaan endpoint daftar pesanan pengguna (`GET /api/checkout/my-bookings`) | **P2** | **RESOLVED — PASS** | `GET /api/checkout/my-bookings` diimplementasikan; `/user/pesanan` dan `/user/ticket` disinkronkan lintas perangkat via akun + `guest_access_token` HMAC & verifikasi email untuk Guest; teruji live lintas origin `127.0.0.1:3000` | Mobile dapat bermigrasi ke `GET /api/checkout/my-bookings` |
| **ISSUE-05** | Ketiadaan endpoint daftar manajemen users admin (`GET /api/users`) | **P3** | **BLOCKED** *(Planned / Belum Diimplementasikan)* | Tidak menjadi bagian modul web yang tersedia; dicatat terpisah pada roadmap Admin | Belum tersedia |
| **ISSUE-06** | Ketiadaan endpoint agregasi omzet dan analitik penjualan global | **P3** | **BLOCKED** *(Planned / Belum Diimplementasikan)* | Dashboard Admin menggunakan data event & agency tanpa mengklaim laporan omzet global Backend | Belum tersedia |
| **ISSUE-07** | Ketiadaan model dan endpoint penugasan officer ke event/gate | **P3** | **BLOCKED** *(Planned / Membutuhkan Desain Produk/Skema)* | Officer tetap menggunakan halaman tugas tanpa skema penugasan per-event/gate | Belum tersedia |
| **ISSUE-08** | Bug kalkulasi fase harga tiket & SQLite `Decimal` (`bookings.discount_percent`, `calculate_final_price`) | **P1** | **RESOLVED — PASS** | `Booking.discount_percent` dimigrasi ke `Numeric(5,2)`, `calculate_final_price` & `event_routes.py` diperbaiki dengan `Decimal` `ROUND_HALF_UP`; teruji live diskon pecahan `12.5%` konsisten identik (`Rp 160.000` -> `Rp 140.000`, qty 2 `Rp 280.000`) dari katalog -> detail -> checkout -> booking -> Midtrans Snap | Konsisten untuk klien Mobile |
| **ISSUE-09** | Simulasi dummy URL Midtrans Snap & return sesi/pembayaran (`POST /api/checkout`) | **P2** | **RESOLVED — PASS (SANDBOX)** | Snap Sandbox nyata + Permata VA Simulator terbayar (`Rp 280.000`), guest return `/payment/finish` tidak dipaksa `/login`, exit tanpa bayar (`/payment/unfinish`) kembali ke booking sama & `Lanjutkan Pembayaran` memakai ulang `payment_url` tanpa duplikasi; **Production remains separate** | Terbatas pada konfigurasi Sandbox |
| **ISSUE-10** | Kelemahan keamanan webhook Midtrans (`SHA-512`, `capture`, cancel/expire tiket) | **P2** | **IMPLEMENTED — LIVE WEBHOOK BLOCKED** | Kode SHA-512, `compare_digest`, `capture`/`settlement`/`refund`, idempotensi & transisi `pending` -> `valid` lulus unit test; uji terima webhook HTTP publik ke localhost terblokir tanpa URL HTTPS publik (`BLOCKED`), dimitigasi dengan `POST .../sync-payment-status` di Sandbox | Konsisten |
| **ISSUE-11** | Ketiadaan atribut kategori/genre pada model Event | **P4** | **BLOCKED** *(Planned Schema Extension)* | Katalog Next.js memfilter tipe/kota/tanggal/teks sesuai API | Belum tersedia |
| **ISSUE-12** | Layanan email verifikasi & reset password hanya output print log | **P3** | **CODE IMPLEMENTED — LIVE SMTP BLOCKED** | Helper `app/utils/email_service.py` (SMTP TLS stdlib + fallback `log_only` aman tanpa token leak) diimplementasikan & lulus unit test; pengiriman inbox nyata tetap `BLOCKED` karena `.env` belum mengisi kredensial `SMTP_HOST`/`SMTP_EMAIL`/`SMTP_PASSWORD` | Menunggu konfigurasi `.env` SMTP |
| **ISSUE-13** | Status code mismatch pada `error_response` (`403`/`404`/`409` jadi `400`) | **P3** | **RESOLVED — PASS** | Seluruh `error_response(..., status_code=...)` pada `decorators.py`, `event_routes.py`, `auth/routes.py`, `checkout_routes.py` diperbaiki dan teruji mengembalikan HTTP `401`/`403`/`404`/`409` sebenarnya | Klien menerima kode HTTP akurat |
| **ISSUE-14** | Ketiadaan endpoint pembaruan profil pengguna (`PUT /api/auth/me`) | **P3** | **RESOLVED — PASS** | `PUT /api/auth/me` + halaman `/user/profile` interaktif diimplementasikan dan teruji live browser (`E2E User1 Updated` & nomor telepon tersimpan setelah reload) + unit test konflik `409` | Tersedia untuk Mobile |
| **ISSUE-15** | Ketiadaan mekanisme revokasi sesi & endpoint logout (`POST /api/auth/logout`) | **P3** | **RESOLVED — PASS** | Tabel `revoked_tokens`, blocklist loader JWT, `POST /api/auth/logout`, dan integrasi `AuthContext.jsx` diimplementasikan; unit test memverifikasi access+refresh token ditolak `401`, dan live logout browser mencatat `revoked_tokens=14` di SQLite | Tersedia untuk Mobile |

---

## ISSUE-01 — Detail Festival Multi-Day Menghasilkan HTTP 500

- **Status:** `RESOLVED`
- **Prioritas:** `P1` (High)
- **Komponen:** Public Event Module (`app/modules/public/event_routes.py`)
- **Endpoint:** `GET /api/public/events/<event_id>`
- **File terkait:**
  - `app/modules/public/event_routes.py` (Baris 138–143 setelah perubahan)
  - `app/models/festival_artist.py` (Baris 14)
- **Gejala:**
  Setiap kali pengguna (guest/user) membuka detail event bertipe `festival`, server Flask mengalami unhandled exception dan mengembalikan respons `HTTP 500 Internal Server Error`.
- **Hasil aktual (sebelum perbaikan):**
  `HTTP 500 Internal Server Error`.  
  Traceback Flask Backend:  
  `AttributeError: type object 'FestivalArtist' has no attribute 'day'`
- **Hasil yang diharapkan:**
  Server mengembalikan respons `HTTP 200 OK` dengan format data:
  ```json
  {
    "success": true,
    "message": "Event detail retrieved successfully",
    "data": {
      "event": { ... },
      "lineup": [
        { "id": 1, "day_number": 1, "artist_name": "Hindia" },
        { "id": 2, "day_number": 2, "artist_name": "Tulus" }
      ],
      "ticket_types": [ ... ]
    }
  }
  ```
- **Akar masalah:**
  Pada `app/modules/public/event_routes.py` baris 138 (sebelum perbaikan), kode melakukan query:
  ```python
  festival_artists = FestivalArtist.query.filter_by(event_id=event.id).order_by(FestivalArtist.day.asc()).all()
  ```
  Sedangkan pada model `app/models/festival_artist.py` baris 14, kolom database didefinisikan sebagai:
  ```python
  day_number = db.Column(db.Integer, nullable=False)
  ```
  Atribut `day` tidak ada pada model SQLAlchemy, sehingga query SQL gagal dieksekusi.
- **Dampak pada Next.js:**
  Sebelum perbaikan, halaman Next.js `/user/event/[id]` mengalami error boundary saat membuka event festival musik (`[API Error] "/public/events/12" 500`). Setelah perbaikan, halaman `/user/event/12` berhasil memuat detail festival dan daftar artis tanpa error.
- **Dampak pada mobile:**
  Sebelum perbaikan, layar `event/[id].tsx` di aplikasi Expo menampilkan banner error "Gagal memuat detail event" (`HTTP 500`). Setelah perbaikan, endpoint `GET /api/public/events/12` mengembalikan `HTTP 200 OK` sehingga detail festival dan lineup artis dapat digunakan oleh Next.js dan Mobile.
- **Langkah reproduksi:**
  1. Buat event dengan `event_type: "festival"` dan status `"on_sale"`.
  2. Tambahkan artis pada tabel `festival_artists` untuk event tersebut.
  3. Kirimkan request `GET http://localhost:5000/api/public/events/<event_id>`.
  4. Amati respons HTTP dan urutan array `data.lineup`.
- **Perbaikan yang diterapkan (Catatan Resolusi):**
  - **Akar masalah:** Query detail festival pada `app/modules/public/event_routes.py` memanggil `FestivalArtist.day.asc()`, sedangkan model `FestivalArtist` (`app/models/festival_artist.py` baris 14) mendefinisikan field `day_number`.
  - **File kode yang diperbaiki:** `C:\Users\LOQ\Documents\TicketWave\TicketWave-BE\app\modules\public\event_routes.py`
  - **Baris aktual setelah perubahan:** Baris `138–143` (di dalam blok `if event.event_type == "festival":` pada baris `137–144`).
  - **Perubahan kode (`FestivalArtist.day.asc()` → `FestivalArtist.day_number.asc()`):**
    ```python
    # SEBELUM (Baris 138):
    festival_artists = FestivalArtist.query.filter_by(event_id=event.id).order_by(FestivalArtist.day.asc()).all()

    # SESUDAH (Baris 138-143):
    festival_artists = (
        FestivalArtist.query
        .filter_by(event_id=event.id)
        .order_by(FestivalArtist.day_number.asc())
        .all()
    )
    ```
  - **Bukti sebelum perbaikan:** `GET http://127.0.0.1:5000/api/public/events/12` menghasilkan `HTTP 500 INTERNAL SERVER ERROR` dengan `AttributeError: type object 'FestivalArtist' has no attribute 'day'`.
  - **Bukti setelah perbaikan:** `GET http://127.0.0.1:5000/api/public/events/12` menghasilkan **`HTTP 200 OK`** (`"success": true`, `"message": "Event detail retrieved successfully"`) dengan kontrak respons `{ "agency", "event", "lineup", "ticket_types" }` tetap utuh.
  - **Bukti urutan artis menggunakan `day_number`:** Pada `event_id = 12` (`SoundWave Summer Fest 2026`), array `data.lineup` dikembalikan terurut naik berdasarkan `day_number`:
    1. `{"id": 1, "event_id": 12, "day_number": 1, "artist_name": "Sheila on 7"}`
    2. `{"id": 2, "event_id": 12, "day_number": 2, "artist_name": "Dewa 19"}`
    3. `{"id": 3, "event_id": 12, "day_number": 3, "artist_name": "Padi Reborn"}`
  - **Bukti tidak ada regresi pada event single dan daftar event publik:**
    - `GET http://127.0.0.1:5000/health` → `HTTP 200 OK` (`{"service": "TicketWave Backend", "status": "ok"}`)
    - `GET http://127.0.0.1:5000/api/public/events` → `HTTP 200 OK` (`total_items: 11`)
    - `GET http://127.0.0.1:5000/api/public/events/4` (`single` — `Jakarta Mega Concert 1984`) → `HTTP 200 OK` (`lineup: []`)
    - `GET http://127.0.0.1:5000/api/public/events/5` (`single` — `Jakarta Mega Concert 7001`) → `HTTP 200 OK` (`lineup: []`, `ticket_types: 1`)
  - **Dampak:** Detail festival (`GET /api/public/events/12`) kini dapat digunakan oleh Next.js (`/user/event/12` diverifikasi tampil penuh tanpa `API Error 500`) dan Mobile (`/event/12`).
  - **Tanggal verifikasi aktual:** `20 November 2026`
  - **Status akhir:** `RESOLVED`
- **Risiko perubahan:**
  Rendah. Tidak mengubah struktur skema database maupun kontrak respons API.
- **Kriteria penerimaan:**
  Request `GET /api/public/events/<event_id>` untuk festival mengembalikan status `HTTP 200 OK` dan array `lineup` terurut berdasarkan `day_number`.
- **Bukti pengujian:**
  Verifikasi runtime `GET /api/public/events/12` (`HTTP 200 OK`), verifikasi UI Next.js `http://localhost:3000/user/event/12` (`HTTP 200 OK`, lineup Hari ke-1 s/d Hari ke-3 tampil urut), serta pencarian kode menyeluruh memastikan `0` referensi `FestivalArtist.day` yang tersisa di `TicketWave-BE`.

---

## ISSUE-02 — Seluruh Endpoint Officer Menghasilkan HTTP 404

- **Status:** `RESOLVED — LIVE QR VALIDATION AND CHECK-IN VERIFIED`
- **Prioritas:** `P1` (High)
- **Komponen:** Officer Module (`app/modules/officer/scan_routes.py`) & App Factory (`app/__init__.py`)
- **Endpoint Terimplementasi & Terverifikasi (`/api/scan/*`):**
  - `GET /api/scan/stats`
  - `GET /api/scan/history`
  - `POST /api/scan/validate` (strictly read-only; validasi dua tahap)
  - `POST /api/scan/check-in` (pembaruan atomik pada tabel `tickets`)
  - *(Catatan ruang lingkup: `kasir_bp` `/api/kasir/*` tidak dibutuhkan oleh portal scanner Officer Web maupun Mobile saat ini sehingga tetap ditunda / di luar ruang lingkup perbaikan `ISSUE-02` ini).*
- **File terkait:**
  - `TicketWave-BE/app/modules/officer/scan_routes.py` (Baru — blueprint `scan_bp` lengkap dengan guard JWT + role `officer`/`admin`, sanitasi payload, validasi status `valid`/`used`/`cancelled`/`pending_payment`/`expired`, atomic check-in, dan serialisasi aman tanpa membocorkan `qr_token` maupun field rekaan)
  - `TicketWave-BE/app/__init__.py` (Baris 58 & 66 — mendaftarkan `scan_bp` dengan `url_prefix="/api/scan"`)
  - `TicketWave-BE/tests/test_officer_scan.py` (Baru — 5 unit test guard role `401`/`403`, read-only validate, penolakan unpaid/expired/cancelled/random/malformed, atomic check-in + duplicate `409`, dan histori/statistik)
- **Gejala (Sebelum Perbaikan):**
  Seluruh request yang dikirimkan oleh portal petugas (baik dari browser maupun scanner perangkat mobile) menerima status `HTTP 404 Not Found`.
- **Akar masalah (Sebelum Perbaikan):**
  1. Pada `app/__init__.py`, pendaftaran `scan_bp` masih dikomentari.
  2. File `app/modules/officer/scan_routes.py` belum dibuat di folder `app/modules/officer/`.
- **Perbaikan yang diterapkan (Catatan Resolusi):**
  - Mengimplementasikan keempat endpoint `/api/scan/*` sesuai kontrak bersama **Next.js** (`web/app/lib/officerService.js`) dan **Mobile** (`mobile/src/api/endpoints.ts`) tanpa memerlukan perubahan skema atau migrasi database (`Ticket` sudah memiliki `ticket_code`, `qr_token`, `status`, `checked_in_at`, `checked_in_by`).
  - Seluruh endpoint dilindungi `@jwt_required()` dan pengecekan role `officer`/`admin` (mengembalikan `HTTP 401` tanpa token dan `HTTP 403` untuk role `user`).
  - `POST /api/scan/validate` bersifat strictly read-only dan mendukung pencarian berdasarkan `qr_token` resmi (masked di UI) maupun `ticket_code` (`case-insensitive`): mengembalikan `200 VALID`, `200 DIBATALKAN`, `409 SUDAH DIGUNAKAN`, `400 TIDAK VALID` (unpaid/expired/malformed), atau `404 TIDAK VALID` (tidak ditemukan), tanpa pernah mengembalikan HTTP `500` maupun `qr_token` pada payload respons.
  - `POST /api/scan/check-in` melakukan `UPDATE` SQL atomik bersyarat (`Ticket.status == "valid"` dan `Ticket.checked_in_at IS NULL`) sehingga check-in ganda ditolak konsisten dengan `HTTP 409` (`SUDAH DIGUNAKAN`, beserta `first_checked_in_at` UTC & `first_checked_in_by`).
- **Dampak pada Next.js & Mobile:**
  - Portal Officer Next.js (`/officer`, `/officer/scan`, `/officer/validation`, `/officer/history`) kini beroperasi penuh end-to-end dengan database riil tanpa 404 dan tanpa mock fallback.
  - Endpoint `/api/scan/*` juga selaras dengan parser pada Mobile (`mobile/src/api/endpoints.ts`) tanpa merusak kontrak API Mobile.
- **Kriteria penerimaan:**
  Keempat endpoint terdaftar pada `app.url_map`, lulus unit test terotomasi, serta lulus pengujian runtime end-to-end dari render QR resmi Next.js hingga check-in Officer dan penolakan scan kedua.
- **Bukti pengujian:**
  - Unit test Backend: `python -m unittest discover -s tests -p 'test_*.py' -v` -> `18` test lulus (`OK`, exit code `0`, mencakup 13 test Midtrans + 5 test Officer scan).
  - Pemeriksaan `app.url_map`: memuat `/api/scan/stats`, `/api/scan/history`, `/api/scan/validate`, `/api/scan/check-in`.
  - Pengujian browser live Next.js + Midtrans Sandbox (`booking_code`: `TKTW-20261120-ABDBB5`, `ticket_code`: `TKT-D8FB3D98`, penanda uji `E2E-WEB-QR-SCAN-20261120`):
    - Gambar PNG QR resmi yang dirender Next.js didekodekan secara optik via `html5-qrcode` (`scanFile`) di `/officer/scan` -> validasi pertama `VALID` (dua tahap), konfirmasi check-in pertama `CHECK-IN SELESAI` (`checked_in_by`: Officer Test), scan optik kedua pada gambar QR yang sama & validasi manual ulang ditolak `HTTP 409 SUDAH DIGUNAKAN`, input acak ditolak `HTTP 404 TIDAK VALID`, `/officer/history` mencatat `checkin-122`, dan `success_count` pada `/officer` naik tepat satu (`29 -> 30`).
- **Tanggal verifikasi aktual:** `20 November 2026`
- **Status akhir:** `RESOLVED — LIVE QR VALIDATION AND CHECK-IN VERIFIED`

---

## ISSUE-03 — Upload Media Logo, Poster, dan Banner Menghasilkan HTTP 500

- **Status:** `RESOLVED — PASS` *(Diperbaiki & Teruji Live Upload Cloudinary 21 November 2026)*
- **Prioritas:** `P2` (Medium-High)
- **Komponen:** Upload Service (`app/utils/upload_service.py`), Config (`app/config/config.py`, `app/config/cloudinary_config.py`) & Media Routes
- **Endpoint:**
  - `POST /api/agencies/<int:agency_id>/logo`
  - `POST /api/events/<int:event_id>/poster`
  - `POST /api/events/<int:event_id>/banner`
- **Akar Masalah Sebelumnya:**
  1. `config.py` dibaca sebelum `load_dotenv()` dan nilai `.env` Cloudinary mengandung spasi depan / awalan `@`.
  2. `upload_image` tidak membungkus exception Cloudinary SDK sehingga memicu HTTP 500 uncaught.
  3. `delete_image` dikirim URL penuh alih-alih `public_id`.
- **Perbaikan yang Diterapkan:**
  - `TicketWave-BE/app/__init__.py` & `app/config/config.py`: Memanggil `load_dotenv()` sebelum membaca env serta membersihkan spasi dan awalan `@` (`strip().lstrip("@")`) pada `CLOUDINARY_*`.
  - `TicketWave-BE/app/config/cloudinary_config.py`: Sanitasi kredensial serupa saat inisialisasi.
  - `TicketWave-BE/app/utils/upload_service.py`: Menambahkan `UploadGatewayError` (HTTP `503`), `is_cloudinary_configured()`, `extract_cloudinary_public_id()`, membungkus upload dengan try/except yang aman tanpa membocorkan secret, serta mengekstrak `public_id` di `delete_image`.
  - `TicketWave-BE/app/modules/admin/agency_routes.py` & `event_routes.py`: Menangkap `UploadGatewayError` -> `503` dan membersihkan media lama saat mengganti logo/poster/banner.
- **Hasil Uji Ulang (21 November 2026):**
  - **Unit test (`test_auth_media_errors.py`):** Lulus (`503` jika belum terkonfigurasi/gagal otorisasi, `extract_cloudinary_public_id` valid, mock `cloudinary.uploader.destroy` memverifikasi penghapusan aset lama).
  - **Live Browser Upload:** Unggah `sample-media.png` pada pembuatan Agensi `#9` (`POST /api/agencies/9/logo`) dan edit Event `#13` (`POST /api/events/13/poster`) berhasil (`HTTP 200`, menyimpan URL `https://res.cloudinary.com/...`).

---

## ISSUE-04 — Ketiadaan Endpoint Daftar Pesanan Pengguna

- **Status:** `RESOLVED — PASS` *(Diimplementasikan & Teruji Lintas Perangkat 21 November 2026)*
- **Prioritas:** `P2` (Medium-High)
- **Komponen:** Checkout & Booking Module (`app/modules/ticket/checkout_routes.py`)
- **Endpoint Baru:** `GET /api/checkout/my-bookings`
- **Akar Masalah Sebelumnya:** `user_id` di-hardcode `None` dan belum ada endpoint riwayat pesanan per akun sehingga riwayat Next.js hanya bergantung pada bookmark `localStorage` per browser.
- **Perbaikan & Hasil Uji Ulang:**
  - `TicketWave-BE/app/modules/ticket/checkout_routes.py`: Mengisi `user_id` dari JWT terverifikasi saat login, menambahkan `GET /api/checkout/my-bookings` (`@jwt_required()`, read-only, menolak `officer` `403`, mengembalikan booking beserta event, ticket_type, dan tiket ter-serialisasi), serta menjaga keamanan pesanan Guest dengan `X-Guest-Token` HMAC & verifikasi `X-Buyer-Email`.
  - Frontend Next.js (`web/app/lib/bookingStorage.js`, `user/pesanan/page.jsx`, `user/ticket/page.jsx`): Akun login langsung memuat dari `GET /api/checkout/my-bookings`; teruji live browser pada origin berbeda `http://127.0.0.1:3000` dengan penyimpanan lokal kosong tetap menampilkan seluruh booking & tiket (`TKTW-20261121-703785`, `TKTW-20261121-2DF8A7`) serta lulus unit test `test_booking_access_control_my_bookings_guest_verification_and_ticket_qr_lifecycle`.

---

## ISSUE-05 — Ketiadaan Endpoint Daftar Manajemen Users Admin

- **Status:** `OPEN` (Keterbatasan Desain API)
- **Prioritas:** `P3` (Medium)
- **Komponen:** Auth & Admin User Module
- **Endpoint:** Ketiadaan `GET /api/users`
- **File terkait:**
  - `app/modules/auth/routes.py`
  - `app/__init__.py`
- **Gejala:**
  Admin tidak dapat melihat daftar akun terdaftar dalam sistem (baik role `user`, `officer`, maupun `admin`), tidak dapat mencari user berdasarkan email/nama, dan tidak dapat mengelola akun dari antarmuka.
- **Hasil aktual:**
  Request `GET /api/users` mengembalikan `HTTP 404 Not Found` karena tidak ada rute yang terdaftar.
- **Hasil yang diharapkan:**
  Tersedia endpoint `GET /api/users` dengan parameter pencarian dan paginasi yang dikhususkan untuk Administrator.
- **Akar masalah:**
  Modul manajemen user tingkat platform belum dikembangkan pada backend Flask. Blueprint `auth_bp` hanya berfokus pada autentikasi diri sendiri (`/login`, `/register`, `/me`).
- **Dampak pada Next.js:**
  Komponen navigasi admin pengguna tidak memiliki sumber data dan hanya berfungsi sebagai placeholder UI.
- **Dampak pada mobile:**
  Halaman `admin/users.tsx` terpaksa menampilkan disclaimer dan hanya dapat memuat data profil admin sendiri dari `GET /api/auth/me` serta relasi petugas dari `GET /api/agencies`.
- **Langkah reproduksi:**
  Login sebagai Admin dan akses `GET http://localhost:5000/api/users`. Respons menghasilkan HTTP 404.
- **Saran perbaikan:**
  Tambahkan rute pada modul admin (`app/modules/admin/user_routes.py`) atau tambahkan ke blueprint admin:
  ```python
  @admin_bp.get("/users")
  @jwt_required()
  @role_required("admin")
  def list_users(current_user):
      query = User.query.order_by(User.created_at.desc())
      # pagination & search logic
      ...
  ```
- **Risiko perubahan:**
  Rendah. Endpoint baru terisolasi di bawah proteksi role admin.
- **Kriteria penerimaan:**
  Admin dapat melihat daftar seluruh user, memfilter berdasarkan role, dan memeriksa status verifikasi email secara dinamis.
- **Bukti pengujian:**
  Daftar route pada `app.url_map` membuktikan tidak adanya entri endpoint `/api/users`.

---

## ISSUE-06 — Ketiadaan Endpoint Agregasi Omzet dan Analitik Penjualan Global

- **Status:** `OPEN` (Keterbatasan Desain API)
- **Prioritas:** `P3` (Medium)
- **Komponen:** Analytics & Reporting Module
- **Endpoint:** Ketiadaan `GET /api/admin/stats` atau `GET /api/admin/revenue`
- **File terkait:**
  - `app/modules/admin/event_routes.py`
  - `app/models/booking.py`
- **Gejala:**
  Dashboard admin tidak dapat menampilkan angka perputaran dana / omzet riil dan metrik performa penjualan tiket secara akurat.
- **Data yang saat ini tersedia di database:**
  - `TicketType.sold_count` (jumlah tiket terjual per jenis tiket).
  - `TicketType.quota` (kuota kapasitas).
  - `TicketType.base_price` (harga dasar).
  - `Booking.total_price` dan `Booking.status` (`paid`, `pending_payment`, `cancelled`).
- **Akar masalah:**
  Backend belum menyediakan controller yang melakukan kalkulasi agregasi SQL (`SUM`, `COUNT`) terhadap transaksi berstatus `paid`.
- **Dampak pada Next.js:**
  Halaman dashboard admin Next.js terpaksa menghitung estimasi pendapatan secara manual di sisi browser dengan mengalikan kuota terjual dengan harga dasar (`sold_count * base_price`), yang menghasilkan angka tidak akurat karena mengabaikan diskon fase harga dan transaksi refund.
- **Dampak pada mobile:**
  Aplikasi mobile (`admin/index.tsx`) memilih menampilkan tanda `—` pada kartu estimasi omzet untuk menghindari penyajian data palsu atau estimasi yang menyesatkan.
- **Langkah reproduksi:**
  Periksa endpoint statistik pada rute Flask; tidak tersedia agregator finansial global.
- **Saran perbaikan:**
  Buat endpoint `GET /api/admin/stats` dengan query agregasi database terverifikasi:
  ```python
  total_revenue = db.session.query(func.sum(Booking.total_price)).filter(Booking.status == "paid").scalar() or 0
  total_tickets_sold = db.session.query(func.sum(Booking.quantity)).filter(Booking.status == "paid").scalar() or 0
  ```
- **Risiko perubahan:**
  Rendah.
- **Kriteria penerimaan:**
  Dashboard admin menyajikan angka omzet riil berdasarkan transaksi lunas yang dapat diverifikasi terhadap riwayat mutasi pembayaran.
- **Bukti pengujian:**
  Kode sumber `mobile/app/admin/index.tsx:40-42` mengonfirmasi ketiadaan endpoint omzet dari backend.

---

## ISSUE-07 — Ketiadaan Model dan Endpoint Penugasan Officer ke Event/Gate

- **Status:** `OPEN` (Keterbatasan Desain API)
- **Prioritas:** `P3` (Medium)
- **Komponen:** Officer & Agency Relation Model
- **Endpoint:** Ketiadaan `GET /api/officer/my-events` atau `GET /api/officer/assignments`
- **File terkait:**
  - `app/models/agency.py` (Baris 21)
  - `app/models/user.py` (Baris 31)
  - `app/modules/officer/`
- **Gejala:**
  Petugas (officer) yang login tidak memiliki batasan atau penugasan spesifik terhadap event mana yang menjadi wewenang pemeriksaannya dan gate mana yang ditugaskan kepadanya.
- **Akar masalah:**
  1. Skema database saat ini hanya memetakan relasi 1:1 antara `agencies` dan `users` melalui foreign key `agency.officer_id`.
  2. Tidak ada model relasi `OfficerAssignment` atau tabel pivot yang menautkan `officer_id`, `event_id`, nama gate pass, dan jadwal bertugas.
- **Dampak pada Next.js:**
  Halaman daftar event officer (`/officer/events`) menampilkan seluruh event publik yang sedang aktif di sistem tanpa memfilter hak akses agensi atau event penugasan.
- **Dampak pada mobile:**
  Layar `officer/events.tsx` menampilkan daftar event publik dengan catatan disclaimer transparan bahwa Backend belum mendukung relasi penugasan officer-event spesifik.
- **Langkah reproduksi:**
  Periksa model `Agency` dan `User`; tidak terdapat atribut relasi penugasan ke level event atau gate.
- **Saran perbaikan:**
  1. Buat model database baru:
     ```python
     class OfficerAssignment(db.Model):
         __tablename__ = "officer_assignments"
         id = db.Column(db.Integer, primary_key=True)
         user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
         event_id = db.Column(db.Integer, db.ForeignKey("events.id"), nullable=False)
         gate_name = db.Column(db.String(50), default="Main Gate")
         assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
     ```
  2. Sediakan endpoint `GET /api/officer/my-events` untuk membatasi ruang lingkup pemindaian tiket oleh petugas.
- **Risiko perubahan:**
  Sedang. Memerlukan migrasi database (`flask db migrate`).
- **Kriteria penerimaan:**
  Petugas hanya dapat melihat dan memindai tiket untuk event yang ditugaskan oleh Admin / Agensi terkait.
- **Bukti pengujian:**
  Inspeksi relasi pada `app/models/agency.py:21-27` dan `app/models/user.py:30-32`.

---

## ISSUE-08 — Bug Kalkulasi Fase Harga Tiket dan Diskon pada Checkout & Katalog

- **Status:** `RESOLVED — PASS` *(Diperbaiki & Teruji Pecahan Desimal 12.5% Live hingga Midtrans Snap 21 November 2026)*
- **Prioritas:** `P1` (High)
- **Komponen:** Pricing Utility (`app/utils/pricing.py`), Booking Model (`app/models/booking.py`), Checkout & Public Modules
- **Endpoint:** `POST /api/checkout`, `GET /api/public/events`, `GET /api/public/events/<event_id>`
- **Akar Masalah Sebelumnya:**
  1. `public/event_routes.py` memanggil `calculate_final_price(float(base_price), discount_percent)` alih-alih `calculate_final_price(ticket_type.id)`.
  2. SQLite menolak binding objek Python `Decimal` (`TicketPhase.discount_percent`) ke kolom `Booking.discount_percent` bertipe `Integer` (`sqlite3.ProgrammingError`), serta pembagian integer/float berisiko selisih presisi saat persentase pecahan dipakai.
- **Perbaikan yang Diterapkan:**
  - `TicketWave-BE/app/utils/pricing.py`: Perhitungan `Decimal` + `ROUND_HALF_UP` ke Rupiah bulat (`discount_percent`, `discount_amount`, `final_price`).
  - `TicketWave-BE/app/models/booking.py` + Alembic `8b4e2f1a9c01`: Kolom `bookings.discount_percent` diubah ke `db.Numeric(5, 2)`.
  - `TicketWave-BE/app/modules/public/event_routes.py` & `app/modules/ticket/checkout_routes.py`: Memanggil `calculate_final_price(tt.id)` dan meneruskan `discount_amount` serta `active_phase.discount_percent` bertipe float akurat ke JSON & Midtrans `gross_amount`.
  - Next.js (`eventDisplay.js`, `checkout.js`, `CheckoutSummary.jsx`, Admin Phase form `step="0.01"`): Memprioritaskan `final_price` Backend serta menampilkan Harga Normal, Diskon Fase, dan Total resmi.
- **Catatan Fitur Terpisah:** *Diskon khusus akun login* tetap berstatus `BLOCKED` dan ditahan hingga keputusan nominal/persentase dan aturan penggabungan dengan Early Bird disetujui.
- **Hasil Uji Ulang (21 November 2026):**
  - Unit test `test_fractional_phase_discount_consistency_across_catalog_detail_checkout_and_snap` (`12.5%` pada `Rp 150.000` -> `Rp 131.250`, qty 2 -> `Rp 262.500`) lulus.
  - Live browser Event `#13` (`Regular` normal `Rp 160.000`, `early_bird` `12.5%`): Katalog (`Mulai dari Rp 140.000`), Detail (`Rp 140.000`), Checkout Summary Guest (`Rp 140.000`) & User (`2x` `Rp 280.000`), booking DB, dan Midtrans Sandbox Snap (`Rp140.000` & `Rp280.000`) identik seluruhnya.

---

## ISSUE-09 — Simulasi Dummy URL Pembayaran Midtrans Snap Tanpa Integrasi Riil API

- **Status:** `RESOLVED — PASS (SANDBOX)` *(Integrasi Sandbox & jalur return Guest/User terverifikasi nyata hingga Permata VA Simulator; deploy Production terpisah dengan kredensial Production)*
- **Prioritas:** `P2` (Medium-High)
- **Komponen:** Checkout & Payment Gateway Module (`app/modules/ticket/checkout_routes.py`, `app/modules/ticket/schema.py`)
- **Endpoint:** `POST /api/checkout`, `GET /api/checkout/<booking_code>` (read-only), `POST /api/checkout/<booking_code>/sync-payment-status` (Sandbox/dev only)
- **File terkait:**
  - `app/config/config.py` (`FRONTEND_URL`)
  - `app/modules/ticket/checkout_routes.py`
  - `app/modules/ticket/schema.py`
  - `web/app/components/user/PaymentMethod.jsx`
  - `web/app/user/checkout/page.jsx`
  - `web/app/user/pesanan/[id]/page.jsx`
  - `web/app/payment/finish/page.jsx`
  - `web/app/payment/unfinish/page.jsx`
  - `web/app/payment/error/page.jsx`
  - `web/app/components/payment/PaymentReturnHandler.jsx`
  - `web/app/lib/paymentContext.js`
  - `web/app/lib/authRedirect.js`
  - `web/app/lib/api.js`
- **Gejala (sebelum perbaikan):**
  Setelah proses checkout tiket berhasil, nilai `payment_url` yang diberikan kepada pengguna adalah string statis tiruan (`https://app.midtrans.com/snap/v2/vtweb/<booking_code>`), bukan URL transaksi resmi yang dihasilkan oleh API Midtrans Snap.
- **Yang Sudah Selesai (Sandbox Terverifikasi — 20 November 2026):**
  - **Snap Sandbox nyata:** `POST /api/checkout` memanggil endpoint resmi Sandbox `POST https://app.sandbox.midtrans.com/snap/v1/transactions` menggunakan Basic Auth `MIDTRANS_SERVER_KEY` (tanpa mengekspos key), mengirimkan `transaction_details`, `customer_details`, `item_details`, `callbacks` (`finish`/`error`/`pending` -> `<FRONTEND_URL>/payment/finish?booking_code=<booking_code>` berbasis env `FRONTEND_URL`), `expiry`, dan `enabled_payments` yang terverifikasi, serta melakukan rollback atomik jika gagal. Selain itu, `create_checkout()` kini mengisi `booking.user_id` dari token JWT `user` bila ada (sambil tetap mendukung guest checkout). *(Lihat pula `Masalah 5 — Return Midtrans Membocorkan Sesi Role dan Salah Redirect` pada `TicketWave-FE/web/BE.md`.)*
  - **Redirect URL Sandbox:** Server mengembalikan `redirect_url` Sandbox resmi (`https://app.sandbox.midtrans.com/snap/v4/...`) dan menyimpannya di `booking.payment_url`.
  - **Virtual Account Permata Sandbox:** Pilihan `virtual_account` pada `CheckoutSchema` (`validate.OneOf(["transfer_bank", "virtual_account", "qris"])`) memetakan channel VA resmi Midtrans, dan pembayaran VA Permata dummy berhasil disimulasikan di Simulator Sandbox.
  - **Get Status API:** Endpoint eksplisit `POST /api/checkout/<booking_code>/sync-payment-status` memanggil `GET https://api.sandbox.midtrans.com/v2/<order_id>/status` langsung dari Backend dengan Server Key, memvalidasi `order_id` serta `gross_amount`, dan menolak mode Production (`403`), request tanpa JWT (`401`), maupun pengguna non-pemilik/non-admin (`403`).
  - **Booking `paid`:** Booking Sandbox uji `id = 107` (`TKTW-20261120-9F07F8`) berstatus `paid` (`payment_method = bank_transfer:permata`) dengan record `Transaction` id = `1` berstatus `settlement`.
  - **E-ticket aktif:** Tiket `id = 119` (`TKT-0323294C`) berstatus `valid` dan modal QR Pass aktif setelah `paid` (serta tetap terkunci sebelum `paid`).
  - **Frontend direct payment:** Halaman checkout Next.js mewajibkan pemilihan metode pembayaran, mencegah double-submit, dan langsung mengarahkan browser ke `payment_url` Snap Sandbox resmi; halaman detail pesanan kini memisahkan `GET` read-only dengan tombol eksplisit `"Periksa Status Pembayaran"` (`POST .../sync-payment-status`) hanya saat `pending_payment`.
  - **Tidak ada URL dummy:** Pola URL fiktif `https://app.midtrans.com/snap/v2/vtweb/<booking_code>` telah dihapus sepenuhnya dari Backend dan diblokir oleh `getOfficialPaymentUrl()` di Frontend.
- **Yang Masih Diperlukan untuk Production:**
  - **Kredensial Production:** Mengisi `MIDTRANS_SERVER_KEY` (`Mid-server-...`) dan `MIDTRANS_CLIENT_KEY` (`Mid-client-...`) akun Merchant Midtrans Production yang sah.
  - **`MIDTRANS_IS_PRODUCTION=true` hanya saat deployment Production:** Tidak mengaktifkan flag Production selama pengembangan/Sandbox lokal.
  - **Pengujian nominal kecil yang disetujui secara terkontrol:** Melakukan uji transaksi Production bernilai minimal di bawah persetujuan eksplisit pemilik bisnis.
  - **Validasi domain Production:** Menyesuaikan `getOfficialPaymentUrl()` dan allowlist origin pembayaran agar domain Snap Production terverifikasi ketat sesuai lingkungan aktif.
  - **Finish URL:** Mengonfigurasi Callback Finish Redirect URL pada dashboard Midtrans agar pengguna kembali ke halaman detail pesanan resmi setelah bayar.
  - **Error URL:** Mengonfigurasi Error Redirect URL agar kegagalan pembayaran pada Snap diarahkan ke layar informasi error yang jelas.
  - **Notification URL HTTPS publik:** Memasang endpoint HTTPS publik `/api/checkout/payment/notification` pada Pengaturan Notification URL di Dashboard Midtrans Production.
  - **Secret management:** Menyimpan Server Key, Client Key, dan JWT secret dalam secret manager platform deployment (bukan file teks di repositori).
  - **Monitoring transaksi:** Menyediakan observability/alerting untuk error gateway `502`/`503`/`504`, mismatch nominal, dan transaksi pending mendekati batas `expired_at`.
  - **Rekonsiliasi status:** Menyediakan scheduled reconciliation job berbasis Midtrans Get Status API untuk menangani kasus webhook tertunda/terlewat.
  - **Prosedur refund:** Menyediakan alur operasional dan endpoint/rekonsiliasi resmi untuk `refund` / `partial_refund` dan pengembalian kuota tiket.
  - **Pengujian pembayaran Production terpisah:** Menjalankan checklist verifikasi end-to-end terpisah khusus deployment Production (bukan disamakan dengan Sandbox verification).
- **Bukti Verifikasi Sandbox Nyata (20 November 2026):**
  - Booking Sandbox uji dipertahankan: `booking_id = 107` (`TKTW-20261120-9F07F8`), `ticket_id = 119` (`TKT-0323294C`), `transaction_id = 1` (`settlement`), `ticket_type_id = 16` (`sold_count = 1`), serta booking uji alur return Midtrans (`TKTW-20261120-84BA9B`, `paid`, `TKT-6C30E911`, `user_id = 3`; dan `TKTW-20261120-193E11` yang membuktikan tombol Close `×` header Snap mengarah ke `/payment/finish?booking_code=TKTW-20261120-193E11&...`).
  - `GET /api/checkout/TKTW-20261120-9F07F8` berulang terbukti murni read-only (`SHA-256 instance/dev.db` identik sebelum dan sesudah `GET`); `POST /api/checkout/TKTW-20261120-9F07F8/sync-payment-status` teruji `HTTP 401` tanpa JWT dan idempotent `HTTP 200` (`synced = false`, `midtrans_status = settlement`) dengan JWT Admin.
  - Unit Test Backend: `tests/test_checkout_midtrans.py` — **15/15 test lulus (`OK`)** (bagian dari **20/20** suite test Backend, mencakup validasi `callbacks` `FRONTEND_URL` dan optional JWT `booking.user_id`), ditambah **5/5** unit test Frontend `app/lib/sessionIsolation.test.mjs`.

---

## ISSUE-10 — Kelemahan Keamanan Webhook Midtrans (Tanpa SHA-512, Status Kartu Kredit `capture` Terabaikan, & Tiket Tidak Di-cancel)

- **Status:** `IMPLEMENTED — LIVE WEBHOOK VERIFICATION BLOCKED` *(Kode keamanan, idempotensi, & sinkronisasi eksplisit telah diimplementasikan dan lulus unit test lokal; penerimaan live webhook dari Midtrans ke localhost masih `BLOCKED-BY-ENVIRONMENT` karena tidak ada URL HTTPS publik)*
- **Prioritas:** `P2` (Medium-High)
- **Komponen:** Payment Webhook & Sync Module (`app/modules/ticket/checkout_routes.py`, `app/models/booking.py`)
- **Endpoint:** `POST /api/checkout/payment/notification`, `POST /api/checkout/<booking_code>/sync-payment-status`
- **File terkait:**
  - `app/modules/ticket/checkout_routes.py` (`payment_notification`, `sync_booking_payment_status`, `get_booking_detail`, `apply_midtrans_transaction_status`, `_gross_amount_matches`)
  - `app/models/booking.py` (`cancel()`, `expire()`)
  - `tests/test_checkout_midtrans.py`
- **Yang Sudah Selesai:**
  - **Signature SHA-512:** Handler `payment_notification()` menghitung `SHA512(order_id + status_code + gross_amount + ServerKey)`.
  - **`compare_digest`:** Perbandingan signature menggunakan `hmac.compare_digest` yang tahan timing-attack (signature salah ditolak dengan `HTTP 403`).
  - **Gross amount validation:** Menolak ketidaksesuaian `gross_amount` terhadap `booking.total_price` menggunakan presisi `Decimal` (`HTTP 400`).
  - **Order ID validation:** Memastikan `order_id` ada di database `bookings` (`HTTP 404`), disertai validasi format 3-digit `status_code` dan allowlist `transaction_status` serta `fraud_status` (`HTTP 400`).
  - **Idempotensi:** Pemanggilan webhook berulang maupun notifikasi tidak berurutan (out-of-order, misalnya `pending`/`expire`/`cancel` yang datang terlambat setelah `settlement`) tidak menurunkan status `paid`, tidak menggandakan record `Ticket`/`Transaction`, dan tidak mengurangi/menambah `sold_count` lebih dari satu kali.
  - **Status lengkap:** Menangani `settlement`, `capture` (`fraud_status = accept` → `paid`; `deny` → `cancelled`; `challenge` → tetap `pending`), `pending`, `deny`, `cancel`, `expire`, `refund`, dan `partial_refund`.
  - **Ticket cancellation:** `Booking.cancel()` dan `Booking.expire()` menonaktifkan seluruh tiket terkait (`ticket.status = "cancelled"`) dan mengembalikan kuota `sold_count` dengan batas aman `max(0, ...)`.
  - **Unit test:** `tests/test_checkout_midtrans.py` memverifikasi seluruh skenario keamanan, idempotensi, out-of-order, refund ganda, GET read-only, timeout `504`, ownership sync, dan blokir mode Production (**13/13 test lulus**).
- **Yang Masih Diperlukan (Produksi & Verifikasi Live Webhook):**
  - **Deploy Backend pada HTTPS publik:** Server Production harus dapat dijangkau langsung oleh Midtrans melalui TLS/HTTPS valid (jangan gunakan tunnel lokal tanpa persetujuan saat development).
  - **Atur Notification URL di dashboard Midtrans:** Daftarkan endpoint resmi `https://<domain-backend>/api/checkout/payment/notification`.
  - **Verifikasi webhook Sandbox nyata:** Setelah deployment HTTPS tersedia, uji pengiriman notifikasi otomatis langsung dari Midtrans Dashboard / Sandbox ke endpoint HTTPS tersebut.
  - **Verifikasi retry notification:** Uji respons HTTP `200`/`4xx`/`5xx` terhadap mekanisme retry otomatis Midtrans untuk memastikan keandalan antrean webhook.
  - **Verifikasi notifikasi tidak berurutan:** Konfirmasi ulang behavior state machine pada skenario retry & out-of-order webhook di lingkungan staging HTTPS.
  - **Monitoring webhook gagal:** Tambahkan alert dan log terstruktur (tanpa Server Key/data rahasia) jika terjadi kegagalan verifikasi atau error `500` saat memproses webhook.
  - **Get Status reconciliation job:** Tambahkan cron/worker berkala backend untuk memeriksa transaksi `pending_payment` yang hampir kedaluwarsa apabila webhook gagal terkirim.
  - **Rate limit endpoint fallback:** Terapkan rate limiting pada endpoint checkout & sinkronisasi bila fitur Sandbox/admin reconciliation tetap dipertahankan.
  - **Ownership booking dan perbaikan `ISSUE-04`:** Hubungkan `booking.user_id` dengan akun user yang login saat checkout (`ISSUE-04`) dan sediakan token akses tamu yang aman sehingga kontrol kepemilikan tidak bergantung pada pencocokan `buyer_email` di Sandbox.
  - **Jangan menggunakan localhost sebagai Notification URL:** Server Midtrans tidak dapat mengirim callback HTTP/HTTPS ke `127.0.0.1` atau `localhost`.
- **Catatan Arsitektur:**
  - **`GET /api/checkout/<booking_code>` sudah read-only:** Endpoint `GET` detail pesanan tidak memanggil API Midtrans maupun mengubah tabel `bookings`, `tickets`, `transactions`, `paid_at`, atau `ticket_types.sold_count`.
  - **Sinkronisasi eksplisit menggunakan `POST`:** Pemeriksaan status manual ke Midtrans Get Status API dipindahkan ke `POST /api/checkout/<booking_code>/sync-payment-status`.
  - **Webhook tetap mekanisme utama Production:** Endpoint sinkronisasi `POST` otomatis diblokir (`HTTP 403`) apabila `MIDTRANS_IS_PRODUCTION=true` atau `FLASK_ENV=production`.
  - **Fallback `POST` tidak boleh menjadi endpoint publik tanpa perlindungan:** Saat ini dilindungi kewajiban JWT (`401`), pemeriksaan kepemilikan (`user_id` cocok atau `admin`), pembatasan guest (`user_id is None` karena `ISSUE-04` hanya diizinkan untuk `admin` atau email pembeli yang cocok pada lingkungan Sandbox/dev), dan selalu mengambil status langsung dari Midtrans menggunakan Server Key Backend (tidak pernah mempercayai payload status dari Frontend).

---

## ISSUE-11 — Ketiadaan Atribut Kategori / Genre pada Model Event dan Endpoint Katalog Publik

- **Status:** `OPEN` (Keterbatasan Desain API)
- **Prioritas:** `P4` (Low)
- **Komponen:** Event Model (`app/models/event.py`) & Public Catalog (`app/modules/public/event_routes.py`)
- **Endpoint:** `GET /api/public/events`
- **File terkait:**
  - `app/models/event.py` (Baris 10-30)
  - `app/modules/public/event_routes.py` (Baris 24-84)
- **Gejala:**
  Fitur penyaringan event berdasarkan kategori (misalnya Musik, Olahraga, Teater, Seni, Festival) di frontend tidak berfungsi di sisi server dan seluruh event tetap ditampilkan tanpa filter kategori yang dipilih.
- **Akar masalah:**
  1. Model `Event` di `app/models/event.py` hanya memiliki kolom `event_type` (`single` atau `festival`) dan `city`. Tidak ada kolom `category` atau `genre`.
  2. Pada `app/modules/public/event_routes.py:38-44`, controller hanya membaca query parameter `city`, `event_type`, `search`, `date_from`, dan `date_to`.
  3. Query parameter `category` yang dikirimkan oleh Frontend Next.js atau Mobile tidak dikenali dan diabaikan.
- **Dampak pada Next.js:**
  Filter kategori pada halaman eksplorasi event (`web/app/events/page.jsx`) tidak memfilter data event sesuai genre.
- **Dampak pada mobile:**
  Filter chip kategori (Live Concert, Music Festival, Pop, Rock, EDM) pada layar `(tabs)/events.tsx` hanya dapat memfilter sebagian via `event_type`, sementara genre spesifik tidak terfilter di backend.
- **Langkah reproduksi:**
  Kirim request `GET /api/public/events?category=Music` dan amati bahwa query SQL yang dieksekusi Flask tidak memfilter kolom kategori.
- **Saran perbaikan:**
  1. Tambahkan kolom `category = db.Column(db.String(50), nullable=True, default="Music")` pada model `Event`.
  2. Jalankan migrasi database (`flask db migrate -m "add category to events"`).
  3. Tambahkan filter `if category: query = query.filter(Event.category.ilike(f"%{category}%"))` pada `list_public_events`.
- **Risiko perubahan:**
  Rendah hingga Sedang. Memerlukan migrasi skema tabel `events`.
- **Kriteria penerimaan:**
  Request `GET /api/public/events?category=Music` hanya mengembalikan event dengan kategori yang sesuai.
- **Bukti pengujian:**
  Inspeksi model pada `app/models/event.py` dan controller `app/modules/public/event_routes.py:38-50`.

---

## ISSUE-12 — Layanan Email Verifikasi & Reset Password (Helper SMTP Terpasang, Live SMTP `BLOCKED` Tanpa Kredensial)

- **Status:** `CODE IMPLEMENTED — LIVE SMTP DELIVERY BLOCKED`
- **Prioritas:** `P3` (Medium)
- **Komponen:** Authentication & Email Utility (`app/utils/email_service.py`, `app/modules/auth/routes.py`, `app/config/config.py`)
- **Endpoint:** `POST /api/auth/register`, `POST /api/auth/request-password-reset`
- **Perbaikan yang Diterapkan:** Membuat `app/utils/email_service.py` berbasis `smtplib` + `email.message` stdlib TLS (`SMTP_HOST`, `SMTP_PORT`, `SMTP_EMAIL`, `SMTP_PASSWORD`, `SMTP_USE_TLS`, `SMTP_FROM_NAME`) dengan fallback `log_only` aman tanpa mengekspos token/password di respons HTTP maupun dokumentasi, lalu menghubungkannya ke `register` & `request_password_reset`.
- **Hasil Uji Ulang (21 November 2026):** Unit test `test_email_service_log_fallback_and_password_reset_response` lulus (`PASS` untuk jalur kode & respons `email_delivery: "log_only"`); pengiriman email inbox SMTP live berstatus **`BLOCKED`** karena `.env` belum dikonfigurasi dengan kredensial `SMTP_HOST`/`SMTP_EMAIL`/`SMTP_PASSWORD`.

---

## ISSUE-13 — Status Code Mismatch pada Handler Helper `error_response`

- **Status:** `RESOLVED — PASS` *(Diperbaiki & Teruji HTTP 401/403/404/409 21 November 2026)*
- **File Diubah:** `app/utils/decorators.py`, `app/modules/public/event_routes.py`, `app/modules/auth/routes.py`, `app/modules/ticket/checkout_routes.py`.
- **Akar Masalah Sebelumnya:** `error_response(message="...", errors=None, status_code=400)` dipanggil dengan angka status HTTP di argumen posisi kedua sehingga masuk ke `errors` dan HTTP status terkirim `400`.
- **Perbaikan & Hasil Uji Ulang:** Seluruh pemanggilan `error_response(..., 4xx)` diubah menggunakan `status_code=4xx` (`401`/`403`/`404`/`409`). Diverifikasi lewat unit test (`test_auth_media_errors.py`) maupun pengujian browser (`403` wrong user, `404` not found).

---

## ISSUE-14 — Ketiadaan Endpoint Pembaruan Profil Pengguna (`PUT /api/auth/me`)

- **Status:** `RESOLVED — PASS` *(Diimplementasikan & Teruji Live Browser + Unit Test 21 November 2026)*
- **Prioritas:** `P3` (Medium)
- **Komponen:** Authentication & User Profile (`app/modules/auth/schema.py`, `app/modules/auth/routes.py`) & Frontend (`web/app/user/profile/page.jsx`)
- **Akar Masalah Sebelumnya:** Hanya tersedia `GET /api/auth/me`; permintaan `PUT` menghasilkan HTTP `405`.
- **Perbaikan & Hasil Uji Ulang:** Ditambahkan `UpdateProfileSchema` dan `@auth_bp.put("/me")` (`@jwt_required()`) untuk memperbarui `name` dan `phone` (menolak duplikat nomor telepon dengan `409`). Teruji lewat unit test (`test_auth_media_errors.py`) dan live browser (`E2E User1 Updated` / `089920269999` tersimpan setelah reload `/user/profile`).

---

## ISSUE-15 — Ketiadaan Mekanisme Revokasi Sesi Server-Side & Endpoint Logout (`POST /api/auth/logout`)

- **Status:** `RESOLVED — PASS` *(Diimplementasikan & Teruji Unit Test + Live DB Blocklist 21 November 2026)*
- **Prioritas:** `P3` (Medium)
- **Komponen:** `app/models/revoked_token.py`, `app/__init__.py` (`token_in_blocklist_loader`), `app/modules/auth/routes.py`, Alembic `8b4e2f1a9c01`, & `web/app/context/AuthContext.jsx`
- **Akar Masalah Sebelumnya:** Autentikasi JWT stateless tanpa pencatatan JTI blocklist maupun endpoint `POST /api/auth/logout`.
- **Perbaikan & Hasil Uji Ulang:** Ditambahkan tabel `revoked_tokens`, callback `@jwt.token_in_blocklist_loader`, serta `POST /api/auth/logout` yang mencabut `access_token` maupun `refresh_token` opsional. Unit test memverifikasi token revoked ditolak `HTTP 401` pada `/api/auth/me`, `/api/auth/refresh`, dan `/api/checkout/my-bookings`; setelah uji browser live tercatat `revoked_tokens = 14` di `instance/dev.db`.

---

## Hasil Pengujian Terintegrasi Akhir (21 November 2026)

- **Backend Automated Suite (`unittest`):** `26/26` **PASS** (`Ran 26 tests in 11.668s — OK`), mencakup Checkout Midtrans, Booking Access Control + `/my-bookings`, Diskon Pecahan `12.5%`, Officer Scan (unpaid `pending`, `finished`/`archived`, `event_end_time`, duplikat `409`), `PUT /api/auth/me`, `POST /api/auth/logout`, SMTP fallback, Cloudinary `503`/`destroy` mock, dan status HTTP `401`/`403`/`404`/`409`.
- **Frontend Automated Checks (`web`):** `npm test` (`8/8 PASS`), `npm run lint` (`0` errors), `npx tsc --noEmit` (`0` errors), `npm run build` (exit `0`, `27` routes).
- **Live Browser + Midtrans Sandbox E2E (`[E2E-WEB-FINAL-20261121]`):**
  - Admin CRUD Agency `#9`, Event `#13` (`event_end_time` `23:55`), Phase `#3` (`12.5%`), Upload Logo/Poster Cloudinary: **PASS**.
  - Guest Checkout (`Rp 140.000` match di Katalog/Detail/Summary/Snap) + `/payment/finish` non-login return + Fresh-Origin Guest Email Verification (`401`/`403` no leak -> verified `200`): **PASS**.
  - User Paid Permata VA Simulator (`Rp 280.000`, `2x`) -> aktifkan QR `TKT-7E993B23` & `TKT-B47F7BDC` + Exit Without Paying (`/payment/unfinish` + reuse URL tanpa duplikasi) + Cross-Device `/user/pesanan` & `/user/ticket` (`127.0.0.1:3000`) + `/user/profile` update + Logout & Wrong-User `403`: **PASS**.
  - Officer Role Isolation + Unpaid `400` + Upload QR PNG `e2e-ticket-1.png` Check-In `1x` (`33 -> 34`) + Duplicate `409` + Event `finished` `400` + Pelestarian Riwayat User: **PASS**.
  - Kamera fisik Officer live webcam: **NOT TESTED**; Live SMTP, Live Public HTTPS Webhook, Diskon Khusus Akun, serta modul terencana (`ISSUE-05`–`ISSUE-07`, `ISSUE-11`, Refund): **BLOCKED**.

---
*Dokumentasi ini dikonsolidasikan dan dipelihara di TicketWave-FE sebagai referensi utama audit integrasi.*
