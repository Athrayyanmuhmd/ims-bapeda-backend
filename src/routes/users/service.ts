import bcrypt from "bcryptjs";
import { buildOrderBy, buildSearchWhere, PaginationParams } from "../../lib/pagination";
import { success, failure } from "../../lib/serviceResult";
import * as userRepository from "./repository";

type UserWithRelations = Awaited<ReturnType<typeof userRepository.findById>>;

const present = (u: NonNullable<UserWithRelations>) => ({
  ...u,
  name: u.fullName,
  divisi: u.divisi?.name ?? null,
  divisiId: u.divisi?.id ?? null,
  role: u.role?.name ?? null,
  roleId: u.role?.id ?? null,
});

// Never add `password` here — see buildSearchWhere for why that would be a hash
// disclosure oracle rather than a search feature.
const SEARCHABLE = ["fullName", "email"] as const;
const SORTABLE = ["fullName", "email", "status", "createdAt"] as const;

export const listUsers = async ({ skip, rows, orderKey, orderRule, searchFilters }: PaginationParams) => {
  const where = buildSearchWhere(searchFilters, SEARCHABLE);

  const [users, totalData] = await Promise.all([
    userRepository.findMany(where, skip, rows, buildOrderBy(orderKey, orderRule, SORTABLE)),
    userRepository.count(where),
  ]);

  const entries = users.map(present);
  return success({ entries, totalData, totalPage: Math.ceil(totalData / rows) });
};

export const getUserDetail = async (id: string) => {
  const user = await userRepository.findById(id);
  if (!user) return failure("User tidak ditemukan", 404);
  return success(present(user));
};

interface CreateUserInput {
  fullName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  divisiId?: string;
  roleId?: string;
}

export const createUser = async (input: CreateUserInput) => {
  const existing = await userRepository.findByEmail(input.email);
  if (existing) return failure("Email sudah terdaftar");

  const hashed = await bcrypt.hash(input.password, 10);
  const user = await userRepository.create({ ...input, password: hashed });
  return success({ ...user, name: user.fullName });
};

interface UpdateUserInput {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  divisiId?: string;
  roleId?: string;
  status?: string;
  password?: string;
}

export const updateUser = async (id: string, input: UpdateUserInput) => {
  const exists = await userRepository.findById(id);
  if (!exists) return failure("User tidak ditemukan", 404);

  const data: Record<string, unknown> = {};
  if (input.fullName) data.fullName = input.fullName;
  if (input.email) data.email = input.email;
  if (input.phoneNumber !== undefined) data.phoneNumber = input.phoneNumber;
  if (input.divisiId !== undefined) data.divisiId = input.divisiId;
  if (input.roleId !== undefined) data.roleId = input.roleId;
  if (input.status) data.status = input.status;
  if (input.password) data.password = await bcrypt.hash(input.password, 10);

  const user = await userRepository.update(id, data);
  return success({ ...user, name: user.fullName });
};

export const MIN_PASSWORD_LENGTH = 8;

interface UpdateOwnProfileInput {
  fullName: string;
  phoneNumber?: string | null;
  currentPassword?: string;
  newPassword?: string;
}

// Self-service name/phone (+ optional password). Target is always the session
// user — never an id from the client.
export const updateOwnProfile = async (userId: string, input: UpdateOwnProfileInput) => {
  const fullName = input.fullName.trim();
  if (!fullName) return failure("Nama wajib diisi");

  const exists = await userRepository.findById(userId);
  if (!exists) return failure("User tidak ditemukan", 404);

  const data: Record<string, unknown> = { fullName };
  if (input.phoneNumber !== undefined) {
    data.phoneNumber = input.phoneNumber?.trim() ? input.phoneNumber.trim() : null;
  }

  if (input.newPassword) {
    if (!input.currentPassword) {
      return failure("Password saat ini wajib diisi untuk mengganti password");
    }
    if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
      return failure(`Password baru minimal ${MIN_PASSWORD_LENGTH} karakter`);
    }
    if (input.newPassword === input.currentPassword) {
      return failure("Password baru harus berbeda dari password saat ini");
    }

    const withHash = await userRepository.findWithPassword(userId);
    if (!withHash) return failure("User tidak ditemukan", 404);
    if (!(await bcrypt.compare(input.currentPassword, withHash.password))) {
      return failure("Password saat ini salah", 401);
    }
    data.password = await bcrypt.hash(input.newPassword, 10);
  }

  const user = await userRepository.update(userId, data);
  return success(present(user));
};

// Self-service, so it verifies the current password rather than trusting the
// session alone — a stolen cookie shouldn't be enough to lock the real owner out.
export const changeOwnPassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
) => {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return failure(`Password baru minimal ${MIN_PASSWORD_LENGTH} karakter`);
  }

  if (newPassword === currentPassword) {
    return failure("Password baru harus berbeda dari password saat ini");
  }

  // findByEmail-style raw read: userRepository.findById strips the hash.
  const user = await userRepository.findWithPassword(userId);
  if (!user) return failure("User tidak ditemukan", 404);

  if (!(await bcrypt.compare(currentPassword, user.password))) {
    return failure("Password saat ini salah", 401);
  }

  await userRepository.update(userId, { password: await bcrypt.hash(newPassword, 10) });
  return success(null);
};

export const deleteUser = async (id: string) => {
  const exists = await userRepository.findById(id);
  if (!exists) return failure("User tidak ditemukan", 404);

  await userRepository.remove(id);
  return success(null);
};
