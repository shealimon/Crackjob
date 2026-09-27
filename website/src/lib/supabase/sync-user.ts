import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { displayNameFromProfile, ensureUserBundle } from "@/lib/user-bundle";

export type SyncedAuthUser = {
  id: string;
  email: string;
  name: string | null;
};

async function profileDisplayName(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { firstName: true, lastName: true },
  });
  return displayNameFromProfile(profile);
}

async function upsertProfileFirstName(userId: string, firstName: string | null) {
  if (!firstName) return;
  const existing = await prisma.profile.findUnique({
    where: { userId },
    select: { firstName: true },
  });
  if (existing?.firstName?.trim()) return;
  await prisma.profile.upsert({
    where: { userId },
    create: { userId, firstName },
    update: { firstName },
  });
}

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
      emailVerified: true,
      profile: { select: { userId: true, firstName: true, lastName: true } },
      subscription: { select: { userId: true } },
    },
  });

  if (existing) {
    const nextVerified = emailVerified ?? existing.emailVerified;
    const metaChanged =
      existing.email !== email ||
      (existing.emailVerified?.getTime() ?? null) !== (nextVerified?.getTime() ?? null);

    if (metaChanged) {
      await prisma.user.update({
        where: { id: authUser.id },
        data: {
          email,
          emailVerified: nextVerified,
        },
      });
    }

    if (!existing.profile || !existing.subscription) {
      await ensureUserBundle(authUser.id);
    }
    await upsertProfileFirstName(authUser.id, name);

    const displayName =
      displayNameFromProfile(existing.profile) || name || (await profileDisplayName(authUser.id));
    return { id: existing.id, email, name: displayName };
  }

  const byEmail = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      emailVerified: true,
      profile: { select: { userId: true, firstName: true, lastName: true } },
      subscription: { select: { userId: true } },
    },
  });

  if (byEmail && byEmail.id !== authUser.id) {
    const nextVerified = emailVerified ?? byEmail.emailVerified;
    const metaChanged =
      (byEmail.emailVerified?.getTime() ?? null) !== (nextVerified?.getTime() ?? null);

    if (metaChanged) {
      await prisma.user.update({
        where: { id: byEmail.id },
        data: { emailVerified: nextVerified },
      });
    }

    if (!byEmail.profile || !byEmail.subscription) {
      await ensureUserBundle(byEmail.id);
    }
    await upsertProfileFirstName(byEmail.id, name);

    const displayName =
      displayNameFromProfile(byEmail.profile) || name || (await profileDisplayName(byEmail.id));
    return { id: byEmail.id, email, name: displayName };
  }

  await prisma.user.create({
    data: {
      id: authUser.id,
      email,
      emailVerified,
      profile: { create: { firstName: name } },
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
