-- CreateEnum
CREATE TYPE "StatusMagang" AS ENUM ('AKTIF', 'SELESAI', 'BERHENTI');

-- CreateEnum
CREATE TYPE "JenisDokumen" AS ENUM ('SURAT_PENGANTAR', 'SURAT_BALASAN', 'SERTIFIKAT', 'LAPORAN', 'LAINNYA');

-- AlterTable
ALTER TABLE "PesertaMagang" ADD COLUMN     "instansiId" TEXT,
ADD COLUMN     "nim" TEXT,
ADD COLUMN     "status" "StatusMagang" NOT NULL DEFAULT 'AKTIF',
ADD COLUMN     "tanggalMulai" TIMESTAMP(3),
ADD COLUMN     "tanggalSelesai" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Instansi" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "alamat" TEXT,
    "kontakPic" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instansi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jurnal" (
    "id" TEXT NOT NULL,
    "pesertaMagangId" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "kegiatan" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jurnal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Penilaian" (
    "id" TEXT NOT NULL,
    "pesertaMagangId" TEXT NOT NULL,
    "penilaiId" TEXT NOT NULL,
    "nilai" INTEGER NOT NULL,
    "komentar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Penilaian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dokumen" (
    "id" TEXT NOT NULL,
    "pesertaMagangId" TEXT NOT NULL,
    "jenisDokumen" "JenisDokumen" NOT NULL,
    "namaFile" TEXT NOT NULL,
    "urlFile" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dokumen_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PesertaMagang" ADD CONSTRAINT "PesertaMagang_instansiId_fkey" FOREIGN KEY ("instansiId") REFERENCES "Instansi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jurnal" ADD CONSTRAINT "Jurnal_pesertaMagangId_fkey" FOREIGN KEY ("pesertaMagangId") REFERENCES "PesertaMagang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penilaian" ADD CONSTRAINT "Penilaian_pesertaMagangId_fkey" FOREIGN KEY ("pesertaMagangId") REFERENCES "PesertaMagang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penilaian" ADD CONSTRAINT "Penilaian_penilaiId_fkey" FOREIGN KEY ("penilaiId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dokumen" ADD CONSTRAINT "Dokumen_pesertaMagangId_fkey" FOREIGN KEY ("pesertaMagangId") REFERENCES "PesertaMagang"("id") ON DELETE CASCADE ON UPDATE CASCADE;
