# SIMAGANG Bapeda — Project Context & Session Handoff

> **BACA DOKUMEN INI DULU** sebelum mengubah kode apa pun.
> Dokumen ini ditulis agar model AI sesi berikutnya memahami **seluruh** sistem tanpa menebak-nebak.
> Terakhir diperbarui: **15 September 2026** (sesi filter list, notifikasi mobile, UI toolbar, validasi peserta).

---

## 0. Ringkasan satu menit

Sistem manajemen magang **Bapeda** (SIMAGANG):

| Repo | Path lokal | Remote GitHub | Port lokal |
|------|------------|---------------|------------|
| Backend API | `d:\DATATA\KKP FADLUL\ims-bapeda-backend` | `Athrayyanmuhmd/ims-bapeda-backend` | `:3001` |
| Backoffice FE | `d:\DATATA\KKP FADLUL\ims-bapeda-backoffice` | `Athrayyanmuhmd/ims-bapeda-backoffice` | `:3000` |

- **Staff** (Admin / Pembimbing) → backoffice `/login` → `/dashboard`, dll.
- **Peserta magang** → login yang sama `/login` (fallback portal) → `/portal`.
- DB: **PostgreSQL** (sering via Supabase). ORM: **Prisma**.
- Branch kerja biasanya `main`.

### Status push (penting)

Pada akhir sesi 15 Sep 2026, perubahan filter/UI/notifikasi **masih lokal, BELUM di-commit / BELUM di-push** di kedua repo. Cek dengan:

```bash
cd "d:\DATATA\KKP FADLUL\ims-bapeda-backend"; git status -sb
cd "d:\DATATA\KKP FADLUL\ims-bapeda-backoffice"; git status -sb
```

Jika `## main...origin/main` tanpa ahead/behind tapi ada `M` / `??` → ada perubahan lokal belum commit.

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

Env inti: `DATABASE_URL`, `JWT_SECRET` (≥32 char), `PORT=3001`, `FRONTEND_URL=http://localhost:3000`, `APP_TIMEZONE=Asia/Jakarta`, `CHECKIN_START=07:00`, `CHECKIN_END=09:00`, `CHECKOUT_AUTO_AT=17:00`.

### Frontend

```bash
cd "d:\DATATA\KKP FADLUL\ims-bapeda-backoffice"
pnpm install
# salin .env.example → .env.local
pnpm dev             # http://localhost:3000
pnpm test
```

Env inti: `NEXT_PUBLIC_FE_URL=http://localhost:3000`, `NEXT_PUBLIC_BE_URL=http://localhost:3001`.  
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
                                              Prisma → PostgreSQL
```

- **Tidak ada `middleware.ts` Next.js.** Guard di layout `(protected)` / `portal` + interceptor 401.
- JWT staff: `typ: "user"` (legacy boleh tanpa typ). JWT portal: `typ: "peserta"`. Secret sama (`JWT_SECRET`).
- Role **bukan** dari klaim JWT: setiap request staff, middleware reload user dari DB → `req.role` = nama Role.

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
| `/users` | users |
| `/divisi`, `/roles`, `/instansi` | master data |
| `/peserta-magang` | peserta |
| `/absensi` | absensi + izin approve/reject |
| `/logbook` | logbook (DB table masih `Jurnal`) |
| `/penilaian`, `/dokumen` | penilaian, dokumen |
| `/notifications` | summary computed (tanpa tabel) |
| `/portal` | peserta portal |

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

### Notifikasi staff

`GET /notifications/summary` (computed):

- `belumAbsen` — peserta AKTIF tanpa absensi hari ini
- `pendingIzin` — izin PENDING
- `endingSoon` — `tanggalSelesai` dalam ~30 hari (termasuk yang sudah lewat)

---

## 7. Frontend — peta folder & pola

```
ims-bapeda-backoffice/src/
  app/
    (auth)/login/              # login unified
    (protected)/               # shell sidebar + header
      _components/app-header.tsx
      _components/notification-bell.tsx
      dashboard/, peserta-magang/, absensi/, logbook/,
      penilaian/, dokumen/, manajemen-*
    portal/                    # UI peserta
  components/
    page-header.tsx            # judul + actions (Tombol Tambah di sini)
    list-toolbar.tsx           # search + filters grid + action opsional
    list-filters.tsx           # dropdown Divisi/Instansi/Kehadiran/Status/Pembimbing
    list-page-card.tsx
    status-badge.tsx
    data-table.tsx
    single-select.tsx
    ui/                        # shadcn
  hooks/use-query-builder.tsx  # sync URL ↔ API params
  hooks/use-mobile.ts          # breakpoint 768
  services/                    # axios wrappers + zod types
  stores/auth.tsx
  utils/api.ts                 # getParams JSON-stringify filters
  constants/query-keys.ts, navigation.ts, session.ts
```

### Pola halaman list (standar sesudah polish UI)

1. `page.tsx` tipis → `_components/table/index.tsx` (atau container).
2. `PageHeader` dengan `actions={<Button>Tambah …</Button>}` — **bukan** di dalam toolbar.
3. `ListToolbar` + `ListFilters` + `DataTable`.
4. `useQueryBuilder({ defaultSearchKeys: ["name"] })` → `params` ke React Query + service.
5. `ListFilters values={filters} onChange={setFilter} showKehadiran? showStatus?`.

### Layout toolbar (desktop)

Search dan filter berada di **satu CSS grid** (`ListToolbar`).  
`ListFilters` memakai `display: contents` agar setiap `SingleSelect` jadi cell grid yang sejajar dengan search (menghindari ruang kosong di kanan search).

### useQueryBuilder — API penting

- URL keys: `page`, `rows`, `searchFilters` (JSON), `filters` (JSON), `orderKey`, `orderRule`.
- `setFilter(key, value | null)` — null menghapus key; reset page ke 1.
- `setSearch(value)` mengisi semua `defaultSearchKeys`.

### Login unified

File: `src/app/(auth)/login/_components/login-form.tsx`

1. Coba staff login.
2. Hanya jika **401**, coba portal login.
3. Staff → `/dashboard`; peserta → `/portal`.
4. **Jangan** kembalikan tab Staff/Peserta (sudah dihapus atas permintaan user).

### Notifikasi UI

`notification-bell.tsx`:

- Desktop: DropdownMenu.
- Mobile (`useIsMobile`): Sheet bottom rounded.
- Warna urgency: lewat deadline merah; hampir habis oranye; belum absen amber.

---

## 8. Preferensi desain / UX (dari user — patuhi)

- **Jangan** stripe aksen kiri pada card.
- **Jangan** tema ungu / gradient “AI slop”.
- Palet teal/navy: primary sekitar `#175e86`, border `#E2E8EA`, bg area konten `#F4F7F8`.
- Font: Inter body, Poppins display (`font-display`).
- Badge status: lebar/min-height seragam (`StatusBadge`).
- Tombol **Tambah** di `PageHeader.actions`, bukan di antara search & filter.
- Mobile: notifikasi harus nyaman (bottom sheet), filter wrap/grid responsif.
- Portal: enterprise, responsif; check-in window UX jelas saat disabled.

---

## 9. Yang dikerjakan di sesi 15 Sep 2026 (belum tentu sudah push)

### Backend (local dirty)

- Absensi list: filter `kehadiran`, `divisiId`, `instansiId`, `pembimbingLapanganId` + where pakai `AND`.
- Peserta list: filter `divisiId`, `instansiId`, `pembimbingLapanganId`, `status`.
- Logbook / penilaian / dokumen list: filter relasi peserta yang sama.
- Validasi tanggal selesai ≥ tanggal mulai (controller peserta).
- Tes absensi/peserta disesuaikan bentuk `AND`.

### Frontend (local dirty)

- `useQueryBuilder`: baca/tulis `filters`, method `setFilter`.
- Komponen baru: `list-filters.tsx`, `notification-bell.tsx`.
- `list-toolbar.tsx`: grid search+filters; action opsional di kanan.
- Wire filter di: Absensi (riwayat + hari ini), Peserta, Logbook, Penilaian, Dokumen.
- Tombol Tambah dipindah ke PageHeader (semua halaman list utama + manajemen).
- Validasi Zod peserta: enum status + refine rentang tanggal.
- Notifikasi mobile bottom sheet + UI item lebih kaya.

File FE yang biasanya dirty setelah sesi ini (cek `git status`):

- `src/components/list-toolbar.tsx`, `list-filters.tsx` (baru)
- `src/hooks/use-query-builder.tsx` (+ test)
- `src/app/(protected)/_components/app-header.tsx`, `notification-bell.tsx` (baru)
- table index absensi/peserta/logbook/penilaian/dokumen/manajemen-*
- `absensi/_components/today/*`, `peserta-magang` form + types

---

## 10. Checklist sebelum mengubah fitur

1. Apakah ini staff atau portal? Cookie & API client mana?
2. Apakah perlu `pembimbingScope`? Admin vs Pembimbing?
3. Filter list: pakai `filters` JSON, bukan hardcode query baru.
4. Unique absensi/logbook per hari — tangani race/409.
5. Jangan pecah jendela check-in WIB / auto-checkout tanpa sadar.
6. UI list: PageHeader actions + ListToolbar grid + ListFilters contents.
7. Setelah edit FE: `pnpm`/tsc; BE: `npm test` untuk service terkait.
8. **Jangan commit/push** kecuali user meminta eksplisit.

---

## 11. Endpoint cheatsheet cepat

| Kebutuhan | Method | Path |
|-----------|--------|------|
| Login staff | POST | `/login` |
| Login portal | POST | `/portal/login` |
| List peserta | GET/POST | `/peserta-magang` + filters |
| List absensi | GET/POST | `/absensi` + filters |
| Pending izin | GET | `/absensi/izin/pending` |
| Approve/reject izin | POST | `/absensi/:id/approve-izin` / `reject-izin` |
| Notif summary | GET | `/notifications/summary` |
| Portal check-in | POST | `/portal/absensi/check-in` |
| Portal izin | POST | `/portal/absensi/izin` |
| Health | GET | `/health` |

---

## 12. Dokumen lain di repo

- `ims-bapeda-backend/README.md` — setup + hak akses.
- `ims-bapeda-backend/docs/UAT.md` — checklist UAT soft-launch.
- `ims-bapeda-backoffice/README.md` — setup FE + Supabase dokumen.

Dokumen **ini** (`docs/PROJECT-CONTEXT.md` di root workspace `KKP FADLUL`) adalah handoff lintas-repo untuk AI/developer sesi berikutnya.

---

## 13. Instruksi singkat untuk model sesi berikutnya

Kamu sedang mengerjakan **SIMAGANG Bapeda**: monorepo longgar berisi Express+Prisma backend dan Next.js backoffice+portal.

- Baca bagian 0–8 sebelum coding.
- Prefer ubah pola yang sudah ada (`PageHeader`, `ListToolbar`, `useQueryBuilder`, `pembimbingScope`) daripada invent arsitektur baru.
- Hormati preferensi desain user (bagian 8).
- Jika user bilang “push”, commit terpisah per repo (`ims-bapeda-backend` dan `ims-bapeda-backoffice`) dengan pesan fokus *why*, lalu `git push -u origin HEAD`.
- Kredensial uji ada di bagian 1; jangan hardcode secret production.

**Workspace root:** `d:\DATATA\KKP FADLUL`
