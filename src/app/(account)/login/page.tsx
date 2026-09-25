import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthFormFallback } from "@/components/loading-button";
import { clearStaleSession } from "@/lib/clear-session-login";
import { hasSessionCookie } from "@/lib/has-session-cookie";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, SEO_SHARE_IMAGE } from "@/lib/seo";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Login",
  description: "Sign in to your Crackjob account to use the AI interview assistant.",
  alternates: { canonical: absoluteUrl("/login") },
  openGraph: {
    url: absoluteUrl("/login"),
    images: [SEO_SHARE_IMAGE],
  },
};

export default async function LoginPage() {
  // No cookie: send the form immediately. JWT + DB only when a session exists.
  if (await hasSessionCookie()) {
    const session = await auth();
    const userId = session?.user?.id?.trim();
    if (userId) {
      const exists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (exists) {
        redirect("/dashboard");
      }
      // Deleted/missing user — clear stale JWT and show login (no error).
      await clearStaleSession();
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5">
      <div className="flex min-h-full w-full flex-1 flex-col items-center justify-center py-10 sm:py-12">
        <Suspense fallback={<AuthFormFallback />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
