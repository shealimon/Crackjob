-- Backfill Profile from User.name / User.mobileno / Profile.targetRole, then drop old columns.
-- Safe to re-run: uses IF EXISTS / additive column adds.

ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "mobileNo" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "jobRole" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "currentCompany" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "yearsOfExperience" DOUBLE PRECISION;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "linkedinUrl" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "currentLocation" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "preferredLocations" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "preferredStack" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "resumeFileName" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "resumeFilePath" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "resumeMimeType" TEXT;

-- Ensure every user has a profile row before backfill.
INSERT INTO "Profile" ("id", "userId", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text), u."id", NOW(), NOW()
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "Profile" p WHERE p."userId" = u."id");

-- Move User.name → Profile.firstName (keep full string in firstName).
UPDATE "Profile" p
SET
  "firstName" = COALESCE(p."firstName", NULLIF(TRIM(u."name"), '')),
  "mobileNo" = COALESCE(p."mobileNo", NULLIF(TRIM(u."mobileno"), '')),
  "updatedAt" = NOW()
FROM "User" u
WHERE p."userId" = u."id"
  AND (
    (p."firstName" IS NULL AND u."name" IS NOT NULL AND TRIM(u."name") <> '')
    OR (p."mobileNo" IS NULL AND u."mobileno" IS NOT NULL AND TRIM(u."mobileno") <> '')
  );

-- Rename targetRole → jobRole when jobRole empty.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Profile' AND column_name = 'targetRole'
  ) THEN
    UPDATE "Profile"
    SET "jobRole" = COALESCE("jobRole", NULLIF(TRIM("targetRole"), '')),
        "updatedAt" = NOW()
    WHERE "jobRole" IS NULL AND "targetRole" IS NOT NULL AND TRIM("targetRole") <> '';

    ALTER TABLE "Profile" DROP COLUMN "targetRole";
  END IF;
END $$;

ALTER TABLE "User" DROP COLUMN IF EXISTS "name";
ALTER TABLE "User" DROP COLUMN IF EXISTS "mobileno";
