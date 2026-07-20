import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import type { Response } from "express";
import { authenticate, requireRole, AuthRequest } from "./auth";

process.env.JWT_SECRET = "test-secret";

const mockRes = () => {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

describe("authenticate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a request with no Authorization header", () => {
    const req = { headers: {} } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects an invalid/garbage token", () => {
    const req = { headers: { authorization: "Bearer not-a-real-token" } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("accepts a valid token and attaches userId + role", () => {
    const token = jwt.sign({ sub: "user-1", role: "Admin" }, process.env.JWT_SECRET!);
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe("user-1");
    expect(req.role).toBe("Admin");
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
