import { json, optionsCors } from "@/lib/http";
import { requireUser } from "@/lib/api-auth";
import {
  getActiveDesktopSession,
  userPublicPayload,
} from "@/lib/desktop-session";

export function OPTIONS() {
  return optionsCors();
}

export async function GET(request: Request) {
  const authed = await requireUser(request);
  if ("error" in authed) {
    return json({ error: authed.error }, { status: authed.status });
  }

  const user = await userPublicPayload(authed.userId);
  if (!user) {
    return json({ error: "User not found" }, { status: 404 });
  }

  const desktop = await getActiveDesktopSession(user.id);
  return json({
    ...user,
    source: authed.source,
    desktopSession: desktop
      ? {
          id: desktop.id,
          deviceName: desktop.deviceName,
          lastSeenAt: desktop.lastSeenAt,
          createdAt: desktop.createdAt,
        }
      : null,
  });
}
