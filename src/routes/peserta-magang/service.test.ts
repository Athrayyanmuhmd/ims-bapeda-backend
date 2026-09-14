import { beforeEach, describe, expect, it, vi } from "vitest";
import * as pesertaRepository from "./repository";
import * as pesertaService from "./service";

vi.mock("./repository");

vi.mock("../../lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
  },
  isUniqueViolation: vi.fn(),
}));

import prisma from "../../lib/prisma";

const baseParams = { skip: 0, rows: 10, orderKey: "createdAt", orderRule: "desc" as const, searchFilters: {} };

const PEMBIMBING = "user-pembimbing";

const fakePeserta = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "peserta-1",
  name: "Andi Pratama",
  email: "andi@student.ac.id",
  phoneNumber: null,
  nim: "2108107010001",
  tanggalMulai: new Date("2026-07-01"),
  tanggalSelesai: new Date("2026-09-30"),
  status: "AKTIF",
  createdAt: new Date(),
  updatedAt: new Date(),
  divisi: { id: "divisi-it", name: "IT" },
  instansi: { id: "instansi-usk", nama: "Universitas Syiah Kuala" },
  pembimbingLapangan: { id: PEMBIMBING, fullName: "Budi Santoso" },
  ...overrides,
});

const eligiblePembimbing = { status: "active", role: { name: "Pembimbing" } };

describe("peserta magang service — pembimbing scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(eligiblePembimbing as never);
  });

  it("filters the list by pembimbingLapanganId when scoped", async () => {
    vi.mocked(pesertaRepository.findMany).mockResolvedValue([]);
    vi.mocked(pesertaRepository.count).mockResolvedValue(0);

    await pesertaService.listPeserta(baseParams, PEMBIMBING);

    const [where] = vi.mocked(pesertaRepository.findMany).mock.calls[0];
    expect(where).toMatchObject({ pembimbingLapanganId: PEMBIMBING });
  });

  it("applies no pembimbing filter for an unscoped (Admin) caller", async () => {
    vi.mocked(pesertaRepository.findMany).mockResolvedValue([]);
    vi.mocked(pesertaRepository.count).mockResolvedValue(0);

    await pesertaService.listPeserta(baseParams);

    const [where] = vi.mocked(pesertaRepository.findMany).mock.calls[0];
    expect(where).not.toHaveProperty("pembimbingLapanganId");
  });

  it("passes the scope through to the detail lookup", async () => {
    vi.mocked(pesertaRepository.findById).mockResolvedValue(fakePeserta() as never);

    await pesertaService.getPesertaDetail("peserta-1", PEMBIMBING);

    expect(pesertaRepository.findById).toHaveBeenCalledWith("peserta-1", PEMBIMBING);
  });

  it("reports a peserta outside the scope as not found", async () => {
    vi.mocked(pesertaRepository.findById).mockResolvedValue(null);

    const result = await pesertaService.getPesertaDetail("peserta-lain", PEMBIMBING);

    expect(result).toEqual({ ok: false, message: "Peserta magang tidak ditemukan", status: 404 });
  });

  it("forces a scoped creator to be the pembimbing, overriding whatever was sent", async () => {
    vi.mocked(pesertaRepository.create).mockResolvedValue(fakePeserta() as never);

    await pesertaService.createPeserta(
      { name: "Andi", email: "andi@student.ac.id", pembimbingLapanganId: "somebody-else" },
      PEMBIMBING
    );

    const [data] = vi.mocked(pesertaRepository.create).mock.calls[0];
    expect(data.pembimbingLapanganId).toBe(PEMBIMBING);
  });

  it("lets an unscoped (Admin) caller assign a Pembimbing-role user on create", async () => {
    vi.mocked(pesertaRepository.create).mockResolvedValue(fakePeserta() as never);

    await pesertaService.createPeserta({
      name: "Andi",
      email: "andi@student.ac.id",
      pembimbingLapanganId: "user-lain",
    });

    const [data] = vi.mocked(pesertaRepository.create).mock.calls[0];
    expect(data.pembimbingLapanganId).toBe("user-lain");
  });

  it("rejects assigning an Admin as pembimbing lapangan", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      status: "active",
      role: { name: "Admin" },
    } as never);

    const result = await pesertaService.createPeserta({
      name: "Andi",
      email: "andi@student.ac.id",
      pembimbingLapanganId: "admin-user",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.message).toMatch(/Pembimbing/);
    expect(pesertaRepository.create).not.toHaveBeenCalled();
  });

  it("hashes portalPassword on create when provided", async () => {
    vi.mocked(pesertaRepository.create).mockResolvedValue(
      fakePeserta({ password: "hashed" }) as never
    );

    const result = await pesertaService.createPeserta({
      name: "Andi",
      email: "andi@student.ac.id",
      portalPassword: "portal123",
    });

    const [data] = vi.mocked(pesertaRepository.create).mock.calls[0];
    expect(data.password).toEqual(expect.any(String));
    expect(data.password).not.toBe("portal123");
    expect(result.ok && result.data.hasPortalAccount).toBe(true);
  });

  it("rejects a short portalPassword on create", async () => {
    const result = await pesertaService.createPeserta({
      name: "Andi",
      email: "andi@student.ac.id",
      portalPassword: "short",
    });

    expect(result).toEqual({
      ok: false,
      message: "Password portal minimal 8 karakter",
    });
    expect(pesertaRepository.create).not.toHaveBeenCalled();
  });

  it("ignores a reassignment attempt from a scoped caller on update", async () => {
    vi.mocked(pesertaRepository.findById).mockResolvedValue(fakePeserta() as never);
    vi.mocked(pesertaRepository.update).mockResolvedValue(fakePeserta() as never);

    await pesertaService.updatePeserta(
      "peserta-1",
      { name: "Andi Baru", pembimbingLapanganId: "somebody-else" },
      PEMBIMBING
    );

    const [, data] = vi.mocked(pesertaRepository.update).mock.calls[0];
    expect(data.name).toBe("Andi Baru");
    expect(data).not.toHaveProperty("pembimbingLapanganId");
  });

  it("lets an unscoped (Admin) caller reassign the pembimbing on update", async () => {
    vi.mocked(pesertaRepository.findById).mockResolvedValue(fakePeserta() as never);
    vi.mocked(pesertaRepository.update).mockResolvedValue(fakePeserta() as never);

    await pesertaService.updatePeserta("peserta-1", { pembimbingLapanganId: "user-lain" });

    const [, data] = vi.mocked(pesertaRepository.update).mock.calls[0];
    expect(data.pembimbingLapanganId).toBe("user-lain");
  });

  it("refuses to update or delete out-of-scope records", async () => {
    vi.mocked(pesertaRepository.findById).mockResolvedValue(null);

    const updated = await pesertaService.updatePeserta("peserta-lain", { name: "x" }, PEMBIMBING);
    const deleted = await pesertaService.deletePeserta("peserta-lain", PEMBIMBING);

    expect(updated.ok).toBe(false);
    expect(deleted.ok).toBe(false);
    expect(pesertaRepository.update).not.toHaveBeenCalled();
    expect(pesertaRepository.remove).not.toHaveBeenCalled();
  });
});
