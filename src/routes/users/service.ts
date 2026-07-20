import bcrypt from "bcryptjs";
import { buildSearchWhere, PaginationParams } from "../../lib/pagination";
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

export const listUsers = async ({ skip, rows, orderKey, orderRule, searchFilters }: PaginationParams) => {
  const where = buildSearchWhere(searchFilters);

  const [users, totalData] = await Promise.all([
    userRepository.findMany(where, skip, rows, { [orderKey]: orderRule }),
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

export const deleteUser = async (id: string) => {
  const exists = await userRepository.findById(id);
  if (!exists) return failure("User tidak ditemukan", 404);

  await userRepository.remove(id);
  return success(null);
};
