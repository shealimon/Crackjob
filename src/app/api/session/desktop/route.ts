import { requireUser } from "@/lib/api-auth";
import { json, optionsCors } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export function OPTIONS() {
  return optionsCors();
}

export async function DELETE(request: Request) {
  const authed = await requireUser(request);
  if ("error" in authed) {
    return json({ error: authed.error }, { status: authed.status });
  }

  await prisma.desktopSession.updateMany({
    where: { userId: authed.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return json({ ok: true });
}
