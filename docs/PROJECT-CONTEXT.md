# SIMAGANG Bapeda — Project Context & Session Handoff

> **BACA DOKUMEN INI DULU** sebelum mengubah kode apa pun.
> Dokumen ini adalah handoff kondisi sistem **saat ini** untuk AI/developer sesi berikutnya.
> Terakhir diperbarui: **15 September 2026 ~15:45 WIB** (dashboard chip 1 baris; absensi roster; laporan A4; edit profil; notif seen; toast dedupe; Prisma pooler harden).

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

- **Staff** (Admin / Pembimbing) → `/login` → `/dashboard`, dll.
- **Peserta magang** → login yang sama `/login` (fallback portal) → `/portal`.
- DB: **PostgreSQL** via Supabase pooler. ORM: **Prisma** (`DATABASE_URL` + `DIRECT_URL`).
- Auth: **Express JWT sendiri** — **bukan** Supabase Auth / `@supabase/ssr`.
- Branch: `main` (kedua repo).

### Status git (saat dokumen ini ditulis)

Kedua repo **bersih** dan selaras `origin/main` (`git status` tanpa dirty).

| Repo | HEAD (contoh) | Catatan |
|------|---------------|---------|
| Backend | `89c4d1d` | Prisma singleton shrink + auth DB-fail helper |
| Frontend | `eec0d73` | Dashboard attendance chips satu baris |

```bash
cd "d:\DATATA\KKP FADLUL\ims-bapeda-backend"; git status -sb; git log -5 --oneline
cd "d:\DATATA\KKP FADLUL\ims-bapeda-backoffice"; git status -sb; git log -5 --oneline
```

---

## 1. Akun uji (setelah seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@bapeda.go.id` | `admin123` |
| Pembimbing | `bimbing@bapeda.go.id` | `bimbing123` |
| Peserta (seed tipikal) | `andi@student.ac.id` | `peserta123` |

Check-in portal hanya **07:00–09:00 WIB** pada hari kerja (Sen–Jum, bukan libur nasional Indonesia / cuti bersama).

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
npm test
```

Env inti: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` (≥32), `PORT=3001`, `FRONTEND_URL`, `APP_TIMEZONE=Asia/Jakarta`, `CHECKIN_START=07:00`, `CHECKIN_END=09:00`, `CHECKOUT_AUTO_AT=17:00`.

Ops: `npm run ops:health`, `npm run uat:smoke`, `npm run db:verify`. Detail pooler: `docs/SUPABASE-SETUP.md`.

### Frontend

```bash
cd "d:\DATATA\KKP FADLUL\ims-bapeda-backoffice"
pnpm install
# salin .env.example → .env.local
pnpm dev             # http://localhost:3000
pnpm test
```

Env: `NEXT_PUBLIC_FE_URL`, `NEXT_PUBLIC_BE_URL`. Opsional Storage: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET=dokumen` (private).

---

## 3. Arsitektur besar

```
Browser
  ├─ /login (unified) ──► POST /login (staff) ──401──► POST /portal/login
  ├─ Staff cookie: token-session, user-session ──► Axios api.ts Bearer ──► Express
  └─ Portal cookie: portal-token-session, portal-peserta-session ──► portalApi ──► /portal/*
                                                      │
                                                      ▼
                                              Prisma → PostgreSQL (Supabase pooler)
```

- **Tidak ada `middleware.ts` Next.js.** Guard di layout `(protected)` / `portal` + interceptor 401.
- JWT staff: `typ: "user"`. JWT portal: `typ: "peserta"`. Secret sama.
- Role dari DB tiap request (`req.role`), bukan klaim JWT.
- Login FE: **`await setSession()` / portal session sebelum redirect**.
- `error.tsx`: auto-reload sekali untuk ChunkLoadError (deploy Vercel lama).

### Scoping Pembimbing

- `pembimbingScope(req)` — Admin = semua; selain itu = `pembimbingLapanganId = userId`.
- Di luar scope → **404** (anti-enumeration).
- Roles seed: Admin, Pembimbing, User. Ops: `STAFF_OPS_ROLES = ["Admin","Pembimbing"]`.

---

## 4. Backend — peta & mount

```
ims-bapeda-backend/src/
  index.ts, middleware/auth.ts, middleware/authPeserta.ts
  lib/pagination, datetime, autoCheckout, response, serviceResult, validate, prisma
  routes/<domain>/ index + controller + service (+ repository, *.test.ts)
```

| Prefix | Modul |
|--------|--------|
| `/login`, `/verify-token` | auth |
| `/users` | CRUD Admin + `PUT /me` + `POST /change-password` |
| `/divisi`, `/roles`, `/instansi` | master |
| `/peserta-magang` | peserta (+ working-day counts di detail untuk laporan) |
| `/absensi` | absensi + approve/reject izin |
| `/logbook` | tabel DB masih `Jurnal` |
| `/penilaian`, `/dokumen` | |
| `/notifications` | summary computed (tanpa tabel inbox) |
| `/portal` | portal + `GET/PUT /me` + change-password |
| `/health` | status API + `db` + `frontendUrl` |

### Pagination / filter

`parsePagination`: `searchFilters` (teks) + `filters` (domain JSON).

Absensi: `tanggal`, `dariTanggal`, `sampaiTanggal`, `pesertaMagangId`, `izinStatus`, `kehadiran`, `divisiId`, `instansiId`, `pembimbingLapanganId`.

Peserta: `divisiId`, `instansiId`, `pembimbingLapanganId`, `status`.

Logbook / penilaian / dokumen: filter via relasi `pesertaMagang`.

---

## 5. Prisma (inti)

| Model | Catatan |
|-------|---------|
| User | Staff; pembimbingLapangan |
| Role, Divisi, Instansi | Master |
| PesertaMagang | password portal terpisah; AKTIF/SELESAI/BERHENTI |
| Absensi | unique peserta+tanggal; Kehadiran; IzinStatus |
| Logbook | map `Jurnal` |
| Penilaian, Dokumen | |

`datasource`: `url` + `directUrl`. Production: pooler **6543** + `?pgbouncer=true`; migrate lewat **5432**. Prisma diharden untuk blip pooler Vercel (bukan opaque 500 mentah).

---

## 6. Aturan bisnis kritis

### Absensi / portal

1. Check-in hanya `CHECKIN_START`–`CHECKIN_END`, hari kerja, hari ini.
2. Satu baris absensi per peserta per tanggal.
3. Portal Izin/Sakit → `PENDING` → blok check-in sampai diproses.
4. Approve → kehadiran = jenis; reject → **Alpa**.
5. Auto-checkout setelah `CHECKOUT_AUTO_AT` untuk Hadir tanpa jamKeluar.

### Logbook

Portal: 1/hari; hanya hari Hadir (ada jamMasuk); tidak future; tidak di Izin/Sakit/Alpa/pending.

### Laporan kehadiran (%)

Dasar % = **hari kerja periode** (Sen–Jum minus libur nasional), bukan kalender kasar. Backend expose `totalHariKerja` / `hariKerjaPeriode` di detail peserta.

### Notifikasi staff (computed + dismiss FE)

`GET /notifications/summary`: `belumAbsen`, `pendingIzin`, `endingSoon` (~30 hari).

Dismiss FE (`hooks/use-notif-seen.ts`, localStorage `simagang:notif-seen:{userId}`):

- Klik item / **Tandai semua dilihat** → hilang dari badge.
- `pendingIzin` = absensiId; `belumAbsen` = `{id}:{today}`; `endingSoon` = `{id}:{tanggalSelesai}`.
- Tidak ada tabel dismiss di DB.

### Edit profil (self-service)

| Actor | Endpoint | Boleh | Tidak |
|-------|----------|-------|-------|
| Staff | `PUT /users/me` | fullName, phone, password opsional | email, role, divisi |
| Portal | `PUT /portal/me` | name, phone, password opsional | email, divisi, status, NIM, periode |

Session di-refresh via `updateSessionUser` / `updatePortalPeserta`. `POST .../change-password` masih ada.

---

## 7. Frontend — kondisi UI terkini

```
app/(auth)/login/          # unified + await setSession
app/(protected)/
  _components/app-sidebar.tsx      # gradient; Operasional / Administrasi; footer user
  _components/app-header.tsx       # Edit Profil + NotificationBell
  _components/notification-bell.tsx
  _components/partials/dialog-edit-profile.tsx
  dashboard/                       # AttendanceSummary + table + MiniStats + EndingSoon + CTA
  absensi/                         # Hari Ini (roster) | Riwayat
  peserta-magang/[id]/cetak        # laporan A4
  logbook/, penilaian/, dokumen/, manajemen-*
app/portal/                        # + edit-profile-dialog
components/page-header, list-toolbar (extras), list-filters
hooks/use-query-builder, use-notif-seen, use-mobile
styles/globals.css                 # @page size A4; sidebar tokens
```

### Dashboard

- `AttendanceSummary`: progress bar + chip **Aktif | Hadir | Sakit/Izin | Alpa** dalam **`grid-cols-4` satu baris** (termasuk mobile).
- Kolom utama: tabel absensi hari ini; samping: MiniStats, EndingSoon, CtaBanner.
- Data lewat `use-dashboard-data.ts` (shared query keys).

### Absensi

- Tab Hari Ini / Riwayat di PageHeader.
- **Hari Ini**: bar tanggal + chip **Hadir | Sakit/Izin | Alpa | Belum** (tanpa chip Menunggu; pending dihitung di Sakit/Izin); roster list per divisi (`roster-item.tsx`).
- **Riwayat**: ListToolbar + filters; `extras` = date range + Export CSV; Tambah di PageHeader.

### List pages (pola standar)

1. `PageHeader.actions` = tombol Tambah.
2. `ListToolbar` + `ListFilters` (`contents`) + opsional `extras`.
3. `useQueryBuilder` → URL `filters` / `setFilter`.

### Laporan cetak

- Preview lebar A4 (`max-w-[210mm]` / full print width).
- `@page { size: A4; margin: 18mm 16mm; }`.
- Letterhead + % kehadiran berbasis hari kerja.

### Mobile

- Notifikasi: Sheet bottom.
- Tanggal input label hh/bb/tttt di mobile.
- Overflow / portal card stacking sudah diperbaiki (commit `7ddd6f7` dll.).

### Toast / error navigasi

- `providers.tsx`: toast query satu `id` (`simagang-query-error`).
- Opsi filter / notif / detail profil: `meta: { silent: true }`.
- Abort/cancel tidak di-toast.
- Satu toast tersisa biasanya = API/DB benar error → cek `/health`.

### Login

1. Staff dulu; hanya 401 → portal.
2. Jangan kembalikan tab Staff/Peserta.

---

## 8. Preferensi desain (patuhi)

- Jangan stripe kiri card; jangan ungu / AI-slop gradient.
- Teal/navy; sidebar `#0f445c` → `#0a3246`.
- Inter + Poppins (`font-display`).
- StatusBadge seragam; Tambah di PageHeader.
- Hindari `justify-between` yang meninggalkan lubang kosong di tengah desktop.
- Chip statistik prefer **satu baris** jika muat (dashboard sudah `grid-cols-4`).

---

## 9. Changelog terbaru (15 Sep 2026) — sudah di-push

### Backend (urutan kasar, baru → lama)

| Commit | Isi |
|--------|-----|
| `89c4d1d` | Shrink Prisma singleton + share auth DB-fail helper |
| `4bc692a` | Harden Prisma untuk blip pooler Vercel |
| `60bab4b` | Working-day counts di detail peserta (laporan %) |
| `14968c0` | Refresh PROJECT-CONTEXT |
| `2dbfa1f` | `PUT /users/me`, `PUT /portal/me` |
| `6821b94` | Supabase docs + `directUrl` |
| `6a4aa89` | Login 503 jelas saat DB/JWT down |
| `928edab` | List filters divisi/instansi/kehadiran/pembimbing |

### Frontend

| Commit | Isi |
|--------|-----|
| `eec0d73` | Dashboard attendance chips **satu baris** |
| `227010d` | Dashboard attendance: fokus summary bar |
| `88d9ab9` | Absensi Hari Ini → roster list |
| `57772d0` | Polish card Absensi Hari Ini di dashboard (lalu disederhanakan) |
| `c38756b` / `057c2bd` | Ponytail cuts (lodash dll.) + fix UTF-8 |
| `726a5bd` / `7ddd6f7` | Mobile date fields + overflow/portal |
| `2a57e1b` / `94326dc` | Laporan % hari kerja + print A4 full width |
| `a73f228` | Notif sudah dilihat + dedupe toast |
| `281db6d` | Dialog Edit Profil |
| `dd66d80` dll. | Absensi layout, sidebar, A4 `@page`, filter/toolbar |

---

## 10. Checklist sebelum ubah fitur

1. Staff atau portal? Cookie & client mana?
2. Perlu `pembimbingScope`?
3. Filter list: `filters` JSON via `useQueryBuilder`.
4. Unique absensi/logbook per hari — race/409.
5. Jangan pecah check-in WIB / auto-checkout tanpa sadar.
6. UI: PageHeader + ListToolbar (+ extras).
7. Notif: dismiss FE ≠ hilangnya masalah di DB.
8. Edit profil: jangan buka email/role/divisi self-serve tanpa keputusan produk.
9. Laporan %: pakai hari kerja, bukan kalender kasar.
10. Test: BE `npm test`; FE `pnpm test` / cek lint.
11. **Commit/push hanya jika user minta** — terpisah per repo.

---

## 11. Endpoint cheatsheet

| Kebutuhan | Method | Path |
|-----------|--------|------|
| Login staff / portal | POST | `/login`, `/portal/login` |
| Edit profil | PUT | `/users/me`, `/portal/me` |
| Password | POST | `/users/change-password`, `/portal/change-password` |
| List + filters | GET/POST | `/peserta-magang`, `/absensi`, … |
| Izin approve/reject | POST | `/absensi/:id/approve-izin`, `reject-izin` |
| Notif | GET | `/notifications/summary` |
| Portal check-in / izin | POST | `/portal/absensi/check-in`, `/izin` |
| Health | GET | `/health` |

---

## 12. Dokumen terkait

- `ims-bapeda-backend/README.md`, `docs/UAT.md`, `docs/SUPABASE-SETUP.md`
- `ims-bapeda-backoffice/README.md`, `docs/SUPABASE-SETUP.md`
- Salinan handoff ini:  
  - `d:\DATATA\KKP FADLUL\docs\PROJECT-CONTEXT.md`  
  - `ims-bapeda-backend/docs/PROJECT-CONTEXT.md`  
  - `ims-bapeda-backoffice/docs/PROJECT-CONTEXT.md`  

Jaga ketiga salinan **sinkron** saat update handoff.

---

## 13. Instruksi untuk model sesi berikutnya

- Baca bagian 0–8 dulu.
- Prefer pola existing (`PageHeader`, `ListToolbar`, `useQueryBuilder`, `pembimbingScope`, Edit Profil, notif seen, silent query meta).
- Supabase = **DB + Storage saja**.
- Push: commit terpisah backend vs frontend; pesan fokus *why*.
- Kredensial uji di bagian 1; jangan hardcode secret production.
- Kondisi baseline: kedua `main` bersih di HEAD di atas; mulai dari situ.

**Workspace root:** `d:\DATATA\KKP FADLUL`
