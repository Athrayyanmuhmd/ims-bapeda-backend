import { StatusMagang } from "@prisma/client";
import bcrypt from "bcryptjs";
import { parseDateOnly } from "../../lib/datetime";
import { buildOrderBy, buildSearchWhere, PaginationParams } from "../../lib/pagination";
import prisma from "../../lib/prisma";
import { success, failure } from "../../lib/serviceResult";
import * as pesertaRepository from "./repository";

type PesertaWithRelations = Awaited<ReturnType<typeof pesertaRepository.findById>>;

// Drops `password` and replaces it with a boolean. Destructured out explicitly
// rather than spread-then-overwrite so the hash can't survive a future edit that
// reorders these keys.
const present = ({ password, ...p }: NonNullable<PesertaWithRelations>) => ({
  ...p,
  hasPortalAccount: !!password,
  divisi: p.divisi?.name ?? null,
  divisiId: p.divisi?.id ?? null,
  instansi: p.instansi?.nama ?? null,
  instansiId: p.instansi?.id ?? null,
  pembimbingLapangan: p.pembimbingLapangan?.fullName ?? null,
  pembimbingLapanganId: p.pembimbingLapangan?.id ?? null,
});

const SEARCHABLE = ["name", "email", "nim"] as const;
const SORTABLE = ["name", "email", "nim", "status", "tanggalMulai", "tanggalSelesai", "createdAt"] as const;

const emptyToUndef = (value?: string | null) => (value ? value : undefined);

// Admin accounts manage the system; they must not be assigned as lapangan supervisors.
const assertPembimbingEligible = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, role: { select: { name: true } } },
  });

  if (!user || user.status !== "active") {
    return failure("Pembimbing lapangan tidak ditemukan atau tidak aktif", 404);
  }

  if (user.role?.name !== "Pembimbing") {
    return failure("Pembimbing lapangan harus pengguna berrole Pembimbing (bukan Admin)");
  }

  return null;
};

// pembimbingId scopes every read/write to that supervisor's binaan; undefined
// means unrestricted (Admin). See pembimbingScope() in middleware/auth.
export const listPeserta = async (
  { skip, rows, orderKey, orderRule, searchFilters }: PaginationParams,
  pembimbingId?: string
) => {
  const where = {
    ...buildSearchWhere(searchFilters, SEARCHABLE),
    ...(pembimbingId ? { pembimbingLapanganId: pembimbingId } : {}),
  };

  const [data, totalData] = await Promise.all([
    pesertaRepository.findMany(where, skip, rows, buildOrderBy(orderKey, orderRule, SORTABLE)),
    pesertaRepository.count(where),
  ]);

  return success({ entries: data.map(present), totalData, totalPage: Math.ceil(totalData / rows) });
};

export const getPesertaDetail = async (id: string, pembimbingId?: string) => {
  const peserta = await pesertaRepository.findById(id, pembimbingId);
  if (!peserta) return failure("Peserta magang tidak ditemukan", 404);
  return success(present(peserta));
};

interface CreatePesertaInput {
  name: string;
  email: string;
  phoneNumber?: string;
  nim?: string;
  divisiId?: string;
  instansiId?: string;
  pembimbingLapanganId?: string;
  tanggalMulai?: string;
  tanggalSelesai?: string;
  status?: string;
  // Optional: activate the portal in the same create call so staff don't have
  // to edit again just to hand credentials to the peserta.
  portalPassword?: string;
}

export const MIN_PORTAL_PASSWORD_LENGTH = 8;

export const createPeserta = async (input: CreatePesertaInput, pembimbingId?: string) => {
  if (input.portalPassword !== undefined && input.portalPassword.length < MIN_PORTAL_PASSWORD_LENGTH) {
    return failure(`Password portal minimal ${MIN_PORTAL_PASSWORD_LENGTH} karakter`);
  }

  const assignedPembimbingId = pembimbingId ?? emptyToUndef(input.pembimbingLapanganId);

  // Scoped creators are already gated as Pembimbing by the router. Admin picks
  // must still be validated so an Admin user id never lands as lapangan.
  if (!pembimbingId && assignedPembimbingId) {
    const rejected = await assertPembimbingEligible(assignedPembimbingId);
    if (rejected) return rejected;
  }

  const peserta = await pesertaRepository.create({
    name: input.name,
    email: input.email,
    phoneNumber: emptyToUndef(input.phoneNumber),
    nim: emptyToUndef(input.nim),
    divisiId: emptyToUndef(input.divisiId),
    instansiId: emptyToUndef(input.instansiId),
    pembimbingLapanganId: assignedPembimbingId,
    ...(input.portalPassword ? { password: await bcrypt.hash(input.portalPassword, 10) } : {}),
    status: input.status as StatusMagang | undefined,
    tanggalMulai: input.tanggalMulai ? parseDateOnly(input.tanggalMulai) : undefined,
    tanggalSelesai: input.tanggalSelesai ? parseDateOnly(input.tanggalSelesai) : undefined,
  });
  return success(present(peserta));
};

interface UpdatePesertaInput {
  name?: string;
  email?: string;
  phoneNumber?: string;
  nim?: string;
  divisiId?: string;
  instansiId?: string;
  pembimbingLapanganId?: string;
  tanggalMulai?: string;
  tanggalSelesai?: string;
  status?: string;
  // Portal peserta: a non-empty string activates or resets the account, an
  // explicit null revokes it. Omitted (undefined) leaves it untouched.
  portalPassword?: string | null;
}

export const updatePeserta = async (id: string, input: UpdatePesertaInput, pembimbingId?: string) => {
  const exists = await pesertaRepository.findById(id, pembimbingId);
  if (!exists) return failure("Peserta magang tidak ditemukan", 404);

  const data: Record<string, unknown> = {};
  if (input.name) data.name = input.name;
  if (input.email) data.email = input.email;
  if (input.phoneNumber !== undefined) data.phoneNumber = emptyToUndef(input.phoneNumber) ?? null;
  if (input.nim !== undefined) data.nim = emptyToUndef(input.nim) ?? null;
  if (input.divisiId !== undefined) data.divisiId = emptyToUndef(input.divisiId) ?? null;
  if (input.instansiId !== undefined) data.instansiId = emptyToUndef(input.instansiId) ?? null;
  // Only Admin may reassign a peserta to another pembimbing — a scoped user
  // doing it would either hand their binaan away or take someone else's.
  if (!pembimbingId && input.pembimbingLapanganId !== undefined) {
    const nextPembimbingId = emptyToUndef(input.pembimbingLapanganId) ?? null;
    if (nextPembimbingId) {
      const rejected = await assertPembimbingEligible(nextPembimbingId);
      if (rejected) return rejected;
    }
    data.pembimbingLapanganId = nextPembimbingId;
  }
  if (input.tanggalMulai !== undefined) {
    data.tanggalMulai = input.tanggalMulai ? parseDateOnly(input.tanggalMulai) : null;
  }
  if (input.tanggalSelesai !== undefined) {
    data.tanggalSelesai = input.tanggalSelesai ? parseDateOnly(input.tanggalSelesai) : null;
  }
  if (input.status) data.status = input.status;

  if (input.portalPassword === null) {
    data.password = null;
  } else if (input.portalPassword !== undefined) {
    if (input.portalPassword.length < MIN_PORTAL_PASSWORD_LENGTH) {
      return failure(`Password portal minimal ${MIN_PORTAL_PASSWORD_LENGTH} karakter`);
    }
    data.password = await bcrypt.hash(input.portalPassword, 10);
  }

  const peserta = await pesertaRepository.update(id, data);
  return success(present(peserta));
};

export const deletePeserta = async (id: string, pembimbingId?: string) => {
  const exists = await pesertaRepository.findById(id, pembimbingId);
  if (!exists) return failure("Peserta magang tidak ditemukan", 404);

  await pesertaRepository.remove(id);
  return success(null);
};
