import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthFormFallback } from "@/components/loading-button";
import { clearStaleSession } from "@/lib/clear-session-login";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Login",
  description: "Sign in to Crackjob — your AI interview assistant account for coding rounds and live interviews.",
  alternates: { canonical: "/login" },
};

export default async function LoginPage() {
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
