import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { buildSearchWhere, parsePagination } from "./pagination";

describe("buildSearchWhere", () => {
  it("returns an empty where clause when there are no filters", () => {
    expect(buildSearchWhere({})).toEqual({});
  });

  it("builds a case-insensitive OR clause for a single filter", () => {
    expect(buildSearchWhere({ name: "andi" })).toEqual({
      OR: [{ name: { contains: "andi", mode: "insensitive" } }],
    });
  });

  it("builds one OR entry per filter key", () => {
    const where = buildSearchWhere({ name: "andi", email: "andi@test.com" });
    expect(where).toEqual({
      OR: [
        { name: { contains: "andi", mode: "insensitive" } },
        { email: { contains: "andi@test.com", mode: "insensitive" } },
      ],
    });
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
});
