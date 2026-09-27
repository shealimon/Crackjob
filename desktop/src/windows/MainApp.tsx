import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { AudioIndicator } from "../components/AudioIndicator";
import { AudioPlayPauseButton } from "../components/AudioPlayPauseButton";
import { BrandLogo } from "../components/BrandLogo";
import { DesktopLoginForm } from "../components/DesktopLoginForm";
import { HotkeyHint } from "../components/Kbd";
import { SettingsPanel } from "../components/SettingsPanel";
import { useInterviewSession } from "../hooks/useInterviewSession";
import { useScreenshotFlash } from "../hooks/useScreenshotFlash";
import { useWindowHotkeys } from "../hooks/useWindowHotkeys";
import { setToolbarWindowExpanded, hideOverlay } from "../lib/tauri";

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l1.4 4.3H18l-3.5 2.6 1.3 4.3L12 12.8 8.2 13.2l1.3-4.3L6 6.3h4.6L12 2z"
        fill="currentColor"
      />
      <path
        d="M19 14l.7 2.1H22l-1.8 1.3.7 2.1L19 18.1l-1.9 1.4.7-2.1L16 16.1h2.3L19 14z"
        fill="currentColor"
        opacity="0.65"
      />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function MainApp() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({});
  const gearRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLElement>(null);
  const settingsCloseTimerRef = useRef<number | null>(null);
  const lastToolbarWidthRef = useRef(0);

  const openSettings = useCallback(() => {
    if (settingsCloseTimerRef.current !== null) {
      window.clearTimeout(settingsCloseTimerRef.current);
      settingsCloseTimerRef.current = null;
    }
    setSettingsOpen(true);
  }, []);

  const scheduleCloseSettings = useCallback(() => {
    if (settingsCloseTimerRef.current !== null) {
      window.clearTimeout(settingsCloseTimerRef.current);
    }
    settingsCloseTimerRef.current = window.setTimeout(() => {
      settingsCloseTimerRef.current = null;
      setSettingsOpen(false);
    }, 120);
  }, []);
  const session = useInterviewSession();
  const shotFlash = useScreenshotFlash();
  const {
    prefs,
    user,
    needsLogin,
    completeLogin,
    logout,
    quitWithSync,
    boot,
    interviewOn,
    interviewStarting,
    error,
    audio,
    audioHearing,
    audioTranscribing,
    audioPaused,
    persist,
    startInterview,
    stopInterview,
    toggleAudioListening,
    takeScreenshot,
    solve,
    toggleOverlay,
    clearSession,
  } = session;

  const onCapture = useCallback(() => {
    void takeScreenshot();
  }, [takeScreenshot]);
  const onSolve = useCallback(() => {
    void solve();
  }, [solve]);
  const onToggle = useCallback(() => {
    void toggleOverlay();
  }, [toggleOverlay]);
  const onReset = useCallback(() => {
    void clearSession();
  }, [clearSession]);
  const onHistory = useCallback(() => {
    void emit("toggle-history").catch(() => undefined);
  }, []);

  useWindowHotkeys({ onCapture, onSolve, onToggle, onReset, onHistory });

  const fitToolbarWindow = useCallback(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    // Wrap padding (8px each side) so the pill never clips the settings gear.
    const nextWidth = Math.ceil(toolbar.getBoundingClientRect().width + 16);
    const isFirstMeasure = lastToolbarWidthRef.current === 0;
    if (Math.abs(nextWidth - lastToolbarWidthRef.current) < 2 && lastToolbarWidthRef.current > 0) {
      void setToolbarWindowExpanded(settingsOpen, lastToolbarWidthRef.current).catch(() => undefined);
      return;
    }
    lastToolbarWidthRef.current = nextWidth;
    // First measure: pin top-center with final width (avoids right→left jump from
    // conf x:470 / 700px strip → content width with only dx compensation).
    void setToolbarWindowExpanded(
      settingsOpen,
      nextWidth,
      isFirstMeasure ? false : undefined,
    ).catch(() => undefined);
  }, [settingsOpen]);

  useLayoutEffect(() => {
    fitToolbarWindow();
  }, [fitToolbarWindow, interviewOn, audioPaused, audioHearing, audioTranscribing, error]);

  // First paint after login/boot: remasure after layout + fonts settle.
  // MSI/WebView2 can paint once at default width before the pill is full width.
  useEffect(() => {
    if (needsLogin || !prefs) return;
    const timers = [0, 50, 160, 400].map((ms) =>
      window.setTimeout(() => fitToolbarWindow(), ms),
    );
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, [needsLogin, prefs, fitToolbarWindow, interviewOn, user?.fullAccess]);

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      fitToolbarWindow();
    });
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, [fitToolbarWindow]);

  useEffect(() => {
    if (!prefs) return;
    document.documentElement.style.setProperty("--toolbar-alpha", String(prefs.overlayOpacity));
    void emit("overlay-opacity", { opacity: prefs.overlayOpacity });
  }, [prefs?.overlayOpacity]);

  // Login form needs a tall centered panel; default main window is a top toolbar strip.
  // Rust setup already sizes for login when token is missing; reassert here in case
  // WebView paint raced ahead of the first invoke (common on cold MSI launch).
  const sawLoginRef = useRef(false);
  useEffect(() => {
    if (needsLogin) {
      sawLoginRef.current = true;
      // Never show overlay beside the sign-in window (looks like a 2nd login).
      void hideOverlay().catch(() => undefined);
      let cancelled = false;
      const expandLogin = async () => {
        for (const delayMs of [0, 80, 250, 600]) {
          if (cancelled) return;
          if (delayMs > 0) {
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, delayMs);
            });
          }
          if (cancelled) return;
          try {
            await setToolbarWindowExpanded(true, 380, true);
            return;
          } catch {
            // Retry — invoke can fail before the command bridge is ready.
          }
        }
      };
      void expandLogin();
      return () => {
        cancelled = true;
      };
    }
    if (!sawLoginRef.current) return;
    sawLoginRef.current = false;
    // Wait for toolbar paint, then size to content + pin top-center.
    // Avoids forcing 860px first (that caused a one-time left jump on settings hover).
    requestAnimationFrame(() => {
      const toolbar = toolbarRef.current;
      const nextWidth = toolbar
        ? Math.ceil(toolbar.getBoundingClientRect().width + 16)
        : undefined;
      if (nextWidth && nextWidth > 0) {
        lastToolbarWidthRef.current = nextWidth;
      }
      void setToolbarWindowExpanded(false, nextWidth, false).catch(() => undefined);
    });
  }, [needsLogin]);

  useEffect(() => {
    return () => {
      if (settingsCloseTimerRef.current !== null) {
        window.clearTimeout(settingsCloseTimerRef.current);
      }
      void setToolbarWindowExpanded(false).catch(() => undefined);
    };
  }, []);

  useLayoutEffect(() => {
    if (!settingsOpen || !gearRef.current) return;

    const updatePosition = () => {
      const gear = gearRef.current?.getBoundingClientRect();
      const popup = popupRef.current?.getBoundingClientRect();
      if (!gear) return;

      const popupWidth = popup?.width ?? 320;
      const left = Math.min(
        Math.max(gear.right - popupWidth, 12),
        window.innerWidth - popupWidth - 12,
      );

      setPopupStyle({
        top: gear.bottom + 10,
        left,
      });
    };

    updatePosition();
    requestAnimationFrame(updatePosition);
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;

    let unlisten: (() => void) | undefined;

    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (!focused) setSettingsOpen(false);
      })
      .then((dispose) => {
        unlisten = dispose;
      })
      .catch(() => undefined);

    return () => {
      unlisten?.();
    };
  }, [settingsOpen]);

  if (boot && !prefs) {
    return (
      <main className="ic-boot">
        <p>{boot}</p>
      </main>
    );
  }

  if (!prefs) return null;

  if (needsLogin) {
    return (
      <DesktopLoginForm
        prefs={prefs}
        onSuccess={completeLogin}
        onQuit={quitWithSync}
      />
    );
  }

  const apiBase = prefs.apiUrl.replace(/\/$/, "");

  return (
    <div className={`ic-toolbar-wrap${settingsOpen ? " is-settings-open" : ""}`}>
      <nav
        ref={toolbarRef}
        className="ic-toolbar"
        data-tauri-drag-region
        style={{ ["--toolbar-alpha" as string]: String(prefs.overlayOpacity) }}
      >
        {interviewOn ? (
          <button type="button" className="ic-btn ic-btn-danger ic-btn-start" onClick={() => void stopInterview()}>
            <span className="ic-stop-dot" />
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="ic-btn ic-btn-glass ic-btn-start"
            disabled={interviewStarting}
            aria-busy={interviewStarting}
            onClick={() => void startInterview()}
          >
            {interviewStarting ? (
              <>
                <span className="ic-spinner" aria-hidden />
                Starting…
              </>
            ) : (
              <>
                <BrandLogo size={14} />
                Start
              </>
            )}
          </button>
        )}

        <div className="ic-toolbar-divider" />

        <div className="ic-audio-controls">
          <AudioIndicator
            interviewOn={interviewOn && !audioPaused}
            capturing={Boolean(audio?.capturing)}
            hearing={audioHearing || Boolean(audio?.speaking)}
            processing={audioTranscribing}
          />

          <AudioPlayPauseButton
            interviewOn={interviewOn}
            paused={audioPaused}
            onToggle={() => void toggleAudioListening()}
          />
        </div>

        <HotkeyHint
          key={shotFlash ? `shot-${shotFlash}` : "shot"}
          label="Screenshot"
          keys={["Ctrl", "H"]}
          icon="screenshot"
          flash={shotFlash > 0}
        />
        <HotkeyHint label="Answer" keys={["Ctrl", "Enter"]} icon="solve" />
        <HotkeyHint label="Show/Hide" keys={["Ctrl", "B"]} icon="toggle" />

        {!user.fullAccess ? (
          <button
            type="button"
            className="ic-btn ic-btn-glass ic-btn-upgrade"
            onClick={() =>
              void openUrl(
                user && !needsLogin ? `${apiBase}/dashboard` : `${apiBase}/#pricing`,
              )
            }
          >
            <SparkleIcon />
            <span className="ic-btn-upgrade-label">Upgrade</span>
            <span className="ic-pro-badge">PRO</span>
          </button>
        ) : null}

        <button
          ref={gearRef}
          type="button"
          className={`ic-icon-btn${settingsOpen ? " is-active" : ""}`}
          aria-label="Settings"
          aria-expanded={settingsOpen}
          onMouseEnter={openSettings}
          onMouseLeave={scheduleCloseSettings}
        >
          <GearIcon />
        </button>
      </nav>

      {settingsOpen ? (
        <div
          ref={popupRef}
          className="ic-settings-popup"
          style={popupStyle}
          onMouseEnter={openSettings}
          onMouseLeave={scheduleCloseSettings}
        >
          <SettingsPanel
            prefs={prefs}
            user={user}
            onPersist={(next) => void persist(next)}
            onLogout={() => {
              setSettingsOpen(false);
              void logout();
            }}
            onQuit={() => {
              setSettingsOpen(false);
              void quitWithSync();
            }}
            onClose={() => setSettingsOpen(false)}
          />
        </div>
      ) : null}

      {error ? <p className="ic-toolbar-error">{error}</p> : null}

      <div className="ic-toolbar-actions-hidden" aria-hidden>
        <button type="button" onClick={() => void takeScreenshot()} id="shot-btn" />
        <button type="button" onClick={() => void solve()} id="solve-btn" />
        <button type="button" onClick={() => void toggleOverlay()} id="toggle-btn" />
      </div>
    </div>
  );
}
