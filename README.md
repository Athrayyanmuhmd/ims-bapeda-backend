# IMS Bapeda Backend

Backend REST API untuk sistem manajemen magang Bapeda.

## Tech Stack
- Node.js + TypeScript
- Express.js
- Prisma ORM
- PostgreSQL

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Konfigurasi environment
Edit file `.env`:
```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/ims_bapeda?schema=public"
JWT_SECRET="ganti-dengan-secret-yang-kuat"
PORT=3001
```

### 3. Buat database & migrate
```bash
npm run db:migrate
```

### 4. Seed data awal
```bash
npm run db:seed
```

### 5. Jalankan server
```bash
npm run dev
```

Server berjalan di `http://localhost:3001`

## Akun Default (setelah seed)
| Email | Password | Role |
|---|---|---|
| admin@bapeda.go.id | admin123 | Admin |
| bimbing@bapeda.go.id | bimbing123 | Pembimbing |

## Hak Akses

Role diambil dari database pada **setiap request**, bukan dari klaim di dalam JWT.
Konsekuensinya: menonaktifkan akun (`status != "active"`) atau mengganti role langsung
berlaku, tidak menunggu token 7 hari kedaluwarsa.

| Role | Akses |
|---|---|
| **Admin** | Semua data, plus manajemen user/role/divisi/instansi |
| **Pembimbing** | Hanya peserta magang yang ia bimbing (`pembimbingLapanganId`), beserta absensi, jurnal, penilaian, dan dokumen peserta tersebut |
| **Lainnya** | Tidak melihat data peserta (deny-by-default) |

Scoping berlaku di layer service untuk `peserta-magang`, `absensi`, `jurnal`,
`penilaian`, dan `dokumen` — baik saat list maupun saat detail/update/delete.
Record di luar scope dijawab **404 "tidak ditemukan"** (bukan 403) supaya
keberadaannya tidak bocor.

Aturan tambahan untuk non-Admin:
- Peserta yang ia buat otomatis memakai dirinya sebagai pembimbing lapangan.
- Tidak bisa memindahkan peserta ke pembimbing lain.

## API Endpoints

### Auth
| Method | URL | Auth | Keterangan |
|---|---|---|---|
| POST | /login | ❌ | Login |
| POST | /verify-token | ❌ | Verifikasi token |

### Users
| Method | URL | Auth | Keterangan |
|---|---|---|---|
| GET/POST | /users | ✅ | List semua user (pagination) |
| GET | /users/:id | ✅ | Detail user |
| POST | /users/create | ✅ | Buat user baru |
| PUT | /users/:id | ✅ | Update user |
| DELETE | /users/:id | ✅ | Hapus user |

### Divisi
| Method | URL | Auth | Keterangan |
|---|---|---|---|
| GET/POST | /divisi | ✅ | List divisi |
| GET | /divisi/:id | ✅ | Detail divisi |
| POST | /divisi/create | ✅ | Buat divisi |
| PUT | /divisi/:id | ✅ | Update divisi |
| DELETE | /divisi/:id | ✅ | Hapus divisi |

### Roles
| Method | URL | Auth | Keterangan |
|---|---|---|---|
| GET/POST | /roles | ✅ | List roles |
| GET | /roles/:id | ✅ | Detail role |
| POST | /roles/create | ✅ | Buat role |
| PUT | /roles/:id | ✅ | Update role |
| DELETE | /roles/:id | ✅ | Hapus role |

### Peserta Magang
| Method | URL | Auth | Keterangan |
|---|---|---|---|
| GET/POST | /peserta-magang | ✅ | List peserta |
| GET | /peserta-magang/:id | ✅ | Detail peserta |
| POST | /peserta-magang/create | ✅ | Tambah peserta |
| PUT | /peserta-magang/:id | ✅ | Update peserta |
| DELETE | /peserta-magang/:id | ✅ | Hapus peserta |

### Absensi
| Method | URL | Auth | Keterangan |
|---|---|---|---|
| GET/POST | /absensi | ✅ | List absensi (lihat filter di bawah) |
| GET | /absensi/:id | ✅ | Detail absensi |
| POST | /absensi/create | ✅ | Tambah absensi |
| PUT | /absensi/:id | ✅ | Update absensi |
| DELETE | /absensi/:id | ✅ | Hapus absensi |

Filter `/absensi` (dikirim lewat `filters` sebagai JSON):

| Filter | Contoh | Keterangan |
|---|---|---|
| `tanggal` | `2026-07-16` | Satu hari persis. Menang atas rentang di bawah |
| `dariTanggal` | `2026-07-01` | Awal rentang, opsional |
| `sampaiTanggal` | `2026-07-31` | Akhir rentang, opsional |
| `pesertaMagangId` | `peserta-1` | Batasi ke satu peserta |

Rentang dipakai oleh fitur **Export CSV rekap absensi** di backoffice.

## Format Response
```json
{
  "content": { ... },
  "message": "Success",
  "errors": null
}
```

Pagination:
```json
{
  "content": {
    "entries": [...],
    "totalData": 100,
    "totalPage": 10
  },
  "message": "Success",
  "errors": null
}
```
