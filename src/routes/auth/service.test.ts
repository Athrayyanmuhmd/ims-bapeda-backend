import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import * as authRepository from "./repository";
import * as authService from "./service";

vi.mock("./repository");
vi.mock("bcryptjs");

process.env.JWT_SECRET = "test-secret";

const fakeUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "user-1",
  fullName: "Administrator",
  email: "admin@bapeda.go.id",
  password: "hashed-password",
  status: "active",
  role: { name: "Admin" },
  ...overrides,
});

describe("auth service — login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fails when no user has that email", async () => {
    vi.mocked(authRepository.findByEmailWithRole).mockResolvedValue(null);

    const result = await authService.login("nobody@bapeda.go.id", "whatever");

    expect(result).toEqual({ ok: false, message: "Email atau password salah", status: 401 });
  });

  it("fails when the password doesn't match the hash", async () => {
    vi.mocked(authRepository.findByEmailWithRole).mockResolvedValue(fakeUser() as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const result = await authService.login("admin@bapeda.go.id", "wrong-password");

    expect(result).toEqual({ ok: false, message: "Email atau password salah", status: 401 });
  });

  it("fails when the account is inactive, even with a correct password", async () => {
    vi.mocked(authRepository.findByEmailWithRole).mockResolvedValue(
      fakeUser({ status: "inactive" }) as never
    );
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = await authService.login("admin@bapeda.go.id", "admin123");

    expect(result).toEqual({ ok: false, message: "Akun tidak aktif", status: 403 });
  });

  it("succeeds and returns a signed token carrying the role", async () => {
    vi.mocked(authRepository.findByEmailWithRole).mockResolvedValue(fakeUser() as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = await authService.login("admin@bapeda.go.id", "admin123");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");

    expect(result.data.user).toMatchObject({
      id: "user-1",
      fullName: "Administrator",
      email: "admin@bapeda.go.id",
      status: "active",
      role: "Admin",
    });

    const decoded = jwt.verify(result.data.token, process.env.JWT_SECRET!) as { sub: string; role: string };
    expect(decoded.sub).toBe("user-1");
    expect(decoded.role).toBe("Admin");
  });

  it("defaults role to null when the user has none assigned", async () => {
    vi.mocked(authRepository.findByEmailWithRole).mockResolvedValue(
      fakeUser({ role: null }) as never
    );
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = await authService.login("admin@bapeda.go.id", "admin123");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.data.user.role).toBeNull();
  });
});

describe("auth service — verifyToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fails on a garbage token", async () => {
    const result = await authService.verifyToken("not-a-real-token");
    expect(result).toEqual({ ok: false, message: "Token tidak valid atau sudah expired", status: 401 });
  });

  it("fails when the token is valid but the user no longer exists", async () => {
    const token = jwt.sign({ sub: "ghost" }, process.env.JWT_SECRET!);
    vi.mocked(authRepository.findByIdBasic).mockResolvedValue(null);

    const result = await authService.verifyToken(token);

    expect(result).toEqual({
      ok: false,
      message: "Token tidak valid atau sudah expired",
      status: 401,
    });
  });

  it("succeeds for a valid token with an existing user", async () => {
    const token = jwt.sign({ sub: "user-1" }, process.env.JWT_SECRET!);
    vi.mocked(authRepository.findByIdBasic).mockResolvedValue(fakeUser() as never);

    const result = await authService.verifyToken(token);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.data.user.role).toBe("Admin");
  });
});
