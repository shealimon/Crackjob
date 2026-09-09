"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { LoadingButton } from "@/components/loading-button";
import { CrackMark } from "@/components/crack-logo";
import { useToast } from "@/components/toast";

function GoogleIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
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
  "w-full rounded-xl border border-transparent bg-[#1a1a1a] px-4 py-3.5 text-[15px] text-white outline-none placeholder:text-white/35 transition focus:border-white/15 focus:bg-[#1f1f1f] disabled:opacity-60";

export function LoginForm() {
  const params = useSearchParams();
  const { toast } = useToast();
  const callbackUrl = params.get("callbackUrl") || "/dashboard";
  const prefillEmail = params.get("email") || "";
  const justSignedUp = params.get("verified") === "0";
  const justVerified = params.get("verified") === "1";
  const resetOk = params.get("reset") === "1";
  const statusToastShown = useRef(false);

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [resending, setResending] = useState(false);
  const [needsResend, setNeedsResend] = useState(justSignedUp);

  const canSubmit = email.trim().length > 0 && password.length >= 8;

  useEffect(() => {
    if (statusToastShown.current) return;
    statusToastShown.current = true;

    if (justVerified) {
      toast("Email verified. You can sign in now.", "success");
      return;
    }
    if (justSignedUp) {
      toast(
        "Account created. Check your email for the verification link before signing in.",
      );
      return;
    }
    if (resetOk) {
      toast("Your password has been reset. Sign in with your new password.", "success");
    }
  }, [justVerified, justSignedUp, resetOk, toast]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; code?: string }
        | null;

      if (!res.ok || !data?.ok) {
        setPending(false);
        if (data?.code === "email_not_verified") {
          setNeedsResend(true);
          toast("Verify your email before signing in.", "error");
          return;
        }
        toast("Invalid email or password.", "error");
        return;
      }

      // Hard navigate once — router.push + refresh was loading /dashboard twice (2–6s each).
      window.location.assign(callbackUrl);
    } catch {
      setPending(false);
      toast("Could not start a session. Try again.", "error");
    }
  }

  async function onGoogle() {
    setGooglePending(true);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setGooglePending(false);
      toast("Google sign-in is unavailable right now.", "error");
    }
  }

  async function resendVerification() {
    if (!email.trim()) {
      toast("Enter your email first.", "error");
      return;
    }
    setResending(true);
    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await res.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    setResending(false);
    if (!res.ok) {
      toast(data?.error ?? "Could not resend verification email.", "error");
      return;
    }
    toast(data?.message ?? "Verification email sent if needed.", "success");
  }

  return (
    <div className="flex w-full max-w-[400px] flex-col items-center">
      <div className="grid size-16 place-items-center rounded-full bg-accent text-on-accent shadow-[0_0_40px_rgb(154_107_69_/_0.28)]">
        <CrackMark className="size-8" />
      </div>

      <h1 className="mt-7 text-center font-display text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[32px]">
        Log in
      </h1>

      <div className="mt-8 w-full space-y-3">
        <LoadingButton
          type="button"
          loading={googlePending}
          loadingText="Redirecting…"
          onClick={() => void onGoogle()}
          disabled={pending}
          className="w-full rounded-xl bg-[#1a1a1a] px-5 py-3.5 text-[15px] font-medium text-white transition hover:bg-[#222] disabled:opacity-60"
        >
          <GoogleIcon />
          Google
        </LoadingButton>

        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-white/10" />
          <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.12em] text-white/35">
            Or continue with email
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="Email address"
            value={email}
            disabled={pending || googlePending}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
          />
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            minLength={8}
            placeholder="Password"
            value={password}
            disabled={pending || googlePending}
            onChange={(event) => setPassword(event.target.value)}
            className={fieldClass}
          />

          <LoadingButton
            type="submit"
            loading={pending}
            loadingText="Signing in…"
            disabled={!canSubmit || googlePending}
            className={`w-full rounded-xl px-5 py-3.5 text-[15px] font-semibold transition disabled:cursor-not-allowed ${
              canSubmit
                ? "btn-meet"
                : "border border-transparent bg-[#2a2a2a] text-white/40"
            }`}
          >
            Sign in
          </LoadingButton>
        </form>

        {needsResend ? (
          <LoadingButton
            type="button"
            loading={resending}
            loadingText="Sending…"
            onClick={() => void resendVerification()}
            className="w-full rounded-xl border border-white/12 px-5 py-3.5 text-[15px] text-white/80 transition hover:border-white/25 hover:text-white disabled:opacity-60"
          >
            Resend verification email
          </LoadingButton>
        ) : null}

        <Link
          href="/signup"
          className="flex w-full items-center justify-center rounded-xl border border-white/12 px-5 py-3.5 text-[15px] text-white/85 transition hover:border-white/25 hover:bg-white/[0.03]"
        >
          Don&apos;t have an account? Sign up →
        </Link>

        <p className="pt-1 text-center">
          <Link
            href="/forgot-password"
            className="text-[14px] text-white/45 transition hover:text-white/75"
          >
            Forgot Password?
          </Link>
        </p>
      </div>
    </div>
  );
}
