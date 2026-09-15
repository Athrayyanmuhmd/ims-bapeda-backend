/**
 * Soft-launch gate: confirm Kehadiran/izin/logbook unique migration is live.
 * Usage: npx ts-node scripts/verify-schema.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'Absensi'
      AND column_name IN ('kehadiran','izinStatus','izinJenis','reviewedById','reviewedAt')
    ORDER BY column_name
  `;

  const idx = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'Jurnal'
      AND indexname = 'Jurnal_pesertaMagangId_tanggal_key'
  `;

  const enums = await prisma.$queryRaw<{ typname: string }[]>`
    SELECT typname FROM pg_type WHERE typname IN ('Kehadiran','IzinStatus')
    ORDER BY typname
  `;

  const expectedCols = ["izinJenis", "izinStatus", "kehadiran", "reviewedAt", "reviewedById"];
  const colNames = cols.map((c) => c.column_name);
  const missingCols = expectedCols.filter((c) => !colNames.includes(c));
  const hasUnique = idx.length === 1;
  const hasEnums = enums.map((e) => e.typname).join(",") === "IzinStatus,Kehadiran";

  const ok = missingCols.length === 0 && hasUnique && hasEnums;

  console.log(
    JSON.stringify(
      {
        ok,
        columns: colNames,
        missingColumns: missingCols,
        jurnalUniqueIndex: hasUnique,
        enums: enums.map((e) => e.typname),
      },
      null,
      2
    )
  );

  if (!ok) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
