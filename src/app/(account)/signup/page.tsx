import { auth } from "@/auth";
import { clearStaleSession } from "@/lib/clear-session-login";
import { prisma } from "@/lib/prisma";
import { SignupForm } from "./signup-form";

export const metadata = {
  title: "Sign up",
  description:
    "Create a Crackjob account — AI interview application for DSA, system design, and live coding interviews.",
  alternates: { canonical: "/signup" },
};

export default async function SignupPage() {
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

  return (
    <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 py-6">
      <SignupForm />
    </main>
  );
}
