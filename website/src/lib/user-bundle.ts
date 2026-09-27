import { prisma } from "@/lib/prisma";

export function displayNameFromProfile(
  profile: { firstName?: string | null; lastName?: string | null } | null | undefined,
) {
  if (!profile) return null;
  const full = [profile.firstName, profile.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return full || null;
}

export async function ensureUserBundle(userId: string) {
  await prisma.$transaction([
    prisma.profile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    }),
    prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: "free",
        status: "active",
        startsAt: new Date(),
        endsAt: null,
      },
      update: {},
    }),
  ]);
}
