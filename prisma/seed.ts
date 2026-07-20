import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Roles
  const adminRole = await prisma.role.upsert({
    where: { id: "role-admin" },
    update: {},
    create: { id: "role-admin", name: "Admin", description: "Memiliki akses penuh ke semua fitur" },
  });

  await prisma.role.upsert({
    where: { id: "role-user" },
    update: {},
    create: { id: "role-user", name: "User", description: "Akses terbatas sesuai hak yang diberikan" },
  });

  const pembimbingRole = await prisma.role.upsert({
    where: { id: "role-pembimbing" },
    update: {},
    create: {
      id: "role-pembimbing",
      name: "Pembimbing",
      description: "Mengelola peserta magang dan absensi binaannya, tidak bisa kelola user/role/divisi",
    },
  });

  // Divisi
  const divisiIT = await prisma.divisi.upsert({
    where: { id: "divisi-it" },
    update: {},
    create: { id: "divisi-it", name: "IT", description: "Divisi Teknologi Informasi" },
  });

  await prisma.divisi.upsert({
    where: { id: "divisi-keuangan" },
    update: {},
    create: { id: "divisi-keuangan", name: "Keuangan", description: "Divisi Keuangan dan Anggaran" },
  });

  await prisma.divisi.upsert({
    where: { id: "divisi-perencanaan" },
    update: {},
    create: { id: "divisi-perencanaan", name: "Perencanaan", description: "Divisi Perencanaan Pembangunan Daerah" },
  });

  await prisma.divisi.upsert({
    where: { id: "divisi-umum" },
    update: {},
    create: { id: "divisi-umum", name: "Umum", description: "Divisi Umum dan Kepegawaian" },
  });

  // Instansi asal peserta magang
  const instansiSMK = await prisma.instansi.upsert({
    where: { id: "instansi-smk1" },
    update: {},
    create: {
      id: "instansi-smk1",
      nama: "SMK Negeri 1 Banda Aceh",
      jenis: "SMK",
      alamat: "Jl. Sekolah No. 1, Banda Aceh",
      namaPic: "Pak Rudi",
      noHpPic: "081200000001",
    },
  });

  const instansiUniv = await prisma.instansi.upsert({
    where: { id: "instansi-usk" },
    update: {},
    create: {
      id: "instansi-usk",
      nama: "Universitas Syiah Kuala",
      jenis: "Universitas",
      alamat: "Jl. Teuku Nyak Arief, Banda Aceh",
      namaPic: "Bu Sari",
      noHpPic: "081200000002",
    },
  });

  // Admin user
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@bapeda.go.id" },
    update: {},
    create: {
      fullName: "Administrator",
      email: "admin@bapeda.go.id",
      password: adminPassword,
      phoneNumber: "081234567890",
      status: "active",
      divisiId: divisiIT.id,
      roleId: adminRole.id,
    },
  });

  // Pembimbing lapangan
  const pembimbingPassword = await bcrypt.hash("bimbing123", 10);
  const pembimbing = await prisma.user.upsert({
    where: { email: "bimbing@bapeda.go.id" },
    update: { roleId: pembimbingRole.id },
    create: {
      fullName: "Budi Santoso",
      email: "bimbing@bapeda.go.id",
      password: pembimbingPassword,
      phoneNumber: "087654321098",
      status: "active",
      divisiId: divisiIT.id,
      roleId: pembimbingRole.id,
    },
  });

  // Peserta magang
  const peserta1Data = {
    nim: "2108107010001",
    divisiId: divisiIT.id,
    instansiId: instansiUniv.id,
    pembimbingLapanganId: pembimbing.id,
    tanggalMulai: new Date("2026-07-01"),
    tanggalSelesai: new Date("2026-09-30"),
    status: "AKTIF" as const,
  };

  const peserta1 = await prisma.pesertaMagang.upsert({
    where: { id: "peserta-1" },
    update: peserta1Data,
    create: {
      id: "peserta-1",
      name: "Andi Pratama",
      email: "andi@student.ac.id",
      phoneNumber: "081111111111",
      ...peserta1Data,
    },
  });

  const peserta2Data = {
    nim: "2115",
    divisiId: divisiIT.id,
    instansiId: instansiSMK.id,
    pembimbingLapanganId: pembimbing.id,
    tanggalMulai: new Date("2026-07-01"),
    tanggalSelesai: new Date("2026-08-31"),
    status: "AKTIF" as const,
  };

  const peserta2 = await prisma.pesertaMagang.upsert({
    where: { id: "peserta-2" },
    update: peserta2Data,
    create: {
      id: "peserta-2",
      name: "Sari Dewi",
      email: "sari@student.ac.id",
      phoneNumber: "082222222222",
      ...peserta2Data,
    },
  });

  // Absensi contoh
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.absensi.upsert({
    where: { id: "absensi-1" },
    update: {},
    create: {
      id: "absensi-1",
      pesertaMagangId: peserta1.id,
      kehadiran: "Hadir",
      tanggal: today,
      jamMasuk: new Date(today.getTime() + 8 * 3600 * 1000),
      jamKeluar: new Date(today.getTime() + 17 * 3600 * 1000),
    },
  });

  await prisma.absensi.upsert({
    where: { id: "absensi-2" },
    update: {},
    create: {
      id: "absensi-2",
      pesertaMagangId: peserta2.id,
      kehadiran: "Hadir",
      tanggal: today,
      jamMasuk: new Date(today.getTime() + 8 * 3600 * 1000),
      jamKeluar: new Date(today.getTime() + 17 * 3600 * 1000),
    },
  });

  // Jurnal contoh
  await prisma.jurnal.upsert({
    where: { id: "jurnal-1" },
    update: {},
    create: {
      id: "jurnal-1",
      pesertaMagangId: peserta1.id,
      tanggal: today,
      kegiatan: "Mempelajari struktur database dan membantu setup environment development.",
    },
  });

  // Dokumen contoh
  await prisma.dokumen.upsert({
    where: { id: "dokumen-1" },
    update: {},
    create: {
      id: "dokumen-1",
      pesertaMagangId: peserta1.id,
      jenisDokumen: "SURAT_PENGANTAR",
      namaFile: "Surat Pengantar Andi Pratama.pdf",
      urlFile: "https://drive.google.com/contoh-surat-pengantar",
    },
  });

  console.log("✅ Seed selesai");
  console.log("📧 Admin     : admin@bapeda.go.id | password: admin123 | role: Admin");
  console.log("📧 Pembimbing: bimbing@bapeda.go.id | password: bimbing123 | role: Pembimbing");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
