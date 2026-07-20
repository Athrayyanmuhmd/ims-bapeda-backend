import { Request } from "express";

export interface PaginationParams {
  skip: number;
  rows: number;
  orderKey: string;
  orderRule: "asc" | "desc";
  searchFilters: Record<string, string>;
}

export const buildSearchWhere = (searchFilters: Record<string, string>) =>
  Object.keys(searchFilters).length
    ? {
        OR: Object.entries(searchFilters).map(([field, value]) => ({
          [field]: { contains: value, mode: "insensitive" as const },
        })),
      }
    : {};

export const parsePagination = (req: Request) => {
  const body = req.body as Record<string, unknown>;
  const query = req.query as Record<string, string>;

  // Support params from both query string and body (frontend sends body: { params: "..." })
  let raw: Record<string, string> = {};
  if (typeof body.params === "string") {
    raw = Object.fromEntries(new URLSearchParams(body.params));
  } else {
    raw = query;
  }

  const page = parseInt(raw.page ?? "1") || 1;
  const rows = parseInt(raw.rows ?? "10") || 10;
  const orderKey = raw.orderKey ?? "createdAt";
  const orderRule = (raw.orderRule ?? "desc") as "asc" | "desc";

  const searchFilters: Record<string, string> = raw.searchFilters
    ? JSON.parse(raw.searchFilters)
    : {};

  const filters: Record<string, unknown> = raw.filters ? JSON.parse(raw.filters) : {};

  return { page, rows, orderKey, orderRule, searchFilters, filters, skip: (page - 1) * rows };
};
