import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../../lib/prisma";
import { todayIsoDate } from "../../lib/datetime";
import * as portalService from "./service";

vi.mock("bcryptjs");
vi.mock("../../lib/prisma", () => ({
  default: {
    pesertaMagang: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    absensi: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    jurnal: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    penilaian: { findMany: vi.fn() },
    dokumen: { findMany: vi.fn() },
  },
  isUniqueViolation: () => false,
}));

vi.mock("../../lib/indonesiaHolidays", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/indonesiaHolidays")>();
  return {
    ...actual,
    loadIndonesiaHolidays: vi.fn(async () => new Set<string>()),
    isWorkingDay: vi.fn(() => true),
  };
});

process.env.JWT_SECRET = "test-secret";

const PESERTA = "peserta-1";

describe("portal login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses a peserta whose portal account was never activated", async () => {
    vi.mocked(prisma.pesertaMagang.findFirst).mockResolvedValue({
      id: PESERTA,
      password: null,
      status: "AKTIF",
    } as never);

    const result = await portalService.login("andi@student.ac.id", "whatever");

    expect(result).toEqual({ ok: false, message: "Email atau password salah", status: 401 });
  });

  // Unknown email and wrong password must be indistinguishable.
  it("gives the same error for an unknown email as for a wrong password", async () => {
    vi.mocked(prisma.pesertaMagang.findFirst).mockResolvedValue(null);
    const unknown = await portalService.login("nobody@student.ac.id", "whatever");

    vi.mocked(prisma.pesertaMagang.findFirst).mockResolvedValue({
      id: PESERTA,
      password: "hashed",
      status: "AKTIF",
    } as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    const wrongPassword = await portalService.login("andi@student.ac.id", "wrong");

    expect(unknown).toEqual(wrongPassword);
  });

  it("refuses a peserta whose magang has ended", async () => {
    vi.mocked(prisma.pesertaMagang.findFirst).mockResolvedValue({
      id: PESERTA,
      password: "hashed",
      status: "SELESAI",
    } as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = await portalService.login("andi@student.ac.id", "correct");

    expect(result.ok).toBe(false);
  });

  it("issues a token carrying the peserta audience, not a staff one", async () => {
    vi.mocked(prisma.pesertaMagang.findFirst).mockResolvedValue({
      id: PESERTA,
      password: "hashed",
      status: "AKTIF",
    } as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(prisma.pesertaMagang.findUnique).mockResolvedValue({
      id: PESERTA,
      name: "Andi",
      email: "andi@student.ac.id",
      phoneNumber: null,
      nim: "21001",
      tanggalMulai: null,
      tanggalSelesai: null,
      status: "AKTIF",
      divisi: { name: "IT" },
      instansi: { nama: "USK" },
      pembimbingLapangan: { fullName: "Budi" },
    } as never);

    const result = await portalService.login("andi@student.ac.id", "correct");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");

    const decoded = jwt.verify(result.data.token, process.env.JWT_SECRET!) as {
      sub: string;
      typ: string;
      role?: string;
    };
    expect(decoded.sub).toBe(PESERTA);
    expect(decoded.typ).toBe("peserta");
    expect(decoded.role).toBeUndefined();
  });
});

describe("portal check-in / check-out", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses a second check-in on the same day", async () => {
    vi.mocked(prisma.absensi.findFirst).mockResolvedValue({
      id: "absensi-1",
      jamMasuk: new Date(),
      kehadiran: "Hadir",
    } as never);

    const result = await portalService.checkIn(PESERTA, "08:00");

    expect(result.ok).toBe(false);
    expect(prisma.absensi.create).not.toHaveBeenCalled();
    expect(prisma.absensi.update).not.toHaveBeenCalled();
  });

  it("always records against today, never a date from the caller", async () => {
    vi.mocked(prisma.absensi.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.absensi.create).mockResolvedValue({ id: "absensi-1" } as never);

    await portalService.checkIn(PESERTA, "08:00");

    const [{ data }] = vi.mocked(prisma.absensi.create).mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data.pesertaMagangId).toBe(PESERTA);
    expect((data.tanggal as Date).toISOString().slice(0, 10)).toBe(todayIsoDate());
    expect(data.kehadiran).toBe("Hadir");
  });

  it("refuses check-in outside the office window", async () => {
    const result = await portalService.checkIn(PESERTA, "10:00");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.message).toMatch(/Check-in hanya dibuka/);
    expect(prisma.absensi.create).not.toHaveBeenCalled();
  });

  it("refuses check-out before check-in", async () => {
    vi.mocked(prisma.absensi.findFirst).mockResolvedValue(null);

    const result = await portalService.checkOut(PESERTA);

    expect(result.ok).toBe(false);
    expect(prisma.absensi.update).not.toHaveBeenCalled();
  });

  it("refuses a second check-out", async () => {
    vi.mocked(prisma.absensi.findFirst).mockResolvedValue({
      id: "absensi-1",
      jamMasuk: new Date(),
      jamKeluar: new Date(),
    } as never);

    const result = await portalService.checkOut(PESERTA);

    expect(result.ok).toBe(false);
    expect(prisma.absensi.update).not.toHaveBeenCalled();
  });
});

describe("portal jurnal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses a future-dated jurnal", async () => {
    const result = await portalService.createOwnJurnal(PESERTA, "2099-01-01", "Kegiatan");

    expect(result.ok).toBe(false);
    expect(prisma.jurnal.create).not.toHaveBeenCalled();
  });

  it("files a jurnal against the caller's own id", async () => {
    vi.mocked(prisma.jurnal.create).mockResolvedValue({ id: "jurnal-1" } as never);

    await portalService.createOwnJurnal(PESERTA, todayIsoDate(), "Kegiatan hari ini");

    const [{ data }] = vi.mocked(prisma.jurnal.create).mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data.pesertaMagangId).toBe(PESERTA);
  });

  // An id belonging to another peserta must read as "not found", not be editable.
  it("refuses to edit a jurnal that isn't the caller's", async () => {
    vi.mocked(prisma.jurnal.findFirst).mockResolvedValue(null);

    const result = await portalService.updateOwnJurnal(PESERTA, "jurnal-orang-lain", "Diubah");

    expect(result).toEqual({ ok: false, message: "Jurnal tidak ditemukan", status: 404 });
    expect(prisma.jurnal.update).not.toHaveBeenCalled();
  });

  it("scopes the ownership lookup by both id and peserta", async () => {
    vi.mocked(prisma.jurnal.findFirst).mockResolvedValue({ id: "jurnal-1" } as never);
    vi.mocked(prisma.jurnal.update).mockResolvedValue({ id: "jurnal-1" } as never);

    await portalService.updateOwnJurnal(PESERTA, "jurnal-1", "Diubah");

    const [{ where }] = vi.mocked(prisma.jurnal.findFirst).mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(where).toEqual({ id: "jurnal-1", pesertaMagangId: PESERTA });
  });
});

describe("portal read-only lists", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filters absensi, penilaian and dokumen by the caller's own id", async () => {
    vi.mocked(prisma.absensi.findMany).mockResolvedValue([]);
    vi.mocked(prisma.penilaian.findMany).mockResolvedValue([]);
    vi.mocked(prisma.dokumen.findMany).mockResolvedValue([]);

    await portalService.listOwnAbsensi(PESERTA, 50);
    await portalService.listOwnPenilaian(PESERTA);
    await portalService.listOwnDokumen(PESERTA);

    for (const call of [
      vi.mocked(prisma.absensi.findMany).mock.calls[0],
      vi.mocked(prisma.penilaian.findMany).mock.calls[0],
      vi.mocked(prisma.dokumen.findMany).mock.calls[0],
    ]) {
      const [{ where }] = call as [{ where: Record<string, unknown> }];
      expect(where).toEqual({ pesertaMagangId: PESERTA });
    }
  });
});
