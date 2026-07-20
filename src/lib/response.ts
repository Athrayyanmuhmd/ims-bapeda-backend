import { Response } from "express";

export const ok = <T>(res: Response, content: T, message = "Success") =>
  res.json({ content, message, errors: null });

export const paginated = <T>(
  res: Response,
  entries: T[],
  totalData: number,
  totalPage: number,
  message = "Success"
) => res.json({ content: { entries, totalData, totalPage }, message, errors: null });

export const fail = (
  res: Response,
  message: string,
  errors: { field: string; message: string }[] | null = null,
  status = 400
) => res.status(status).json({ content: null, message, errors });
