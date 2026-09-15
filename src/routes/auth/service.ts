import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { success, failure } from "../../lib/serviceResult";
import { PESERTA_TOKEN_TYPE, STAFF_TOKEN_TYPE } from "../../middleware/auth";
import * as authRepository from "./repository";

// `typ` marks the audience. Both staff and peserta tokens are signed with the
// same secret, so without it a peserta token would be a structurally valid staff
// token. See STAFF_TOKEN_TYPE / PESERTA_TOKEN_TYPE in middleware/auth.
const signToken = (userId: string, role?: string) =>
  jwt.sign({ sub: userId, role, typ: STAFF_TOKEN_TYPE }, process.env.JWT_SECRET!, {
    expiresIn: "7d",
  });

export const login = async (email: string, password: string) => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    return failure("Konfigurasi server tidak lengkap (JWT_SECRET)", 500);
  }

  try {
    const user = await authRepository.findByEmailWithRole(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return failure("Email atau password salah", 401);
    }

    if (user.status !== "active") {
      return failure("Akun tidak aktif", 403);
    }

    const token = signToken(user.id, user.role?.name);
    return success({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        status: user.status,
        role: user.role?.name ?? null,
      },
      token,
    });
  } catch (error) {
    console.error("[auth.login]", error);
    // Supabase free-tier pause / bad DATABASE_URL usually lands here.
    return failure("Tidak dapat mengakses database. Coba lagi atau cek status database.", 503);
  }
};

export const verifyToken = async (token: string) => {
  let payload: { sub: string; typ?: string };
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string; typ?: string };
  } catch {
    return failure("Token tidak valid atau sudah expired", 401);
  }

  // Reject portal tokens explicitly. Legacy staff tokens may omit typ; anything
  // else (including "peserta") is not a staff session.
  if (payload.typ === PESERTA_TOKEN_TYPE) {
    return failure("Token tidak valid atau sudah expired", 401);
  }
  if (payload.typ !== undefined && payload.typ !== STAFF_TOKEN_TYPE) {
    return failure("Token tidak valid atau sudah expired", 401);
  }

  const user = await authRepository.findByIdBasic(payload.sub);
  if (!user) {
    return failure("Token tidak valid atau sudah expired", 401);
  }

  if (user.status !== "active") {
    return failure("Akun tidak aktif", 403);
  }

  return success({
    user: { ...user, role: user.role?.name ?? null },
    token,
  });
};
