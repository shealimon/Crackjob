import { Suspense } from "react";
import { AuthFormFallback } from "@/components/loading-button";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <main className="grid-fade flex flex-1 items-center justify-center px-5 py-16">
      <Suspense fallback={<AuthFormFallback />}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
