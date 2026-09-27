"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CrackMark } from "@/components/crack-logo";
import { LoadingButton } from "@/components/loading-button";
import { useToast } from "@/components/toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const LINK_INVALID = "Reset link expired or invalid. Request a new one.";

const fieldClass =
  "w-full rounded-2xl border border-transparent bg-surface px-5 py-3.5 text-[15px] text-foreground outline-none placeholder:text-white/35 transition focus:border-accent/50 disabled:opacity-60";

function hashParams() {
  const raw = window.location.hash.replace(/^#/, "");
  return new URLSearchParams(raw);
}

function clearHash() {
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const emailHint = params.get("email") || "";
  const linkErrorToasted = useRef(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  const showLinkError = useCallback(() => {
    if (linkErrorToasted.current) return;
    linkErrorToasted.current = true;
    toast(LINK_INVALID, "error");
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const supabase = createSupabaseBrowserClient();
      const hash = hashParams();
      const hashError = hash.get("error_description") || hash.get("error");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const code = params.get("code");

      try {
        if (hashError) {
          clearHash();
          if (!cancelled) {
            showLinkError();
            setSessionReady(false);
          }
          return;
        }

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          clearHash();
          if (sessionError) {
            if (!cancelled) {
              showLinkError();
              setSessionReady(false);
            }
            return;
          }
          if (!cancelled) setSessionReady(true);
          return;
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (!cancelled) {
              showLinkError();
              setSessionReady(false);
            }
            return;
          }
          if (!cancelled) setSessionReady(true);
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (!cancelled) {
          setSessionReady(Boolean(data.session));
          if (!data.session) showLinkError();
        }
      } catch {
        if (!cancelled) {
          showLinkError();
          setSessionReady(false);
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [params, showLinkError]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== confirm) {
      toast("Passwords do not match.", "error");
      return;
    }

    if (!sessionReady) {
      toast(LINK_INVALID, "error");
      return;
    }

    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        const msg = updateError.message.toLowerCase();
        toast(
          msg.includes("session") || msg.includes("expired") || msg.includes("invalid")
            ? LINK_INVALID
            : updateError.message,
          "error",
        );
        setPending(false);
        return;
      }

      await supabase.auth.signOut().catch(() => undefined);

      const q = emailHint ? `&email=${encodeURIComponent(emailHint)}` : "";
      router.push(`/login?reset=1${q}`);
    } catch {
      toast("Could not reset password.", "error");
      setPending(false);
    }
  }

  const canSubmit =
    sessionReady &&
    !bootstrapping &&
    password.length >= 8 &&
    confirm.length >= 8 &&
    password === confirm;

  return (
    <div className="flex w-full max-w-[380px] flex-col items-center text-center">
      <Link
        href="/"
        aria-label="Go to home"
        className="grid size-16 place-items-center rounded-full bg-accent text-on-accent shadow-[0_0_40px_rgb(154_107_69_/_0.28)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <CrackMark className="size-8" />
      </Link>

      <h1 className="mt-7 font-display text-[2rem] font-semibold leading-none tracking-[-0.04em] text-foreground sm:text-[2.25rem]">
        Reset password
      </h1>
      <p className="mt-3 max-w-[300px] text-[15px] leading-relaxed text-muted">
        Choose a new password. Open this page from the link in your reset email.
      </p>

      <form onSubmit={onSubmit} className="mt-8 w-full space-y-3.5">
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="New password"
          value={password}
          disabled={pending || bootstrapping || !sessionReady}
          onChange={(event) => setPassword(event.target.value)}
          className={fieldClass}
        />
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Confirm password"
          value={confirm}
          disabled={pending || bootstrapping || !sessionReady}
          onChange={(event) => setConfirm(event.target.value)}
          className={fieldClass}
        />

        <LoadingButton
          type="submit"
          loading={pending || bootstrapping}
          loadingText={bootstrapping ? "Checking link…" : "Saving…"}
          disabled={!canSubmit || pending}
          className={`w-full rounded-2xl px-5 py-3.5 text-[15px] font-semibold transition disabled:cursor-not-allowed ${
            canSubmit && !pending
              ? "btn-meet"
              : "border border-transparent bg-[#2a2a2a] text-white/40"
          }`}
        >
          Update password
        </LoadingButton>
      </form>

      <p className="mt-6 flex flex-col gap-2 text-[14px] text-muted sm:flex-row sm:items-center sm:justify-center sm:gap-3">
        <Link href="/forgot-password" className="transition hover:text-foreground">
          Request a new link
        </Link>
        <span className="hidden sm:inline" aria-hidden>
          ·
        </span>
        <Link href="/login" className="transition hover:text-foreground">
          Back to Sign In
        </Link>
      </p>
    </div>
  );
}
