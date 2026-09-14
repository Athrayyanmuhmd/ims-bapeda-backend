import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { buildOrderBy, buildSearchWhere, parsePagination } from "./pagination";

const ALLOWED = ["name", "email"] as const;

describe("buildSearchWhere", () => {
  it("returns an empty where clause when there are no filters", () => {
    expect(buildSearchWhere({}, ALLOWED)).toEqual({});
  });

  it("builds a case-insensitive OR clause for a single filter", () => {
    expect(buildSearchWhere({ name: "andi" }, ALLOWED)).toEqual({
      OR: [{ name: { contains: "andi", mode: "insensitive" } }],
    });
  });

  it("builds one OR entry per allowed filter key", () => {
    const where = buildSearchWhere({ name: "andi", email: "andi@test.com" }, ALLOWED);
    expect(where).toEqual({
      OR: [
        { name: { contains: "andi", mode: "insensitive" } },
        { email: { contains: "andi@test.com", mode: "insensitive" } },
      ],
    });
  });

  // The whole point of the allowlist: `password` is a real column, and a
  // filterable one turns the row count into a bcrypt-hash disclosure oracle.
  it("drops fields that aren't on the allowlist", () => {
    expect(buildSearchWhere({ password: "$2a$10$" }, ALLOWED)).toEqual({});
  });

  it("keeps allowed fields while dropping disallowed ones in the same request", () => {
    expect(buildSearchWhere({ name: "andi", password: "$2a$10$" }, ALLOWED)).toEqual({
      OR: [{ name: { contains: "andi", mode: "insensitive" } }],
    });
  });

  it("ignores empty search values instead of matching everything", () => {
    expect(buildSearchWhere({ name: "" }, ALLOWED)).toEqual({});
  });
});

describe("buildOrderBy", () => {
  it("uses the requested key when it's allowed", () => {
    expect(buildOrderBy("name", "asc", ALLOWED)).toEqual({ name: "asc" });
  });

  // Sorting by password would leak each hash's relative position across pages.
  it("falls back to createdAt for a key that isn't allowed", () => {
    expect(buildOrderBy("password", "asc", ALLOWED)).toEqual({ createdAt: "asc" });
  });
});

const mockRequest = (overrides: Partial<Request> = {}): Request =>
  ({ body: {}, query: {}, ...overrides }) as Request;

describe("parsePagination", () => {
  it("falls back to sane defaults with no query or body", () => {
    const result = parsePagination(mockRequest());

    expect(result).toMatchObject({
      page: 1,
      rows: 10,
      orderKey: "createdAt",
      orderRule: "desc",
      searchFilters: {},
      filters: {},
      skip: 0,
    });
  });

  it("reads page/rows/order straight from the query string", () => {
    const result = parsePagination(
      mockRequest({ query: { page: "3", rows: "20", orderKey: "name", orderRule: "asc" } })
    );

    expect(result.page).toBe(3);
    expect(result.rows).toBe(20);
    expect(result.orderKey).toBe("name");
    expect(result.orderRule).toBe("asc");
    expect(result.skip).toBe(40); // (3 - 1) * 20
  });

  it("reads params from body.params as a URL-encoded string (frontend's legacy shape)", () => {
    const params = new URLSearchParams({
      page: "2",
      rows: "5",
      searchFilters: JSON.stringify({ name: "sari" }),
      filters: JSON.stringify({ tanggal: "2026-07-16" }),
    }).toString();

    const result = parsePagination(mockRequest({ body: { params } }));

    expect(result.page).toBe(2);
    expect(result.rows).toBe(5);
    expect(result.searchFilters).toEqual({ name: "sari" });
    expect(result.filters).toEqual({ tanggal: "2026-07-16" });
  });

  it("ignores a non-numeric page/rows and falls back to defaults", () => {
    const result = parsePagination(mockRequest({ query: { page: "abc", rows: "xyz" } }));

    expect(result.page).toBe(1);
    expect(result.rows).toBe(10);
  });

  // rows becomes Prisma's `take`, so an unbounded value is a whole-table read.
  it("caps rows at the maximum instead of trusting the client", () => {
    expect(parsePagination(mockRequest({ query: { rows: "999999" } })).rows).toBe(2000);
  });

  it("rejects zero and negative page/rows", () => {
    const result = parsePagination(mockRequest({ query: { page: "0", rows: "-5" } }));

    expect(result.page).toBe(1);
    expect(result.rows).toBe(10);
    expect(result.skip).toBe(0);
  });

  it("normalises an unrecognised orderRule to desc rather than passing it to Prisma", () => {
    expect(parsePagination(mockRequest({ query: { orderRule: "sideways" } })).orderRule).toBe("desc");
  });

  // Used to throw and surface as a 500.
  it("treats malformed searchFilters/filters JSON as no filter", () => {
    const result = parsePagination(
      mockRequest({ query: { searchFilters: "{not json", filters: "]nope[" } })
    );

    expect(result.searchFilters).toEqual({});
    expect(result.filters).toEqual({});
  });

  it("ignores a JSON array where an object is expected", () => {
    expect(parsePagination(mockRequest({ query: { searchFilters: "[1,2]" } })).searchFilters).toEqual({});
  });

  it("drops non-string search values that `contains` couldn't use", () => {
    const result = parsePagination(
      mockRequest({ query: { searchFilters: JSON.stringify({ name: "andi", nim: 123 }) } })
    );

    expect(result.searchFilters).toEqual({ name: "andi" });
  });
});
