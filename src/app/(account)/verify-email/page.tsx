import Link from "next/link";

export const metadata = { title: "Verify email" };

export default function VerifyEmailPage() {
  return (
    <main className="grid-fade flex flex-1 items-center justify-center px-5 py-16">
      <div className="hairline w-full max-w-md rounded-3xl bg-surface p-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">Email</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em]">
          Check your inbox
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted">
          Verification is sent by <strong>Supabase Auth</strong> (your project SMTP).
          Open the link in that email — it will return here and confirm your
          account.
        </p>
        <p className="mt-6 text-sm text-muted">
          <Link href="/login" className="font-semibold text-foreground hover:text-accent">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
