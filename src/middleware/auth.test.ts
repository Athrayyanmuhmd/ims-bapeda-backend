import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import type { Response } from "express";
import * as authRepository from "../routes/auth/repository";
import { authenticate, requireRole, pembimbingScope, AuthRequest } from "./auth";

vi.mock("../routes/auth/repository");

process.env.JWT_SECRET = "test-secret";

const mockRes = () => {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

const dbUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "user-1",
  fullName: "Administrator",
  email: "admin@bapeda.go.id",
  status: "active",
  role: { name: "Admin" },
  ...overrides,
});

const bearer = (claims: object) => `Bearer ${jwt.sign(claims, process.env.JWT_SECRET!)}`;

describe("authenticate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a request with no Authorization header", async () => {
    const req = { headers: {} } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects an invalid/garbage token without touching the database", async () => {
    const req = { headers: { authorization: "Bearer not-a-real-token" } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(authRepository.findByIdBasic).not.toHaveBeenCalled();
  });

  it("accepts a valid token and attaches userId + role", async () => {
    vi.mocked(authRepository.findByIdBasic).mockResolvedValue(dbUser() as never);
    const req = { headers: { authorization: bearer({ sub: "user-1", role: "Admin" }) } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe("user-1");
    expect(req.role).toBe("Admin");
  });

  // The two regressions that motivated reading the user on every request: a
  // 7-day token used to keep whatever role/status it was minted with.
  it("uses the current role from the database, not the role baked into the token", async () => {
    vi.mocked(authRepository.findByIdBasic).mockResolvedValue(
      dbUser({ role: { name: "Pembimbing" } }) as never
    );
    const req = { headers: { authorization: bearer({ sub: "user-1", role: "Admin" }) } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.role).toBe("Pembimbing");
  });

  it("rejects a still-valid token whose account has been deactivated", async () => {
    vi.mocked(authRepository.findByIdBasic).mockResolvedValue(dbUser({ status: "inactive" }) as never);
    const req = { headers: { authorization: bearer({ sub: "user-1", role: "Admin" }) } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects a valid token whose user has been deleted", async () => {
    vi.mocked(authRepository.findByIdBasic).mockResolvedValue(null);
    const req = { headers: { authorization: bearer({ sub: "ghost" }) } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("leaves role undefined when the user has no role assigned", async () => {
    vi.mocked(authRepository.findByIdBasic).mockResolvedValue(dbUser({ role: null }) as never);
    const req = { headers: { authorization: bearer({ sub: "user-1" }) } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.role).toBeUndefined();
  });
});

describe("requireRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks a request with no role on it", () => {
    const req = {} as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requireRole("Admin")(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("blocks a role that isn't in the allowed list", () => {
    const req = { role: "Pembimbing" } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requireRole("Admin")(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows a role that matches", () => {
    const req = { role: "Admin" } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requireRole("Admin")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows any role in a multi-role list", () => {
    const req = { role: "Pembimbing" } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requireRole("Admin", "Pembimbing")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});

describe("pembimbingScope", () => {
  it("returns undefined for Admin so nothing is filtered", () => {
    expect(pembimbingScope({ role: "Admin", userId: "user-1" } as AuthRequest)).toBeUndefined();
  });

  it("scopes a Pembimbing to their own id", () => {
    expect(pembimbingScope({ role: "Pembimbing", userId: "user-2" } as AuthRequest)).toBe("user-2");
  });

  // Deny-by-default: an unrecognised or role-less account must not fall through
  // to "no filter", which would hand it the full Admin view.
  it("scopes any other role to their own id rather than returning undefined", () => {
    expect(pembimbingScope({ role: "User", userId: "user-3" } as AuthRequest)).toBe("user-3");
    expect(pembimbingScope({ userId: "user-4" } as AuthRequest)).toBe("user-4");
  });
});
