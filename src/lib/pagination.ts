import { Request } from "express";

export interface PaginationParams {
  skip: number;
  rows: number;
  orderKey: string;
  orderRule: "asc" | "desc";
  searchFilters: Record<string, string>;
}

// Field names arrive from the client inside `searchFilters`, so every caller has
// to declare which columns are searchable. Without the allowlist any logged-in
// user could filter on any column — including User.password, where the match
// count alone is a blind oracle for extracting the bcrypt hash one character at
// a time (the hash itself is never selected, but "did anything match?" is
// enough).
export const buildSearchWhere = (
  searchFilters: Record<string, string>,
  allowedFields: readonly string[]
) => {
  const conditions = Object.entries(searchFilters)
    .filter(([field, value]) => allowedFields.includes(field) && value !== "")
    .map(([field, value]) => ({ [field]: { contains: value, mode: "insensitive" as const } }));

  return conditions.length > 0 ? { OR: conditions } : {};
};

// orderKey lands straight in Prisma's orderBy, so it needs the same treatment:
// sorting by User.password would leak each hash's lexicographic position across
// pages. Anything not on the list falls back to createdAt.
export const buildOrderBy = (
  orderKey: string,
  orderRule: "asc" | "desc",
  allowedFields: readonly string[]
) => ({ [allowedFields.includes(orderKey) ? orderKey : "createdAt"]: orderRule });

// ponytail: `rows` is a hard ceiling, not a page-size preference — it becomes
// Prisma's `take`, so unbounded means one request can pull an entire table.
// 2000 matches the largest legitimate caller (the absensi CSV export).
const MAX_ROWS = 2000;

const toPositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// Malformed JSON is a client mistake, not a reason to throw a 500 — fall back to
// "no filter" instead.
const parseJsonObject = (raw: string | undefined): Record<string, unknown> => {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

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

  const page = toPositiveInt(raw.page, 1);
  const rows = Math.min(toPositiveInt(raw.rows, 10), MAX_ROWS);
  const orderKey = raw.orderKey ?? "createdAt";
  // Anything other than an explicit "asc" is desc — Prisma throws on a value
  // that isn't one of the two, and this used to be an unchecked cast.
  const orderRule: PaginationParams["orderRule"] = raw.orderRule === "asc" ? "asc" : "desc";

  // Only string values survive: `contains` can't take a number or object.
  const searchFilters = Object.fromEntries(
    Object.entries(parseJsonObject(raw.searchFilters)).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );

  const filters = parseJsonObject(raw.filters);

  return { page, rows, orderKey, orderRule, searchFilters, filters, skip: (page - 1) * rows };
};
