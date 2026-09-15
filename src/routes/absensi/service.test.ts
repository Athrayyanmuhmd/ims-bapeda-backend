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
  izinStatus: null,
  izinJenis: null,
  reviewedById: null,
  reviewedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  pesertaMagang: {
    id: "peserta-1",
    name: "Andi Pratama",
    divisi: { name: "IT" },
    pembimbingLapangan: { fullName: "Budi Santoso" },
  },
  reviewedBy: null,
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
      expect.objectContaining({
        kehadiran: "Sakit",
        jamMasuk: null,
        jamKeluar: null,
        izinStatus: null,
        izinJenis: null,
      })
    );
  });

  it("clears jam for every non-Hadir status, not just Sakit", async () => {
    vi.mocked(absensiRepository.findById).mockResolvedValue(fakeAbsensi() as never);
    vi.mocked(absensiRepository.update).mockResolvedValue(fakeAbsensi() as never);

    for (const kehadiran of ["Izin", "Alpa"] as const) {
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
    // 08:05 WIB, pinned — not "08:05 in whatever zone the server happens to be".
    expect(data.jamMasuk).toEqual(new Date("2026-07-16T01:05:00.000Z"));
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

  const andClauses = () => {
    const [where] = vi.mocked(absensiRepository.findMany).mock.calls[0] as [
      { AND?: Array<Record<string, unknown>> },
    ];
    return where.AND ?? [];
  };

  // Asserted in UTC, not via new Date("...T00:00:00"): that form is parsed in the
  // host's timezone, so the old expectation here only passed on a WIB machine.
  it("builds a full-day date range in UTC when a tanggal filter is given", async () => {
    vi.mocked(absensiRepository.findMany).mockResolvedValue([]);
    vi.mocked(absensiRepository.count).mockResolvedValue(0);

    await absensiService.listAbsensi(baseParams, { tanggal: "2026-07-16" });

    expect(andClauses()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tanggal: {
            gte: new Date("2026-07-16T00:00:00.000Z"),
            lt: new Date("2026-07-17T00:00:00.000Z"),
          },
        }),
      ])
    );
  });

  it("builds an inclusive range from dariTanggal/sampaiTanggal", async () => {
    vi.mocked(absensiRepository.findMany).mockResolvedValue([]);
    vi.mocked(absensiRepository.count).mockResolvedValue(0);

    await absensiService.listAbsensi(baseParams, {
      dariTanggal: "2026-07-01",
      sampaiTanggal: "2026-07-31",
    });

    expect(andClauses()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tanggal: {
            gte: new Date("2026-07-01T00:00:00.000Z"),
            lte: new Date("2026-07-31T23:59:59.999Z"),
          },
        }),
      ])
    );
  });

  it("lets an exact tanggal win over a range", async () => {
    vi.mocked(absensiRepository.findMany).mockResolvedValue([]);
    vi.mocked(absensiRepository.count).mockResolvedValue(0);

    await absensiService.listAbsensi(baseParams, {
      tanggal: "2026-07-16",
      dariTanggal: "2026-01-01",
      sampaiTanggal: "2026-12-31",
    });

    expect(andClauses()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tanggal: {
            gte: new Date("2026-07-16T00:00:00.000Z"),
            lt: new Date("2026-07-17T00:00:00.000Z"),
          },
        }),
      ])
    );
  });

  it("scopes to a single peserta when pesertaMagangId is given", async () => {
    vi.mocked(absensiRepository.findMany).mockResolvedValue([]);
    vi.mocked(absensiRepository.count).mockResolvedValue(0);

    await absensiService.listAbsensi(baseParams, { pesertaMagangId: "peserta-1" });

    expect(andClauses()).toEqual(
      expect.arrayContaining([expect.objectContaining({ pesertaMagangId: "peserta-1" })])
    );
  });

  it("applies no date/peserta filter at all when neither is given", async () => {
    vi.mocked(absensiRepository.findMany).mockResolvedValue([]);
    vi.mocked(absensiRepository.count).mockResolvedValue(0);

    await absensiService.listAbsensi(baseParams);

    expect(andClauses().some((clause) => "tanggal" in clause)).toBe(false);
    expect(andClauses().some((clause) => "pesertaMagangId" in clause)).toBe(false);
  });
});

// Absensi has no pembimbing column of its own — the scope has to reach through
// the pesertaMagang relation, which is the variant most likely to be dropped.
describe("absensi service — pembimbing scoping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filters the list through the pesertaMagang relation when scoped", async () => {
    vi.mocked(absensiRepository.findMany).mockResolvedValue([]);
    vi.mocked(absensiRepository.count).mockResolvedValue(0);

    await absensiService.listAbsensi(baseParams, {}, "user-pembimbing");

    const [where] = vi.mocked(absensiRepository.findMany).mock.calls[0] as [
      { AND?: Array<Record<string, unknown>> },
    ];
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pesertaMagang: { pembimbingLapanganId: "user-pembimbing" } }),
      ])
    );
  });

  it("applies no relation filter for an unscoped (Admin) caller", async () => {
    vi.mocked(absensiRepository.findMany).mockResolvedValue([]);
    vi.mocked(absensiRepository.count).mockResolvedValue(0);

    await absensiService.listAbsensi(baseParams);

    const [where] = vi.mocked(absensiRepository.findMany).mock.calls[0] as [
      { AND?: Array<Record<string, unknown>> },
    ];
    const hasPesertaScope = (where.AND ?? []).some(
      (clause) =>
        clause.pesertaMagang &&
        typeof clause.pesertaMagang === "object" &&
        "pembimbingLapanganId" in (clause.pesertaMagang as object)
    );
    expect(hasPesertaScope).toBe(false);
  });

  it("refuses to create absensi for a peserta outside the scope", async () => {
    vi.mocked(absensiRepository.pesertaExists).mockResolvedValue(null);

    const result = await absensiService.createAbsensi(
      { pesertaMagangId: "peserta-lain", kehadiran: "Hadir", tanggal: "2026-07-16" },
      "user-pembimbing"
    );

    expect(absensiRepository.pesertaExists).toHaveBeenCalledWith("peserta-lain", "user-pembimbing");
    expect(result.ok).toBe(false);
    expect(absensiRepository.create).not.toHaveBeenCalled();
  });

  it("passes the scope to the lookup behind update and delete", async () => {
    vi.mocked(absensiRepository.findById).mockResolvedValue(null);

    await absensiService.updateAbsensi("absensi-lain", { kehadiran: "Sakit" }, "user-pembimbing");
    await absensiService.deleteAbsensi("absensi-lain", "user-pembimbing");

    expect(absensiRepository.findById).toHaveBeenNthCalledWith(1, "absensi-lain", "user-pembimbing");
    expect(absensiRepository.findById).toHaveBeenNthCalledWith(2, "absensi-lain", "user-pembimbing");
    expect(absensiRepository.update).not.toHaveBeenCalled();
    expect(absensiRepository.remove).not.toHaveBeenCalled();
  });
});

describe("absensi service — approve / reject izin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("approves a pending izin into final Izin/Sakit", async () => {
    vi.mocked(absensiRepository.findById).mockResolvedValue(
      fakeAbsensi({
        kehadiran: "Izin",
        izinStatus: "PENDING",
        izinJenis: "Izin",
        jamMasuk: null,
        jamKeluar: null,
      }) as never
    );
    vi.mocked(absensiRepository.update).mockResolvedValue(
      fakeAbsensi({ kehadiran: "Izin", izinStatus: "APPROVED", izinJenis: "Izin" }) as never
    );

    const result = await absensiService.approveIzin("absensi-1", "user-1");

    expect(result.ok).toBe(true);
    expect(absensiRepository.update).toHaveBeenCalledWith(
      "absensi-1",
      expect.objectContaining({
        kehadiran: "Izin",
        izinStatus: "APPROVED",
        reviewedById: "user-1",
      })
    );
  });

  it("rejects a pending izin as Alpa", async () => {
    vi.mocked(absensiRepository.findById).mockResolvedValue(
      fakeAbsensi({
        kehadiran: "Sakit",
        izinStatus: "PENDING",
        izinJenis: "Sakit",
        keterangan: "Demam",
      }) as never
    );
    vi.mocked(absensiRepository.update).mockResolvedValue(
      fakeAbsensi({ kehadiran: "Alpa", izinStatus: "REJECTED" }) as never
    );

    const result = await absensiService.rejectIzin("absensi-1", "user-1");

    expect(result.ok).toBe(true);
    expect(absensiRepository.update).toHaveBeenCalledWith(
      "absensi-1",
      expect.objectContaining({
        kehadiran: "Alpa",
        izinStatus: "REJECTED",
        reviewedById: "user-1",
      })
    );
  });

  it("refuses to approve a non-pending row", async () => {
    vi.mocked(absensiRepository.findById).mockResolvedValue(
      fakeAbsensi({ izinStatus: "APPROVED", izinJenis: "Izin", kehadiran: "Izin" }) as never
    );

    const result = await absensiService.approveIzin("absensi-1", "user-1");

    expect(result.ok).toBe(false);
    expect(absensiRepository.update).not.toHaveBeenCalled();
  });
});
