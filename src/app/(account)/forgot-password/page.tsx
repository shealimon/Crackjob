import { noIndexMetadata } from "@/lib/seo";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = {
  ...noIndexMetadata,
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5">
      <div className="flex min-h-full w-full flex-1 flex-col items-center justify-center py-10 sm:py-12">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
