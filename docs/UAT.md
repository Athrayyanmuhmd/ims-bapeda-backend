# Soft-launch UAT — SIMAGANG Bapeda

Gunakan akun seed (atau akun UAT khusus). Centang tiap baris; catat bug di kolom Catatan.

**API smoke (otomatis sebagian):** dari `ims-bapeda-backend` jalankan `npm run uat:smoke` (API harus hidup).

## A. Prasyarat production / staging

| # | Cek | OK? | Catatan |
|---|-----|-----|---------|
| A1 | `npm run db:migrate:status` → schema up to date | | |
| A2 | `npm run db:verify` → columns + Jurnal unique + enums | | |
| A3 | Vercel/env: `DATABASE_URL`, `JWT_SECRET` (≥32), `FRONTEND_URL` = URL FE production | | |
| A4 | Vercel/env: `APP_TIMEZONE=Asia/Jakarta`, `CHECKIN_START/END`, `CHECKOUT_AUTO_AT` | | |
| A5 | FE env: `NEXT_PUBLIC_BE_URL` = URL API production | | |
| A6 | `npm run ops:health` (atau UptimeRobot → `GET /health`) | | |
| A7 | Supabase: project tidak pause; backup/PITR aktif jika tersedia | | |

## B. Peserta portal

| # | Alur | OK? | Bug / Catatan |
|---|------|-----|---------------|
| B1 | Login tab Peserta (`/login?as=peserta`) | | |
| B2 | Check-in dalam jendela jam (Hadir + jamMasuk) | | |
| B3 | Check-in di luar jendela → ditolak jelas | | |
| B4 | Check-in kedua hari yang sama → ditolak | | |
| B5 | Check-out (atau auto 17:00 setelah cutoff) | | |
| B6 | Ajukan izin/sakit → status Menunggu | | |
| B7 | Tidak bisa check-in saat izin PENDING | | |
| B8 | Tulis logbook hari Hadir (1×/hari) | | |
| B9 | Backfill logbook tanggal lampau yang Hadir | | |
| B10 | Tolak logbook pada hari Izin/Sakit/Alpa | | |
| B11 | Kalender kehadiran — warna & detail hari | | |
| B12 | Progress masa magang tampil benar | | |

## C. Staff backoffice

| # | Alur | OK? | Bug / Catatan |
|---|------|-----|---------------|
| C1 | Login tab Staff | | |
| C2 | Lonceng notifikasi: izin pending / belum absen | | |
| C3 | Absensi hari ini — approve izin | | |
| C4 | Absensi hari ini — reject izin | | |
| C5 | Peserta yang di-reject bisa absen/izin ulang sesuai aturan | | |
| C6 | Menu Logbook (bukan Jurnal) list + filter | | |
| C7 | Scope Pembimbing: hanya peserta bimbingannya | | |
| C8 | Admin melihat semua | | |

## D. Regresi cepat

| # | Cek | OK? | Catatan |
|---|-----|-----|---------|
| D1 | CORS: FE production memanggil API tanpa error origin | | |
| D2 | Token staff tidak bisa akses `/portal/*` | | |
| D3 | Token peserta tidak bisa akses staff routes | | |
| D4 | Setelah soft launch: monitoring `/health` hijau | | |

## Bug log

| ID | Role | Langkah | Diharapkan | Aktual | Severity |
|----|------|---------|------------|--------|----------|
| | | | | | |
