-- Formal Kehadiran enum + portal izin approval columns + one jurnal per day.

-- CreateEnum
CREATE TYPE "Kehadiran" AS ENUM ('Hadir', 'Sakit', 'Izin', 'Alpa');

-- CreateEnum
CREATE TYPE "IzinStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Normalize any unexpected kehadiran values before the cast.
UPDATE "Absensi"
SET "kehadiran" = 'Alpa'
WHERE "kehadiran" NOT IN ('Hadir', 'Sakit', 'Izin', 'Alpa');

-- AlterTable Absensi: kehadiran → enum + izin workflow columns
ALTER TABLE "Absensi"
  ALTER COLUMN "kehadiran" TYPE "Kehadiran"
  USING ("kehadiran"::"Kehadiran");

ALTER TABLE "Absensi"
  ADD COLUMN "izinStatus" "IzinStatus",
  ADD COLUMN "izinJenis" "Kehadiran",
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Absensi"
  ADD CONSTRAINT "Absensi_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- One jurnal row per peserta per hari.
-- Keep the newest row when duplicates exist so the unique index can be created.
DELETE FROM "Jurnal" a
USING "Jurnal" b
WHERE a."pesertaMagangId" = b."pesertaMagangId"
  AND a."tanggal"         = b."tanggal"
  AND (a."updatedAt" < b."updatedAt"
       OR (a."updatedAt" = b."updatedAt" AND a."id" < b."id"));

CREATE UNIQUE INDEX "Jurnal_pesertaMagangId_tanggal_key"
  ON "Jurnal"("pesertaMagangId", "tanggal");
