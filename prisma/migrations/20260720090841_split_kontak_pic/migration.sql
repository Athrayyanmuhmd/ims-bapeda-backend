-- Add the new structured columns
ALTER TABLE "Instansi" ADD COLUMN "namaPic" TEXT;
ALTER TABLE "Instansi" ADD COLUMN "noHpPic" TEXT;

-- Backfill from the old "Nama - No. HP" free-text convention
UPDATE "Instansi"
SET
  "namaPic" = TRIM(SPLIT_PART("kontakPic", '-', 1)),
  "noHpPic" = NULLIF(TRIM(SPLIT_PART("kontakPic", '-', 2)), '')
WHERE "kontakPic" IS NOT NULL;

-- Drop the old combined column
ALTER TABLE "Instansi" DROP COLUMN "kontakPic";
