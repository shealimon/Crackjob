"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingButton } from "@/components/loading-button";
import { useToast } from "@/components/toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const LINK_INVALID = "Reset link expired or invalid. Request a new one.";

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

  return (
    <div className="hairline w-full max-w-md rounded-3xl bg-surface p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">Account</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em]">Reset password</h1>
      <p className="mt-3 text-sm text-muted">
        Choose a new password. Use the link from your reset email to open this page.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm">
          <span className="text-muted">New password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            disabled={pending || bootstrapping || !sessionReady}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-line bg-background px-4 py-3 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Confirm password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            disabled={pending || bootstrapping || !sessionReady}
            onChange={(event) => setConfirm(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-line bg-background px-4 py-3 text-sm outline-none focus:border-accent"
          />
        </label>

        <LoadingButton
          type="submit"
          loading={pending || bootstrapping}
          loadingText={bootstrapping ? "Checking link…" : "Saving…"}
          disabled={bootstrapping || !sessionReady}
          className={`w-full rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed ${
            sessionReady && !bootstrapping
              ? "btn-meet"
              : "bg-[#2a2a2a] text-white/40 shadow-none"
          }`}
        >
          Update password
        </LoadingButton>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/forgot-password" className="font-semibold text-foreground hover:text-accent">
          Request a new link
        </Link>
        {" · "}
        <Link href="/login" className="font-semibold text-foreground hover:text-accent">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
