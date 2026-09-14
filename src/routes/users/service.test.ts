import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { buildSearchWhere } from "../../lib/pagination";
import * as userRepository from "./repository";
import * as userService from "./service";

vi.mock("./repository");
vi.mock("bcryptjs");

describe("users service — changeOwnPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  const withStoredHash = () =>
    vi.mocked(userRepository.findWithPassword).mockResolvedValue({
      id: "user-1",
      password: "stored-hash",
    } as never);

  it("rejects a new password shorter than the minimum", async () => {
    const result = await userService.changeOwnPassword("user-1", "current-pass", "short");

    expect(result.ok).toBe(false);
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it("rejects reusing the current password", async () => {
    const result = await userService.changeOwnPassword("user-1", "samepassword", "samepassword");

    expect(result.ok).toBe(false);
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  // A stolen session cookie must not be enough to take the account over.
  it("rejects a wrong current password without writing anything", async () => {
    withStoredHash();
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const result = await userService.changeOwnPassword("user-1", "wrong-pass", "newpassword123");

    expect(result).toEqual({ ok: false, message: "Password saat ini salah", status: 401 });
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it("fails with 404 when the user no longer exists", async () => {
    vi.mocked(userRepository.findWithPassword).mockResolvedValue(null);

    const result = await userService.changeOwnPassword("ghost", "current-pass", "newpassword123");

    expect(result).toEqual({ ok: false, message: "User tidak ditemukan", status: 404 });
  });

  it("stores a hash, never the plaintext, on success", async () => {
    withStoredHash();
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(bcrypt.hash).mockResolvedValue("new-hash" as never);
    vi.mocked(userRepository.update).mockResolvedValue({ fullName: "Administrator" } as never);

    const result = await userService.changeOwnPassword("user-1", "current-pass", "newpassword123");

    expect(result.ok).toBe(true);
    expect(bcrypt.hash).toHaveBeenCalledWith("newpassword123", 10);
    expect(userRepository.update).toHaveBeenCalledWith("user-1", { password: "new-hash" });
  });
});

describe("users service — list search surface", () => {
  beforeEach(() => vi.clearAllMocks());

  // Guards the actual vulnerability: password must never reach the where clause,
  // however the request phrases it.
  it("never lets a password filter through to Prisma", async () => {
    vi.mocked(userRepository.findMany).mockResolvedValue([]);
    vi.mocked(userRepository.count).mockResolvedValue(0);

    await userService.listUsers({
      skip: 0,
      rows: 10,
      orderKey: "password",
      orderRule: "asc",
      searchFilters: { password: "$2a$10$" },
    });

    const [where, , , orderBy] = vi.mocked(userRepository.findMany).mock.calls[0];
    expect(where).toEqual({});
    expect(orderBy).toEqual({ createdAt: "asc" });
  });

  it("still searches the fields the UI actually uses", async () => {
    vi.mocked(userRepository.findMany).mockResolvedValue([]);
    vi.mocked(userRepository.count).mockResolvedValue(0);

    await userService.listUsers({
      skip: 0,
      rows: 10,
      orderKey: "fullName",
      orderRule: "asc",
      searchFilters: { fullName: "admin" },
    });

    const [where] = vi.mocked(userRepository.findMany).mock.calls[0];
    expect(where).toEqual(buildSearchWhere({ fullName: "admin" }, ["fullName"]));
  });
});
