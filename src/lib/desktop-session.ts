import { prisma } from "@/lib/prisma";
import { newToken, sha256 } from "@/lib/hash";
import { getAccessSnapshot } from "@/lib/access";

export async function createDesktopSession(options: {
  userId: string;
  deviceId?: string;
  platform?: string;
}) {
  const sessionToken = newToken();
  const tokenHash = sha256(sessionToken);
  const deviceName = `${options.platform || "Windows"}${
    options.deviceId ? ` · ${options.deviceId.slice(0, 8)}` : ""
  }`;

  await prisma.$transaction(async (tx) => {
    await tx.desktopSession.updateMany({
      where: { userId: options.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.desktopSession.create({
      data: {
        userId: options.userId,
        tokenHash,
        deviceName,
      },
    });
  });

  return { token: sessionToken };
}

export async function getActiveDesktopSession(userId: string) {
  return prisma.desktopSession.findFirst({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDesktopSessionByToken(token: string) {
  return prisma.desktopSession.findFirst({
    where: { tokenHash: sha256(token), revokedAt: null },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });
}

export async function userPublicPayload(userId: string) {
  if (!userId?.trim()) return null;

  const [user, access] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    }),
    getAccessSnapshot(userId),
  ]);
  if (!user) return null;
  return {
    ...user,
    image: null,
    plan: access.plan,
    planStatus: access.status,
    endsAt: access.endsAt?.toISOString() ?? null,
    fullAccess: access.fullAccess,
    exploreRemaining: access.exploreRemaining,
    solvesToday: access.solvesToday,
    answerTier: access.answerTier,
    // Desktop UI still reads this field — map explore remaining for free.
    creditBalance: access.fullAccess ? 999_999 : (access.exploreRemaining ?? 0),
    creditsLow:
      !access.fullAccess &&
      (access.answerTier === "partial" ||
        access.answerTier === "blocked" ||
        (access.exploreRemaining ?? 0) <= 1),
  };
}
