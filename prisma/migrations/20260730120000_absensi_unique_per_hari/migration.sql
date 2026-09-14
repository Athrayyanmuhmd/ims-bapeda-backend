-- One absensi row per peserta per hari.
--
-- JALANKAN DEDUPE DI BAWAH DULU kalau database sudah punya baris duplikat —
-- CREATE UNIQUE INDEX akan gagal (dan migrasi ikut gagal) selama masih ada
-- pasangan (pesertaMagangId, tanggal) yang kembar.
--
-- Cek dulu ada duplikat atau tidak:
--
--   SELECT "pesertaMagangId", "tanggal", COUNT(*)
--   FROM "Absensi"
--   GROUP BY "pesertaMagangId", "tanggal"
--   HAVING COUNT(*) > 1;
--
-- Kalau ada, simpan baris yang paling akhir diupdate lalu hapus sisanya:
--
--   DELETE FROM "Absensi" a
--   USING "Absensi" b
--   WHERE a."pesertaMagangId" = b."pesertaMagangId"
--     AND a."tanggal"         = b."tanggal"
--     AND (a."updatedAt" < b."updatedAt"
--          OR (a."updatedAt" = b."updatedAt" AND a."id" < b."id"));

CREATE UNIQUE INDEX "Absensi_pesertaMagangId_tanggal_key"
  ON "Absensi"("pesertaMagangId", "tanggal");
