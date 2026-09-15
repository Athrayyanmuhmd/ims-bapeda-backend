# Supabase untuk SIMAGANG — yang perlu & yang tidak

Project Supabase: `ims-bapeda` (`brgyaorhucichpxtswtb`)  
FE: https://simagang-bapeda.vercel.app  
API: https://simagang-bapeda-api.vercel.app

## Jangan ikuti wizard “Connect Next.js + Supabase Auth”

SIMAGANG **sudah punya login sendiri** (Express JWT + cookie backoffice/portal).  
Jangan install:

- `@supabase/ssr` / middleware session Supabase Auth
- `@supabase/server` + JWKS untuk verify user
- contoh `todos` page
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` untuk login

Itu akan bentrok dengan auth yang ada.

## Yang dipakai dari Supabase

### 1) PostgreSQL lewat Prisma (wajib)

Di Vercel project **simagang-bapeda-api**:

| Variable | Nilai |
|----------|--------|
| `DATABASE_URL` | Transaction pooler port **6543** + `?pgbouncer=true` |
| `DIRECT_URL` | Session pooler port **5432** (untuk `prisma migrate`) |
| `FRONTEND_URL` | `https://simagang-bapeda.vercel.app` |
| `JWT_SECRET` | ≥ 32 karakter |

Contoh (ganti `[PASSWORD]`, percent-encode karakter spesial):

```env
DATABASE_URL="postgresql://postgres.brgyaorhucichpxtswtb:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.brgyaorhucichpxtswtb:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
FRONTEND_URL="https://simagang-bapeda.vercel.app"
```

Setelah ubah env → **Redeploy** API.

Cek: https://simagang-bapeda-api.vercel.app/health → harus `"db": true`.

### 2) Storage dokumen (opsional)

Di Vercel project **simagang-bapeda** (FE):

```env
NEXT_PUBLIC_FE_URL=https://simagang-bapeda.vercel.app
NEXT_PUBLIC_BE_URL=https://simagang-bapeda-api.vercel.app
SUPABASE_URL=https://brgyaorhucichpxtswtb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role dari Project Settings → API>
SUPABASE_BUCKET=dokumen
```

Buat bucket **`dokumen`** di Storage, **Public = OFF**.

Tanpa Storage, app tetap jalan; upload file mati, link dokumen bisa diisi manual.

## Checklist cepat kalau login error

1. Buka `/health` API → `db` harus `true`
2. Supabase project tidak **Paused**
3. `FRONTEND_URL` API = origin FE (CORS)
4. `NEXT_PUBLIC_BE_URL` FE = URL API (tanpa path)
5. Jangan campur Supabase Auth wizard ke repo ini
