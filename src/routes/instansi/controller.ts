import { Response } from "express";
import { ok, paginated, fail } from "../../lib/response";
import { parsePagination } from "../../lib/pagination";
import { AuthRequest } from "../../middleware/auth";
import * as instansiService from "./service";

export const listInstansi = async (req: AuthRequest, res: Response) => {
  const { rows, skip, orderKey, orderRule, searchFilters } = parsePagination(req);

  const result = await instansiService.listInstansi({ skip, rows, orderKey, orderRule, searchFilters });
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  paginated(res, result.data.entries, result.data.totalData, result.data.totalPage);
};

export const getInstansiDetail = async (req: AuthRequest, res: Response) => {
  const result = await instansiService.getInstansiDetail(req.params.id as string);
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};

export const createInstansi = async (req: AuthRequest, res: Response) => {
  const { nama, jenis, alamat, namaPic, noHpPic } = req.body as {
    nama?: string; jenis?: string; alamat?: string; namaPic?: string; noHpPic?: string;
  };

  if (!nama || !jenis) { fail(res, "Nama dan jenis instansi wajib diisi"); return; }

  const result = await instansiService.createInstansi({ nama, jenis, alamat, namaPic, noHpPic });
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Instansi berhasil dibuat");
};

export const updateInstansi = async (req: AuthRequest, res: Response) => {
  const { nama, jenis, alamat, namaPic, noHpPic } = req.body as {
    nama?: string; jenis?: string; alamat?: string; namaPic?: string; noHpPic?: string;
  };

  const result = await instansiService.updateInstansi(req.params.id as string, { nama, jenis, alamat, namaPic, noHpPic });
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Instansi berhasil diupdate");
};

export const deleteInstansi = async (req: AuthRequest, res: Response) => {
  const result = await instansiService.deleteInstansi(req.params.id as string);
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, null, "Instansi berhasil dihapus");
};
