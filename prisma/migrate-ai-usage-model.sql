-- AiUsage: mode → model (store AI model id), drop unused status.
-- Safe to re-run.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AiUsage' AND column_name = 'mode'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AiUsage' AND column_name = 'model'
  ) THEN
    ALTER TABLE "AiUsage" RENAME COLUMN "mode" TO "model";
  END IF;
END $$;

ALTER TABLE "AiUsage" ADD COLUMN IF NOT EXISTS "model" TEXT;

UPDATE "AiUsage"
SET "model" = COALESCE(NULLIF(TRIM("model"), ''), 'unknown')
WHERE "model" IS NULL OR TRIM("model") = '';

ALTER TABLE "AiUsage" ALTER COLUMN "model" SET NOT NULL;

ALTER TABLE "AiUsage" DROP COLUMN IF EXISTS "status";
