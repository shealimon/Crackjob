"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { LoadingButton } from "@/components/loading-button";
import { CrackMark } from "@/components/crack-logo";
import { useToast } from "@/components/toast";

function GoogleGlyph({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

const fieldClass =
  "w-full rounded-2xl border border-transparent bg-[#1c1c1c] px-4 py-3.5 text-[15px] text-foreground outline-none placeholder:text-white/35 transition focus:border-accent/50 focus:bg-[#222]";

export function SignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length >= 8;

  async function onGoogle() {
    setGooglePending(true);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      toast("Could not continue with Google.", "error");
      setGooglePending(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const name = email.split("@")[0]?.trim() || "User";

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; needsVerification?: boolean }
        | null;

      if (!response.ok) {
        toast(
          data?.error ?? "Could not create account.",
          "error",
        );
        setPending(false);
        return;
      }

      const params = new URLSearchParams({
        verified: "0",
        email,
      });
      router.push(`/login?${params.toString()}`);
      router.refresh();
    } catch {
      toast("Could not create account.", "error");
      setPending(false);
    }
  }

  return (
    <div className="flex w-full max-w-[420px] flex-col items-center">
      <div className="grid size-16 place-items-center rounded-full bg-accent text-on-accent shadow-[0_0_40px_rgb(154_107_69_/_0.28)]">
        <CrackMark className="size-8" />
      </div>

      <h1 className="mt-7 text-center font-display text-[2rem] font-semibold tracking-[-0.04em] text-white sm:text-[2.35rem]">
        Create your account
      </h1>

      <div className="mt-8 w-full space-y-4">
        <LoadingButton
          type="button"
          loading={googlePending}
          loadingText="Connecting…"
          onClick={() => void onGoogle()}
          disabled={pending}
          className="w-full rounded-2xl bg-[#1c1c1c] px-5 py-3.5 text-[15px] font-medium text-white transition hover:bg-[#252525] disabled:opacity-60"
        >
          <GoogleGlyph />
          Google
        </LoadingButton>

        <div className="relative flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-white/10" />
          <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.14em] text-white/35">
            Or continue with email
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3.5">
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            disabled={pending || googlePending}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            className={fieldClass}
          />
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            disabled={pending || googlePending}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className={fieldClass}
          />

          <LoadingButton
            type="submit"
            loading={pending}
            loadingText="Creating account…"
            disabled={!canSubmit || googlePending}
            className={`w-full rounded-2xl px-5 py-3.5 text-[15px] font-semibold transition disabled:cursor-not-allowed ${
              canSubmit
                ? "btn-meet hover:scale-[1.01] active:scale-[0.99]"
                : "bg-[#3a3a3a] text-white/40"
            }`}
          >
            Create account
          </LoadingButton>
        </form>

        <Link
          href="/login"
          className="flex w-full items-center justify-center rounded-2xl border border-white/12 px-5 py-3.5 text-[15px] font-medium text-white/80 transition hover:border-white/25 hover:text-white"
        >
          Already have an account? Sign in →
        </Link>
      </div>
    </div>
  );
}
