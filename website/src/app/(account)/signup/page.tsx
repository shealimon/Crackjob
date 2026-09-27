import { auth } from "@/auth";
import { clearStaleSession } from "@/lib/clear-session-login";
import { hasSessionCookie } from "@/lib/has-session-cookie";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, SEO_SHARE_IMAGE } from "@/lib/seo";
import { SignupForm } from "./signup-form";

export const metadata = {
  title: "Sign up",
  description: "Create a Crackjob account to use the AI interview assistant for live interviews.",
  alternates: { canonical: absoluteUrl("/signup") },
  openGraph: {
    url: absoluteUrl("/signup"),
    images: [SEO_SHARE_IMAGE],
  },
};

export default async function SignupPage() {
  // No cookie: send the form immediately. Only a real session cookie is checked.
  if (await hasSessionCookie()) {
    const session = await auth();
    const userId = session?.user?.id?.trim();
    if (userId) {
      const exists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      // Always show signup — only clear a stale cookie if DB user was deleted.
      if (!exists) {
        await clearStaleSession();
      }
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5">
      <div className="flex min-h-full w-full flex-1 flex-col items-center justify-center py-10 sm:py-12">
        <SignupForm />
      </div>
    </main>
  );
}
