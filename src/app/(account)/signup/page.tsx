import { SignupForm } from "./signup-form";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 py-6">
      <SignupForm />
    </main>
  );
}
