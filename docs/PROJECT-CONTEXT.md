# SIMAGANG Bapeda — Project Context & Session Handoff

> **BACA DOKUMEN INI DULU** sebelum mengubah kode apa pun.
> Dokumen ini ditulis agar model AI sesi berikutnya memahami **seluruh** sistem tanpa menebak-nebak.
> Terakhir diperbarui: **15 September 2026** (edit profil, notifikasi sudah dilihat, dedupe toast error, polish Absensi/sidebar, print A4, Supabase pooler).

---

## 0. Ringkasan satu menit

Sistem manajemen magang **Bapeda** (SIMAGANG):

| Repo | Path lokal | Remote GitHub | Port lokal |
|------|------------|---------------|------------|
| Backend API | `d:\DATATA\KKP FADLUL\ims-bapeda-backend` | `Athrayyanmuhmd/ims-bapeda-backend` | `:3001` |
| Backoffice FE | `d:\DATATA\KKP FADLUL\ims-bapeda-backoffice` | `Athrayyanmuhmd/ims-bapeda-backoffice` | `:3000` |

| Lingkungan | URL |
|------------|-----|
| FE production | https://simagang-bapeda.vercel.app |
| API production | https://simagang-bapeda-api.vercel.app |
| Supabase project | `brgyaorhucichpxtswtb` (`ims-bapeda`) |

- **Staff** (Admin / Pembimbing) → backoffice `/login` → `/dashboard`, dll.
- **Peserta magang** → login yang sama `/login` (fallback portal) → `/portal`.
- DB: **PostgreSQL** via Supabase pooler. ORM: **Prisma** (`DATABASE_URL` + `DIRECT_URL`).
- Auth: **Express JWT sendiri** — **bukan** Supabase Auth / `@supabase/ssr`.
- Branch kerja: `main`.

### Status push (15 Sep 2026 sore)

Sebagian besar sudah di-push ke `origin/main`. Referensi commit:

| Repo | Commit (contoh) | Isi |
|------|-----------------|-----|
| Backend | `2dbfa1f` | `PUT /users/me`, `PUT /portal/me` (edit profil) |
| Backend | `6821b94` | Docs Supabase pooler + Prisma `directUrl` |
| Backend | `928edab` / `6a4aa89` | List filters; login error 503 jelas |
| Frontend | `281db6d` | Dialog Edit Profil staff + portal |
| Frontend | `dd66d80` | Absensi layout, sidebar, `@page { size: A4 }` |
| Frontend | `6bd897b` / sebelumnya | Chip ringkasan absensi, filter, notif mobile, login await session |
| Frontend | (push berikutnya) | Notif “sudah dilihat” + dedupe toast saat pindah menu |

Cek dirty tree dengan:

```bash
cd "d:\DATATA\KKP FADLUL\ims-bapeda-backend"; git status -sb
cd "d:\DATATA\KKP FADLUL\ims-bapeda-backoffice"; git status -sb
```

---

## 1. Akun uji (setelah seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@bapeda.go.id` | `admin123` |
| Pembimbing | `bimbing@bapeda.go.id` | `bimbing123` |
| Peserta (seed tipikal) | `andi@student.ac.id` | `peserta123` |

Check-in portal hanya **07:00–09:00 WIB** pada hari kerja (Sen–Jum, bukan libur nasional).

---

## 2. Cara jalanin lokal

### Backend

```bash
cd "d:\DATATA\KKP FADLUL\ims-bapeda-backend"
npm install
# salin .env.example → .env
npm run db:migrate
npm run db:seed
npm run dev          # http://localhost:3001
npm test             # vitest
```

Env inti: `DATABASE_URL`, `DIRECT_URL` (opsional lokal; wajib pola production), `JWT_SECRET` (≥32 char), `PORT=3001`, `FRONTEND_URL=http://localhost:3000`, `APP_TIMEZONE=Asia/Jakarta`, `CHECKIN_START=07:00`, `CHECKIN_END=09:00`, `CHECKOUT_AUTO_AT=17:00`.

Detail pooler: `docs/SUPABASE-SETUP.md` (kedua repo).

### Frontend

```bash
cd "d:\DATATA\KKP FADLUL\ims-bapeda-backoffice"
pnpm install
# salin .env.example → .env.local
pnpm dev             # http://localhost:3000
pnpm test
```

Env inti: `NEXT_PUBLIC_FE_URL`, `NEXT_PUBLIC_BE_URL`.  
Opsional dokumen: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET=dokumen` (bucket **private**).

---

## 3. Arsitektur besar

```
Browser
  ├─ /login (unified) ──► POST /login (staff) ──401──► POST /portal/login (peserta)
  ├─ Staff cookie: token-session, user-session ──► Axios api.ts Bearer ──► Express :3001
  └─ Portal cookie: portal-token-session, portal-peserta-session ──► portalApi ──► /portal/*
                                                      │
                                                      ▼
                                              Prisma → PostgreSQL (Supabase)
```

- **Tidak ada `middleware.ts` Next.js.** Guard di layout `(protected)` / `portal` + interceptor 401.
- JWT staff: `typ: "user"` (legacy boleh tanpa typ). JWT portal: `typ: "peserta"`. Secret sama (`JWT_SECRET`).
- Role **bukan** dari klaim JWT: setiap request staff, middleware reload user dari DB → `req.role` = nama Role.
- Login FE: **`await setSession()` / portal session sebelum redirect** (hindari race cookie → dashboard kosong).

### Scoping Pembimbing

- Helper: `pembimbingScope(req)` di `ims-bapeda-backend/src/middleware/auth.ts`.
- Admin → `undefined` (lihat semua).
- Non-Admin → `req.userId` (hanya peserta dengan `pembimbingLapanganId` = user itu).
- Record di luar scope → **404**, bukan 403 (anti-enumeration).

Roles seed: **Admin**, **Pembimbing**, **User**. Ops staff: `STAFF_OPS_ROLES = ["Admin","Pembimbing"]`.

---

## 4. Backend — peta folder & pola

```
ims-bapeda-backend/src/
  index.ts                 # mount routes, /health, CORS, helmet
  middleware/auth.ts       # authenticate, requireRole, pembimbingScope
  middleware/authPeserta.ts
  lib/
    pagination.ts          # parsePagination → page/rows/searchFilters/filters
    datetime.ts            # WIB, check-in window, dayRange
    autoCheckout.ts
    response.ts            # ok / paginated / fail
    serviceResult.ts       # success / failure
    validate.ts            # email, phone ID
  routes/<domain>/
    index.ts               # Router + middleware
    controller.ts
    service.ts
    repository.ts          # (beberapa modul)
    *.test.ts
```

### Mount path (`src/index.ts`)

| Prefix | Modul |
|--------|--------|
| `/login`, `/verify-token` | `routes/auth` |
| `/users` | users (+ `PUT /me`, `POST /change-password`) |
| `/divisi`, `/roles`, `/instansi` | master data |
| `/peserta-magang` | peserta |
| `/absensi` | absensi + izin approve/reject |
| `/logbook` | logbook (DB table masih `Jurnal`) |
| `/penilaian`, `/dokumen` | penilaian, dokumen |
| `/notifications` | summary computed (tanpa tabel inbox) |
| `/portal` | peserta portal (+ `PUT /me`) |

### Pagination / filter (WAJIB dipahami)

FE mengirim query (sering via POST body `{ params: "page=1&filters=..." }`) yang diparse `parsePagination`:

- `searchFilters`: JSON object → pencarian teks (allowlist per service).
- `filters`: JSON object → filter domain (divisiId, kehadiran, dll.).

Contoh filter absensi list: `tanggal`, `dariTanggal`, `sampaiTanggal`, `pesertaMagangId`, `izinStatus`, `kehadiran`, `divisiId`, `instansiId`, `pembimbingLapanganId`.

Contoh filter peserta list: `divisiId`, `instansiId`, `pembimbingLapanganId`, `status`.

Logbook / penilaian / dokumen: `pesertaMagangId`, `divisiId`, `instansiId`, `pembimbingLapanganId` (via relasi `pesertaMagang`).

Response list tipikal:

```json
{ "content": { "entries": [], "totalData": 0, "totalPage": 1 }, "message": "...", "errors": null }
```

---

## 5. Prisma models (inti)

File: `ims-bapeda-backend/prisma/schema.prisma`

| Model | Catatan |
|-------|---------|
| User | Staff; relasi Role, Divisi; jadi pembimbingLapangan |
| Role, Divisi, Instansi | Master |
| PesertaMagang | `password` portal terpisah; status AKTIF/SELESAI/BERHENTI |
| Absensi | `@@unique([pesertaMagangId, tanggal])`; Kehadiran Hadir/Sakit/Izin/Alpa; IzinStatus PENDING/APPROVED/REJECTED |
| Logbook | mapped ke tabel `Jurnal`; unique per peserta+tanggal |
| Penilaian | nilai + komentar + penilai User |
| Dokumen | JenisDokumen enum; urlFile |

`datasource` memakai `url` + `directUrl` untuk pooler / migrate.

---

## 6. Aturan bisnis kritis (jangan diubah sembarangan)

### Absensi / portal

1. **Check-in** hanya dalam jendela `CHECKIN_START`–`CHECKIN_END` (default 07–09 WIB), hari kerja, **hari ini saja**.
2. Satu baris absensi per peserta per tanggal.
3. Portal boleh ajukan **Izin/Sakit** → `izinStatus=PENDING` → blok check-in sampai diproses.
4. Staff approve → kehadiran = jenis; reject → kehadiran **Alpa**.
5. **Auto-checkout**: setelah `CHECKOUT_AUTO_AT` (17:00), Hadir tanpa `jamKeluar` diisi otomatis. Dipicu juga saat list absensi dengan filter `tanggal` exact.

### Logbook

- Portal: 1 entri/hari; hanya hari **Hadir** (ada jamMasuk); tidak boleh future; tidak boleh di hari Izin/Sakit/Alpa/pending.
- Staff CRUD lebih longgar tapi unique constraint tetap berlaku.

### Notifikasi staff (computed + dismiss FE)

`GET /notifications/summary` **bukan inbox pesan** — hitung live:

- `belumAbsen` — peserta AKTIF tanpa absensi hari ini
- `pendingIzin` — izin PENDING
- `endingSoon` — `tanggalSelesai` dalam ~30 hari (termasuk yang sudah lewat)

**Anti-tumpuk badge (FE, localStorage per userId):**

- Hook: `hooks/use-notif-seen.ts` — key `simagang:notif-seen:{userId}`.
- Klik item → tandai dilihat → hilang dari daftar & badge.
- Tombol **Tandai semua dilihat**.
- Aturan key:
  - `pendingIzin` → `absensiId` (sampai entri hilang dari API / dibuka lagi hanya jika id baru)
  - `belumAbsen` → `{pesertaId}:{today}` (otomatis kadaluarsa keesokan hari)
  - `endingSoon` → `{pesertaId}:{tanggalSelesai}` (muncul lagi jika periode berubah)

Tidak ada tabel dismiss di DB — hanya browser lokal.

### Edit profil (self-service terbatas)

| Actor | Endpoint | Boleh ubah | Tidak boleh |
|-------|----------|------------|-------------|
| Staff (Admin/Pembimbing) | `PUT /users/me` | `fullName`, `phoneNumber`, password opsional (+ `currentPassword`) | email, role, divisi |
| Peserta portal | `PUT /portal/me` | `name`, `phoneNumber`, password opsional | email, divisi, status, NIM, periode |

- Password lama wajib hanya jika mengisi password baru.
- FE: dialog **Edit Profil** (header avatar staff; ikon edit portal). Session cookie user/peserta di-refresh tanpa re-login (`updateSessionUser` / `updatePortalPeserta`).
- Endpoint lama `POST .../change-password` masih ada (kompatibel).

---

## 7. Frontend — peta folder & pola

```
ims-bapeda-backoffice/src/
  app/
    (auth)/login/              # login unified (+ await setSession)
    (protected)/               # shell sidebar + header
      _components/app-sidebar.tsx   # gradient, grup Operasional/Administrasi, footer user
      _components/app-header.tsx    # Edit Profil + notif bell
      _components/notification-bell.tsx
      _components/partials/dialog-edit-profile.tsx
      absensi/                 # tab Hari Ini | Riwayat; chip ringkasan; export CSV
      peserta-magang/[id]/cetak  # laporan A4
      dashboard/, logbook/, penilaian/, dokumen/, manajemen-*
    portal/                    # UI peserta + edit-profile-dialog
  components/
    page-header.tsx
    list-toolbar.tsx           # search+filters grid; slot `extras` (export dates)
    list-filters.tsx
    …
  hooks/use-query-builder.tsx
  hooks/use-notif-seen.ts      # dismiss notifikasi (localStorage)
  hooks/use-mobile.ts
  styles/globals.css           # sidebar tokens; @media print @page size A4
  utils/session.ts, portal-session.ts
```

### Pola halaman list

1. `PageHeader` dengan tombol **Tambah** di `actions` (bukan di toolbar).
2. `ListToolbar` + `ListFilters` (`display: contents`) + opsional `extras` (mis. Export CSV).
3. `useQueryBuilder` → `setFilter` / `filters` di URL.

### Absensi UI (terbaru)

- Tab **Hari Ini / Riwayat** di PageHeader (full width mobile).
- Hari Ini: satu bar tanggal + chip ringkasan **Hadir | Sakit/Izin | Alpa | Belum** (chip “Menunggu” dihapus; pending masuk hitungan Sakit/Izin).
- Riwayat: search/filter grid; baris kedua date range + Export CSV (tanpa kotak dashed); Tambah Absensi di PageHeader.

### Laporan cetak

- Preview `max-w-[210mm]`.
- Print CSS: `@page { size: A4; margin: 18mm 16mm; }` + hide chrome via `[data-print-area]`.

### Login unified

1. Coba staff login → hanya **401** lalu portal.
2. Staff → `/dashboard`; peserta → `/portal`.
3. **Jangan** kembalikan tab Staff/Peserta.

### Notifikasi UI

- Desktop: DropdownMenu; mobile: Sheet bottom.
- Badge = jumlah item **belum dilihat** (setelah filter `useNotifSeen`), bukan raw count API saja.

### Toast error (jangan spam saat navigasi)

- Global `QueryCache.onError` di `components/providers.tsx` men-toast gagal GET.
- Saat pindah menu, banyak query paralel (tabel + opsi filter + notif) → dulu bisa **bertumpuk**.
- Mitigasi:
  1. Semua toast query pakai `id: "simagang-query-error"` (Sonner mengganti, bukan menumpuk).
  2. Query opsi/filter/notif/detail profil: `meta: { silent: true }`.
  3. Abort/cancel saat ganti route tidak di-toast.
- Kalau masih muncul **satu** toast, biasanya API/DB benar-benar error (`GET /health` → `db`).

---

## 8. Preferensi desain / UX (dari user — patuhi)

- **Jangan** stripe aksen kiri pada card.
- **Jangan** tema ungu / gradient “AI slop”.
- Palet teal/navy; sidebar gradient gelap `#0f445c` → `#0a3246`.
- Font: Inter body, Poppins display (`font-display`).
- Badge status seragam (`StatusBadge`).
- Tombol **Tambah** di `PageHeader.actions`.
- Mobile: notifikasi bottom sheet; filter responsif; hindari `justify-between` yang meninggalkan lubang kosong di tengah desktop.
- Portal: enterprise, responsif; check-in window UX jelas saat disabled.

---

## 9. Changelog sesi 15 Sep 2026 (ringkas)

### Sudah di-push (inti)

**Backend**

- List filters absensi/peserta/logbook/penilaian/dokumen.
- Validasi tanggal selesai ≥ mulai (peserta).
- Login: error DB/JWT → 503 jelas.
- Docs Supabase + `directUrl`.
- **Edit profil:** `PUT /users/me`, `PUT /portal/me` (+ tes service).

**Frontend**

- Filter list + toolbar; Tambah ke PageHeader; notifikasi mobile.
- Login: await session; skip `getSession` pada request login.
- Absensi: chip ringkasan, layout desktop, export inline, sidebar polish, print A4.
- **Edit Profil** dialog staff + portal.
- **Notifikasi sudah dilihat** (`use-notif-seen`) + **dedupe/silent toast** saat pindah menu.

---

## 10. Checklist sebelum mengubah fitur

1. Staff atau portal? Cookie & API client mana?
2. Perlu `pembimbingScope`?
3. Filter list: pakai `filters` JSON.
4. Unique absensi/logbook per hari — tangani race/409.
5. Jangan pecah jendela check-in WIB / auto-checkout tanpa sadar.
6. UI list: PageHeader actions + ListToolbar (+ `extras` bila perlu).
7. Notifikasi: ingat dismiss FE vs data live API.
8. Edit profil: jangan izinkan self-edit email/role/divisi tanpa keputusan produk.
9. Setelah edit: FE `pnpm`/tsc; BE `npm test`.
10. **Jangan commit/push** kecuali user meminta eksplisit.

---

## 11. Endpoint cheatsheet cepat

| Kebutuhan | Method | Path |
|-----------|--------|------|
| Login staff | POST | `/login` |
| Login portal | POST | `/portal/login` |
| Edit profil staff | PUT | `/users/me` |
| Ganti password staff | POST | `/users/change-password` |
| Profil portal | GET | `/portal/me` |
| Edit profil portal | PUT | `/portal/me` |
| Ganti password portal | POST | `/portal/change-password` |
| List peserta / absensi | GET/POST | `/peserta-magang`, `/absensi` + filters |
| Approve/reject izin | POST | `/absensi/:id/approve-izin` / `reject-izin` |
| Notif summary | GET | `/notifications/summary` |
| Portal check-in / izin | POST | `/portal/absensi/check-in`, `/portal/absensi/izin` |
| Health | GET | `/health` (`db`, `frontendUrl`, …) |

---

## 12. Dokumen lain di repo

- `ims-bapeda-backend/README.md` — setup + hak akses + soft-launch ops.
- `ims-bapeda-backend/docs/UAT.md` — checklist UAT.
- `ims-bapeda-backend/docs/SUPABASE-SETUP.md` — pooler DB (bukan Auth).
- `ims-bapeda-backoffice/README.md` — setup FE + Storage dokumen.
- `ims-bapeda-backoffice/docs/SUPABASE-SETUP.md` — mirror FE.
- Salinan handoff: `docs/PROJECT-CONTEXT.md` di root workspace **dan** di tiap repo `docs/`.

---

## 13. Instruksi singkat untuk model sesi berikutnya

Kamu sedang mengerjakan **SIMAGANG Bapeda**: Express+Prisma API + Next.js backoffice/portal.

- Baca bagian 0–8 sebelum coding.
- Prefer pola yang ada (`PageHeader`, `ListToolbar`, `useQueryBuilder`, `pembimbingScope`, Edit Profil, notif seen).
- Hormati preferensi desain (bagian 8).
- Supabase = **DB + Storage saja**, bukan Auth.
- Jika user bilang “push”, commit **terpisah per repo**, pesan fokus *why*, lalu `git push`.
- Kredensial uji di bagian 1; jangan hardcode secret production.
- Cek `git status` FE untuk sisa kerja notifikasi dismiss yang belum push.

**Workspace root:** `d:\DATATA\KKP FADLUL`
