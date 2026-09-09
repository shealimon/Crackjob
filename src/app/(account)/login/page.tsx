import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthFormFallback } from "@/components/loading-button";
import { LoginForm } from "./login-form";

export const metadata = { title: "Login" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 pb-20 pt-10 sm:pt-16">
      <Suspense fallback={<AuthFormFallback />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
