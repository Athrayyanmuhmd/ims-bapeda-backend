import { Prisma, PrismaClient } from "@prisma/client";

// Reuse one client across warm serverless invocations. Creating a new
// PrismaClient per request against Supabase PgBouncer exhausts the pool and
// surfaces as intermittent "Terjadi kesalahan pada server" (500) on Vercel.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
} else {
  // Keep the singleton in production too (Vercel warm isolates).
  globalForPrisma.prisma = prisma;
}

// A unique-constraint hit is a user-fixable conflict (e.g. absensi already
// recorded for that peserta on that date), not a server fault — callers turn it
// into a 409 instead of letting it bubble up as a 500.
export const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/** Transient DB / pooler failures — map to 503, not a opaque 500. */
export const isDbUnavailable = (error: unknown): boolean => {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientRustPanicError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ["P1001", "P1002", "P1008", "P1017", "P2024"].includes(error.code);
  }
  if (error instanceof Error) {
    return /can't reach database|connection reset|econnrefused|etimedout|timed out|server has closed|prepared statement|max clients|too many connections|pgbouncer/i.test(
      error.message
    );
  }
  return false;
};

export default prisma;
