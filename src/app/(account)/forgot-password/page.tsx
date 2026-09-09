import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-20">
      <ForgotPasswordForm />
    </main>
  );
}
