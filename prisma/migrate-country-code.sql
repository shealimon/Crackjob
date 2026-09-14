-- Add country code for mobile numbers (default India +91).
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "countryCode" TEXT NOT NULL DEFAULT '+91';
