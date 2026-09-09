"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CrackMark } from "@/components/crack-logo";
import { LoadingButton } from "@/components/loading-button";
import { useToast } from "@/components/toast";

export function ForgotPasswordForm() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const hasEmail = email.trim().length > 0;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasEmail || pending) return;
    setPending(true);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await res.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    setPending(false);

    if (!res.ok) {
      toast(data?.error ?? "Could not send reset email.", "error");
      return;
    }
    toast(
      data?.message ??
        "If an account exists for this email, you'll receive a password reset link shortly.",
      "success",
    );
  }

  return (
    <div className="flex w-full max-w-[380px] flex-col items-center text-center">
      <div className="grid size-16 place-items-center rounded-full bg-accent text-on-accent shadow-[0_0_40px_rgb(154_107_69_/_0.28)]">
        <CrackMark className="size-8" />
      </div>

      <h1 className="mt-7 font-display text-[2rem] font-semibold leading-none tracking-[-0.04em] text-foreground sm:text-[2.25rem]">
        Forgot Password
      </h1>
      <p className="mt-3 max-w-[300px] text-[15px] leading-relaxed text-muted">
        Enter your email address and we&apos;ll send you a link to reset your
        password.
      </p>

      <form onSubmit={onSubmit} className="mt-8 w-full space-y-3.5">
        <label className="sr-only" htmlFor="forgot-email">
          Email address
        </label>
        <input
          id="forgot-email"
          type="email"
          required
          autoComplete="email"
          placeholder="Email address"
          value={email}
          disabled={pending}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-2xl border border-transparent bg-surface px-5 py-3.5 text-[15px] text-foreground outline-none placeholder:text-white/35 focus:border-accent/50 disabled:opacity-60"
        />

        <LoadingButton
          type="submit"
          loading={pending}
          loadingText="Sending…"
          disabled={!hasEmail}
          className={`w-full rounded-2xl px-5 py-3.5 text-[15px] font-semibold transition disabled:cursor-not-allowed ${
            hasEmail
              ? "btn-meet"
              : "border border-transparent bg-[#2a2a2a] text-white/40"
          }`}
        >
          Send Reset Link
        </LoadingButton>
      </form>

      <Link
        href="/login"
        className="mt-6 text-[14px] text-muted transition hover:text-foreground"
      >
        Back to Sign In
      </Link>
    </div>
  );
}
