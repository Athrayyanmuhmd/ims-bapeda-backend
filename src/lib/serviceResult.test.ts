import { describe, expect, it } from "vitest";
import { failure, success } from "./serviceResult";

describe("success", () => {
  it("wraps data in an ok result", () => {
    expect(success({ id: "1" })).toEqual({ ok: true, data: { id: "1" } });
  });

  it("passes through null data", () => {
    expect(success(null)).toEqual({ ok: true, data: null });
  });
});

describe("failure", () => {
  it("defaults to no status", () => {
    expect(failure("Not found")).toEqual({ ok: false, message: "Not found", status: undefined });
  });

  it("carries an explicit status", () => {
    expect(failure("Not found", 404)).toEqual({ ok: false, message: "Not found", status: 404 });
  });
});
