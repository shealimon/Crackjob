import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { ensureUserBundle } from "@/lib/user-bundle";

export type SyncedAuthUser = {
  id: string;
  email: string;
  name: string | null;
};

export async function syncPrismaUserFromSupabase(
  authUser: SupabaseUser,
  options?: { name?: string | null },
): Promise<SyncedAuthUser> {
  const email = authUser.email?.toLowerCase();
  if (!email) {
    throw new Error("Supabase user has no email");
  }

  const name =
    options?.name?.trim() ||
    (typeof authUser.user_metadata?.name === "string"
      ? authUser.user_metadata.name
      : null) ||
    null;

  const emailVerified = authUser.email_confirmed_at
    ? new Date(authUser.email_confirmed_at)
    : null;

  const existing = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      profile: { select: { userId: true } },
      subscription: { select: { userId: true } },
    },
  });

  if (existing) {
    const nextName = name ?? existing.name;
    const nextVerified = emailVerified ?? existing.emailVerified;
    const metaChanged =
      existing.email !== email ||
      existing.name !== nextName ||
      (existing.emailVerified?.getTime() ?? null) !== (nextVerified?.getTime() ?? null);

    if (metaChanged) {
      await prisma.user.update({
        where: { id: authUser.id },
        data: {
          email,
          name: nextName,
          emailVerified: nextVerified,
        },
      });
    }

    if (!existing.profile || !existing.subscription) {
      await ensureUserBundle(authUser.id);
    }

    return { id: existing.id, email, name: nextName };
  }

  const byEmail = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      emailVerified: true,
      profile: { select: { userId: true } },
      subscription: { select: { userId: true } },
    },
  });

  if (byEmail && byEmail.id !== authUser.id) {
    // Legacy Prisma row — re-link by updating id is hard; prefer email match update metadata.
    const nextName = name ?? byEmail.name;
    const nextVerified = emailVerified ?? byEmail.emailVerified;
    const metaChanged =
      byEmail.name !== nextName ||
      (byEmail.emailVerified?.getTime() ?? null) !== (nextVerified?.getTime() ?? null);

    if (metaChanged) {
      await prisma.user.update({
        where: { id: byEmail.id },
        data: {
          emailVerified: nextVerified,
          name: nextName,
        },
      });
    }

    if (!byEmail.profile || !byEmail.subscription) {
      await ensureUserBundle(byEmail.id);
    }

    return { id: byEmail.id, email, name: nextName };
  }

  await prisma.user.create({
    data: {
      id: authUser.id,
      email,
      name,
      emailVerified,
      profile: { create: {} },
      subscription: {
        create: {
          plan: "free",
          status: "active",
          startsAt: new Date(),
          endsAt: null,
        },
      },
    },
  });

  return { id: authUser.id, email, name };
}
