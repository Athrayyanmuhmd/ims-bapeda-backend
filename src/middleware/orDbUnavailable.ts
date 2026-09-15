import { Response } from "express";
import { fail } from "../lib/response";

/** Run a DB promise; on failure send 503 and return null (caller must stop). */
export const orDbUnavailable = <T>(res: Response, promise: Promise<T>): Promise<T | null> =>
  promise.catch((error) => {
    console.error(error);
    fail(res, "Tidak dapat mengakses database. Coba lagi sebentar.", null, 503);
    return null;
  });
