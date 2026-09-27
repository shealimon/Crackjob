import { json, optionsCors } from "@/lib/http";
import { requireUser } from "@/lib/api-auth";
import { userPublicPayload } from "@/lib/desktop-session";
import { planLabel } from "@/lib/plans";
import {
  PROFILE_SELECT,
  profileUpdateSchema,
  toPublicProfile,
} from "@/lib/profile";
import { prisma } from "@/lib/prisma";

export function OPTIONS() {
  return optionsCors();
}

export async function GET(request: Request) {
  const authed = await requireUser(request);
  if ("error" in authed) {
    return json({ error: authed.error }, { status: authed.status });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: authed.userId },
    select: PROFILE_SELECT,
  });

  return json({ profile: toPublicProfile(profile) });
}

export async function PATCH(request: Request) {
  const authed = await requireUser(request);
  if ("error" in authed) {
    return json({ error: authed.error }, { status: authed.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: parsed.error.issues[0]?.message ?? "Invalid profile data" },
      { status: 400 },
    );
  }

  const data = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined),
  );

  if (Object.keys(data).length === 0) {
    return json({ error: "No profile fields to update" }, { status: 400 });
  }

  const profile = await prisma.profile.upsert({
    where: { userId: authed.userId },
    create: { userId: authed.userId, ...data },
    update: data,
    select: PROFILE_SELECT,
  });

  const user = await userPublicPayload(authed.userId, { fresh: true });
  if (!user) {
    return json({ error: "Not signed in" }, { status: 401 });
  }

  return json({
    user: {
      ...user,
      planLabel: planLabel(user.plan),
    },
    profile: toPublicProfile(profile),
  });
}
