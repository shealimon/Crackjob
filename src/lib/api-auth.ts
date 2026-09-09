import { auth } from "@/auth";
import { sha256 } from "@/lib/hash";
import { prisma } from "@/lib/prisma";
import { ensureUserBundle } from "@/lib/user-bundle";

export type AuthedUser = {
  userId: string;
  source: "web" | "desktop";
  sessionId?: string;
};

const DEV_EMAIL = "dev@localhost";

export function isAuthSkipped() {
  return process.env.SKIP_AUTH === "true";
}

async function ensureDevUserId() {
  let user = await prisma.user.findUnique({
    where: { email: DEV_EMAIL },
    select: { id: true },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: DEV_EMAIL,
        name: "Local Dev",
        profile: { create: {} },
        subscription: {
          create: {
            plan: "year",
            status: "active",
            startsAt: new Date(),
            endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        },
      },
      select: { id: true },
    });
  } else {
    await ensureUserBundle(user.id);
  }
  return user.id;
}

export async function requireUser(
  request: Request,
): Promise<AuthedUser | { error: string; status: number }> {
  if (isAuthSkipped()) {
    return { userId: await ensureDevUserId(), source: "desktop" };
  }

  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      return { error: "Missing desktop session token", status: 401 };
    }
    const session = await prisma.desktopSession.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!session || session.revokedAt) {
      return { error: "Desktop session is invalid or revoked", status: 401 };
    }
    return { userId: session.userId, source: "desktop", sessionId: session.id };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not signed in", status: 401 };
  }
  return { userId: session.user.id, source: "web" };
}
