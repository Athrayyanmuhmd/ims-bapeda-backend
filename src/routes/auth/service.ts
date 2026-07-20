import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { success, failure } from "../../lib/serviceResult";
import * as authRepository from "./repository";

const signToken = (userId: string, role?: string) =>
  jwt.sign({ sub: userId, role }, process.env.JWT_SECRET!, { expiresIn: "7d" });

export const login = async (email: string, password: string) => {
  const user = await authRepository.findByEmailWithRole(email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return failure("Email atau password salah", 401);
  }

  if (user.status !== "active") {
    return failure("Akun tidak aktif", 403);
  }

  const token = signToken(user.id, user.role?.name);
  return success({
    user: { id: user.id, fullName: user.fullName, email: user.email, status: user.status, role: user.role?.name ?? null },
    token,
  });
};

export const verifyToken = async (token: string) => {
  let payload: { sub: string };
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string };
  } catch {
    return failure("Token tidak valid atau sudah expired", 401);
  }

  const user = await authRepository.findByIdBasic(payload.sub);
  if (!user) {
    return failure("User tidak ditemukan", 404);
  }

  return success({ user: { ...user, role: user.role?.name ?? null }, token });
};
