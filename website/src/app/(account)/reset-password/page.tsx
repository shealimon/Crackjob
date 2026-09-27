import { Suspense } from "react";
import { AuthFormFallback } from "@/components/loading-button";
import { noIndexMetadata } from "@/lib/seo";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = {
  ...noIndexMetadata,
  title: "Reset password",
};

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5">
      <div className="flex min-h-full w-full flex-1 flex-col items-center justify-center py-10 sm:py-12">
        <Suspense fallback={<AuthFormFallback />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
