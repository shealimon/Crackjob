"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Prefs, UserProfile } from "../lib/types";
import { desktopEmailLogin } from "../lib/api";
import { loadPrefs, quitApp, savePrefs } from "../lib/tauri";

type Props = {
  prefs: Prefs;
  onSuccess: (next: { prefs: Prefs; user: UserProfile }) => void;
  onQuit?: () => void | Promise<void>;
};

/** Same 6-pointer mark as website `CrackMark`. */
function CrackMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        fill="currentColor"
        d="M10.86 4.28L11.53 3.92L12.22 3.6L12.95 3.32L13.69 3.11L14.45 2.95L15.22 2.85L16 2.82L16.78 2.85L17.55 2.95L18.31 3.11L19.05 3.32L19.78 3.6L20.47 3.92L21.14 4.28L18.77 8.49L16 11.4L13.23 8.49ZM23.58 5.68L24.23 6.08L24.86 6.53L25.45 7.02L26.01 7.55L26.53 8.13L27 8.75L27.42 9.41L27.78 10.1L28.08 10.82L28.32 11.55L28.51 12.31L28.63 13.07L28.7 13.83L28.72 14.59L23.88 14.65L19.98 13.7L21.11 9.85ZM28.72 17.41L28.7 18.17L28.63 18.93L28.51 19.69L28.32 20.45L28.08 21.18L27.78 21.9L27.42 22.59L27 23.25L26.53 23.87L26.01 24.45L25.45 24.98L24.86 25.47L24.23 25.92L23.58 26.32L21.11 22.15L19.98 18.3L23.88 17.35ZM21.14 27.72L20.47 28.08L19.78 28.4L19.05 28.68L18.31 28.89L17.55 29.05L16.78 29.15L16 29.18L15.22 29.15L14.45 29.05L13.69 28.89L12.95 28.68L12.22 28.4L11.53 28.08L10.86 27.72L13.23 23.51L16 20.6L18.77 23.51ZM8.42 26.32L7.77 25.92L7.14 25.47L6.55 24.98L5.99 24.45L5.47 23.87L5 23.25L4.58 22.59L4.22 21.9L3.92 21.18L3.68 20.45L3.49 19.69L3.37 18.93L3.3 18.17L3.28 17.41L8.12 17.35L12.02 18.3L10.89 22.15ZM3.28 14.59L3.3 13.83L3.37 13.07L3.49 12.31L3.68 11.55L3.92 10.82L4.22 10.1L4.58 9.41L5 8.75L5.47 8.13L5.99 7.55L6.55 7.02L7.14 6.53L7.77 6.08L8.42 5.68L10.89 9.85L12.02 13.7L8.12 14.65Z"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
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

export function DesktopLoginForm({ prefs, onSuccess, onQuit }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length >= 8;

  // Always hydrate from disk so logout → login shows last saved credentials.
  useEffect(() => {
    let cancelled = false;
    void loadPrefs()
      .then((loaded) => {
        if (cancelled) return;
        if (loaded.rememberMe) {
          setEmail(loaded.rememberedEmail);
          setPassword(loaded.rememberedPassword);
          setRememberMe(true);
          return;
        }
        if (prefs.rememberMe) {
          setEmail(prefs.rememberedEmail);
          setPassword(prefs.rememberedPassword);
          setRememberMe(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (prefs.rememberMe) {
          setEmail(prefs.rememberedEmail);
          setPassword(prefs.rememberedPassword);
          setRememberMe(true);
        }
      });
    return () => {
      cancelled = true;
    };
    // Mount-only: read fresh disk prefs after logout.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setPending(true);
    try {
      const result = await desktopEmailLogin(prefs, trimmed, password);
      const nextPrefs = await savePrefs({
        ...prefs,
        token: result.token,
        rememberMe,
        rememberedEmail: rememberMe ? trimmed : "",
        rememberedPassword: rememberMe ? password : "",
      });
      onSuccess({ prefs: nextPrefs, user: result.user });
    } catch (err) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        const base = prefs.apiUrl.replace(/\/$/, "") || "API";
        const isLocal = /localhost|127\.0\.0\.1/i.test(base);
        setError(
          isLocal
            ? "Cannot reach the API. Start the website first: in website/, run npm run dev (port 43123), then try again."
            : `Cannot reach the API at ${base}. Check your internet connection, or try again later.`,
        );
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
    } finally {
      setPending(false);
    }
  }

  function handleClose() {
    void Promise.resolve(onQuit ? onQuit() : quitApp()).catch(() => undefined);
  }

  return (
    <main className="ic-login">
      {/* Ambient glow inside one opaque window — not a second floating card. */}
      <div className="ic-login-scene" aria-hidden>
        <span className="ic-login-orb ic-login-orb-a" />
        <span className="ic-login-orb ic-login-orb-b" />
        <span className="ic-login-orb ic-login-orb-c" />
        <span className="ic-login-grain" />
        <span className="ic-login-sheen" />
      </div>

      <div className="ic-login-chrome">
        <div className="ic-login-drag" data-tauri-drag-region />
        <button
          type="button"
          className="ic-login-close"
          aria-label="Close"
          title=""
          onClick={handleClose}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="ic-login-body">
        <div className="ic-login-mark" aria-hidden>
          <CrackMark size={28} />
        </div>

        <p className="ic-login-brand">Crack</p>
        <h1 className="ic-login-title">Welcome back</h1>
        <p className="ic-login-sub">Sign in to continue your interview session</p>

        <div className="ic-login-stack">
          <button
            type="button"
            className="ic-login-google"
            disabled={pending}
            title=""
            onClick={() => {
              // Google OAuth for desktop — wire up later.
            }}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="ic-login-divider" role="separator">
            <span>Or email</span>
          </div>

          <form
            className="ic-login-form"
            onSubmit={onSubmit}
            noValidate
            autoComplete="off"
          >
            <label className="ic-login-field">
              <span className="ic-login-label">Email</span>
              <input
                type="text"
                name="crack_login_email"
                inputMode="email"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="you@company.com"
                title=""
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
                className="ic-login-input"
              />
            </label>
            <label className="ic-login-field">
              <span className="ic-login-label">Password</span>
              <input
                type="password"
                name="crack_login_password"
                autoComplete="new-password"
                autoCorrect="off"
                spellCheck={false}
                placeholder="••••••••"
                title=""
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
                className="ic-login-input"
              />
            </label>

            <label className="ic-login-remember" title="">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={pending}
                title=""
              />
              <span>Remember me on this device</span>
            </label>

            {error ? <p className="ic-login-error">{error}</p> : null}

            <button
              type="submit"
              className={`ic-login-submit${canSubmit ? " is-ready" : ""}`}
              disabled={!canSubmit || pending}
              aria-busy={pending || undefined}
              title=""
            >
              {pending ? (
                <>
                  <span className="ic-spinner" aria-hidden />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
