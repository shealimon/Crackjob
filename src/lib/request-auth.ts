import { auth } from "@/auth";
import { getDesktopSessionByToken } from "@/lib/desktop-session";
import { parseBearer } from "@/lib/tokens";

export type AuthedUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  source: "web" | "desktop";
  desktopSessionId?: string;
};

export async function getRequestUser(request: Request): Promise<AuthedUser | null> {
  const token = parseBearer(request.headers.get("authorization"));
  if (token) {
    const session = await getDesktopSessionByToken(token);
    if (!session) return null;
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: null,
      source: "desktop",
      desktopSessionId: session.id,
    };
  }

  const web = await auth();
  if (!web?.user?.id) return null;
  return {
    id: web.user.id,
    email: web.user.email,
    name: web.user.name,
    image: web.user.image,
    source: "web",
  };
}
