import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// A unique-constraint hit is a user-fixable conflict (e.g. absensi already
// recorded for that peserta on that date), not a server fault — callers turn it
// into a 409 instead of letting it bubble up as a 500.
export const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

export default prisma;
