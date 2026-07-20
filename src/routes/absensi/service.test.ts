import { beforeEach, describe, expect, it, vi } from "vitest";
import * as absensiRepository from "./repository";
import * as absensiService from "./service";

vi.mock("./repository");

const baseParams = { skip: 0, rows: 10, orderKey: "createdAt", orderRule: "desc" as const, searchFilters: {} };

const fakeAbsensi = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "absensi-1",
  kehadiran: "Hadir",
  tanggal: new Date("2026-07-16"),
  jamMasuk: new Date("2026-07-16T08:00:00"),
  jamKeluar: new Date("2026-07-16T17:00:00"),
  keterangan: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  pesertaMagang: {
    id: "peserta-1",
    name: "Andi Pratama",
    divisi: { name: "IT" },
    pembimbingLapangan: { fullName: "Budi Santoso" },
  },
  ...overrides,
});

describe("absensi service — updateAbsensi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clears jamMasuk and jamKeluar when switching away from Hadir", async () => {
    vi.mocked(absensiRepository.findById).mockResolvedValue(fakeAbsensi() as never);
    vi.mocked(absensiRepository.update).mockResolvedValue(
      fakeAbsensi({ kehadiran: "Sakit", jamMasuk: null, jamKeluar: null }) as never
    );

    await absensiService.updateAbsensi("absensi-1", { kehadiran: "Sakit" });

    expect(absensiRepository.update).toHaveBeenCalledWith(
      "absensi-1",
      expect.objectContaining({ kehadiran: "Sakit", jamMasuk: null, jamKeluar: null })
    );
  });

  it("clears jam for every non-Hadir status, not just Sakit", async () => {
    vi.mocked(absensiRepository.findById).mockResolvedValue(fakeAbsensi() as never);
    vi.mocked(absensiRepository.update).mockResolvedValue(fakeAbsensi() as never);

    for (const kehadiran of ["Izin", "Alpa"]) {
      vi.mocked(absensiRepository.update).mockClear();
      await absensiService.updateAbsensi("absensi-1", { kehadiran });

      expect(absensiRepository.update).toHaveBeenCalledWith(
        "absensi-1",
        expect.objectContaining({ jamMasuk: null, jamKeluar: null })
      );
    }
  });

  it("keeps an explicit jamMasuk when marking Hadir", async () => {
    vi.mocked(absensiRepository.findById).mockResolvedValue(fakeAbsensi() as never);
    vi.mocked(absensiRepository.update).mockResolvedValue(fakeAbsensi() as never);

    await absensiService.updateAbsensi("absensi-1", {
      kehadiran: "Hadir",
      jamMasuk: "2026-07-16T08:05:00",
    });

    const [, data] = vi.mocked(absensiRepository.update).mock.calls[0];
    expect(data.kehadiran).toBe("Hadir");
    expect(data.jamMasuk).toEqual(new Date("2026-07-16T08:05:00"));
  });

  it("leaves jamMasuk/jamKeluar untouched when kehadiran isn't part of the update", async () => {
    vi.mocked(absensiRepository.findById).mockResolvedValue(fakeAbsensi() as never);
    vi.mocked(absensiRepository.update).mockResolvedValue(fakeAbsensi() as never);

    await absensiService.updateAbsensi("absensi-1", { keterangan: "Izin dokter" });

    const [, data] = vi.mocked(absensiRepository.update).mock.calls[0];
    expect(data).not.toHaveProperty("jamMasuk");
    expect(data).not.toHaveProperty("jamKeluar");
    expect(data.keterangan).toBe("Izin dokter");
  });

  it("fails with 404 when the absensi record doesn't exist", async () => {
    vi.mocked(absensiRepository.findById).mockResolvedValue(null);

    const result = await absensiService.updateAbsensi("missing", { kehadiran: "Sakit" });

    expect(result).toEqual({ ok: false, message: "Absensi tidak ditemukan", status: 404 });
    expect(absensiRepository.update).not.toHaveBeenCalled();
  });
});

describe("absensi service — createAbsensi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fails with 404 when the peserta magang doesn't exist", async () => {
    vi.mocked(absensiRepository.pesertaExists).mockResolvedValue(null);

    const result = await absensiService.createAbsensi({
      pesertaMagangId: "ghost",
      kehadiran: "Hadir",
      tanggal: "2026-07-16",
    });

    expect(result).toEqual({ ok: false, message: "Peserta magang tidak ditemukan", status: 404 });
    expect(absensiRepository.create).not.toHaveBeenCalled();
  });
});

describe("absensi service — listAbsensi filters", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds a full-day date range when a tanggal filter is given", async () => {
    vi.mocked(absensiRepository.findMany).mockResolvedValue([]);
    vi.mocked(absensiRepository.count).mockResolvedValue(0);

    await absensiService.listAbsensi(baseParams, { tanggal: "2026-07-16" });

    const [where] = vi.mocked(absensiRepository.findMany).mock.calls[0];
    expect(where).toMatchObject({
      tanggal: {
        gte: new Date("2026-07-16T00:00:00"),
        lt: new Date("2026-07-16T23:59:59.999"),
      },
    });
  });

  it("scopes to a single peserta when pesertaMagangId is given", async () => {
    vi.mocked(absensiRepository.findMany).mockResolvedValue([]);
    vi.mocked(absensiRepository.count).mockResolvedValue(0);

    await absensiService.listAbsensi(baseParams, { pesertaMagangId: "peserta-1" });

    const [where] = vi.mocked(absensiRepository.findMany).mock.calls[0];
    expect(where).toMatchObject({ pesertaMagangId: "peserta-1" });
  });

  it("applies no date/peserta filter at all when neither is given", async () => {
    vi.mocked(absensiRepository.findMany).mockResolvedValue([]);
    vi.mocked(absensiRepository.count).mockResolvedValue(0);

    await absensiService.listAbsensi(baseParams);

    const [where] = vi.mocked(absensiRepository.findMany).mock.calls[0];
    expect(where).not.toHaveProperty("tanggal");
    expect(where).not.toHaveProperty("pesertaMagangId");
  });
});
