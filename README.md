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
| bimbing@bapeda.go.id | bimbing123 | Admin |

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
| GET/POST | /absensi | ✅ | List absensi |
| GET | /absensi/:id | ✅ | Detail absensi |
| POST | /absensi/create | ✅ | Tambah absensi |
| PUT | /absensi/:id | ✅ | Update absensi |
| DELETE | /absensi/:id | ✅ | Hapus absensi |

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
