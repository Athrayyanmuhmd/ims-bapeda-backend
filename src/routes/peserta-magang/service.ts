import { StatusMagang } from "@prisma/client";
import { buildSearchWhere, PaginationParams } from "../../lib/pagination";
import { success, failure } from "../../lib/serviceResult";
import * as pesertaRepository from "./repository";

type PesertaWithRelations = Awaited<ReturnType<typeof pesertaRepository.findById>>;

const present = (p: NonNullable<PesertaWithRelations>) => ({
  ...p,
  divisi: p.divisi?.name ?? null,
  divisiId: p.divisi?.id ?? null,
  instansi: p.instansi?.nama ?? null,
  instansiId: p.instansi?.id ?? null,
  pembimbingLapangan: p.pembimbingLapangan?.fullName ?? null,
  pembimbingLapanganId: p.pembimbingLapangan?.id ?? null,
});

export const listPeserta = async ({ skip, rows, orderKey, orderRule, searchFilters }: PaginationParams) => {
  const where = buildSearchWhere(searchFilters);

  const [data, totalData] = await Promise.all([
    pesertaRepository.findMany(where, skip, rows, { [orderKey]: orderRule }),
    pesertaRepository.count(where),
  ]);

  return success({ entries: data.map(present), totalData, totalPage: Math.ceil(totalData / rows) });
};

export const getPesertaDetail = async (id: string) => {
  const peserta = await pesertaRepository.findById(id);
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
}

export const createPeserta = async (input: CreatePesertaInput) => {
  const peserta = await pesertaRepository.create({
    ...input,
    status: input.status as StatusMagang | undefined,
    tanggalMulai: input.tanggalMulai ? new Date(input.tanggalMulai) : undefined,
    tanggalSelesai: input.tanggalSelesai ? new Date(input.tanggalSelesai) : undefined,
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
}

export const updatePeserta = async (id: string, input: UpdatePesertaInput) => {
  const exists = await pesertaRepository.findById(id);
  if (!exists) return failure("Peserta magang tidak ditemukan", 404);

  const data: Record<string, unknown> = {};
  if (input.name) data.name = input.name;
  if (input.email) data.email = input.email;
  if (input.phoneNumber !== undefined) data.phoneNumber = input.phoneNumber;
  if (input.nim !== undefined) data.nim = input.nim;
  if (input.divisiId !== undefined) data.divisiId = input.divisiId;
  if (input.instansiId !== undefined) data.instansiId = input.instansiId;
  if (input.pembimbingLapanganId !== undefined) data.pembimbingLapanganId = input.pembimbingLapanganId;
  if (input.tanggalMulai !== undefined) data.tanggalMulai = input.tanggalMulai ? new Date(input.tanggalMulai) : null;
  if (input.tanggalSelesai !== undefined) data.tanggalSelesai = input.tanggalSelesai ? new Date(input.tanggalSelesai) : null;
  if (input.status) data.status = input.status;

  const peserta = await pesertaRepository.update(id, data);
  return success(present(peserta));
};

export const deletePeserta = async (id: string) => {
  const exists = await pesertaRepository.findById(id);
  if (!exists) return failure("Peserta magang tidak ditemukan", 404);

  await pesertaRepository.remove(id);
  return success(null);
};
