import { prisma } from "@/lib/prisma";

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
