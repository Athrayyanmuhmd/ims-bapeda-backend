-- Portal login untuk peserta magang.
--
-- Nullable dan tanpa default: peserta yang sudah ada tetap tidak bisa login
-- sampai akunnya diaktifkan (password diisi oleh Admin/Pembimbing). Aman
-- dijalankan pada database yang sudah berisi data.

ALTER TABLE "PesertaMagang" ADD COLUMN "password" TEXT;
