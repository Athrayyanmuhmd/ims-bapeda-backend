import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import type { Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest, PESERTA_TOKEN_TYPE, STAFF_TOKEN_TYPE } from "./auth";
import { authenticatePeserta, PesertaRequest } from "./authPeserta";

vi.mock("../lib/prisma", () => ({
  default: { pesertaMagang: { findUnique: vi.fn() } },
  isUniqueViolation: vi.fn(),
}));
vi.mock("../routes/auth/repository");

process.env.JWT_SECRET = "test-secret";

const mockRes = () => {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

const token = (claims: object) => `Bearer ${jwt.sign(claims, process.env.JWT_SECRET!)}`;

const activePeserta = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "peserta-1",
  password: "hashed",
  status: "AKTIF",
  ...overrides,
});

describe("authenticatePeserta", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts a peserta token and attaches the peserta id", async () => {
    vi.mocked(prisma.pesertaMagang.findUnique).mockResolvedValue(activePeserta() as never);
    const req = { headers: { authorization: token({ sub: "peserta-1", typ: PESERTA_TOKEN_TYPE }) } } as PesertaRequest;
    const res = mockRes();
    const next = vi.fn();

    await authenticatePeserta(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.pesertaMagangId).toBe("peserta-1");
  });

  // The core isolation guarantee: staff and peserta tokens share a signing
  // secret, so only the audience claim keeps them apart.
  it("rejects a staff token", async () => {
    const req = { headers: { authorization: token({ sub: "user-1", typ: STAFF_TOKEN_TYPE, role: "Admin" }) } } as PesertaRequest;
    const res = mockRes();
    const next = vi.fn();

    await authenticatePeserta(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.pesertaMagang.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a token with no audience claim at all", async () => {
    const req = { headers: { authorization: token({ sub: "peserta-1" }) } } as PesertaRequest;
    const res = mockRes();
    const next = vi.fn();

    await authenticatePeserta(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects a request with no Authorization header", async () => {
    const req = { headers: {} } as PesertaRequest;
    const res = mockRes();
    const next = vi.fn();

    await authenticatePeserta(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // Clearing the password is how staff revoke portal access; it has to bite
  // before the 7-day token expires.
  it("rejects a peserta whose portal account was revoked", async () => {
    vi.mocked(prisma.pesertaMagang.findUnique).mockResolvedValue(
      activePeserta({ password: null }) as never
    );
    const req = { headers: { authorization: token({ sub: "peserta-1", typ: PESERTA_TOKEN_TYPE }) } } as PesertaRequest;
    const res = mockRes();
    const next = vi.fn();

    await authenticatePeserta(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects a peserta whose magang is no longer AKTIF", async () => {
    vi.mocked(prisma.pesertaMagang.findUnique).mockResolvedValue(
      activePeserta({ status: "SELESAI" }) as never
    );
    const req = { headers: { authorization: token({ sub: "peserta-1", typ: PESERTA_TOKEN_TYPE }) } } as PesertaRequest;
    const res = mockRes();
    const next = vi.fn();

    await authenticatePeserta(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects a deleted peserta", async () => {
    vi.mocked(prisma.pesertaMagang.findUnique).mockResolvedValue(null);
    const req = { headers: { authorization: token({ sub: "ghost", typ: PESERTA_TOKEN_TYPE }) } } as PesertaRequest;
    const res = mockRes();
    const next = vi.fn();

    await authenticatePeserta(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

// The other direction of the same guarantee.
describe("authenticate (staff) rejects peserta tokens", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses a peserta token before it ever reaches the user lookup", async () => {
    const req = { headers: { authorization: token({ sub: "peserta-1", typ: PESERTA_TOKEN_TYPE }) } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(req.userId).toBeUndefined();
  });
});
