import { useRef, useState } from "react";
import {
  CODE_LANGUAGE_OPTIONS,
  FREE_EXPLORE_SOLVES,
  MEETING_AUDIO_LANGUAGE_OPTIONS,
  OUTPUT_LANGUAGE_OPTIONS,
} from "../lib/constants";
import { parseResumeUpload, saveResumeText } from "../lib/api";
import { quitApp } from "../lib/tauri";
import { Kbd } from "./Kbd";
import { SelectField } from "./SelectField";
import type { Prefs, UserProfile } from "../lib/types";

type Props = {
  prefs: Prefs;
  user: UserProfile;
  onPersist: (next: Prefs) => void;
  onLogout?: () => void;
  onQuit?: () => void | Promise<void>;
  onClose?: () => void;
};

const SHORTCUTS = [
  { action: "Start", keys: ["Start"] },
  { action: "Screenshot", keys: ["Ctrl", "H"] },
  { action: "Solve", keys: ["Ctrl", "Enter"] },
  { action: "Show / Hide", keys: ["Ctrl", "B"] },
  { action: "Clear output", keys: ["Ctrl", "G"] },
  { action: "History", keys: ["Ctrl", "Y"] },
  { action: "Move Up", keys: ["Ctrl", "↑"] },
  { action: "Move Left", keys: ["Ctrl", "←"] },
  { action: "Move Down", keys: ["Ctrl", "↓"] },
  { action: "Move Right", keys: ["Ctrl", "→"] },
] as const;

const RESUME_ACCEPT =
  ".pdf,.doc,.docx,.txt,.md,.markdown,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/rtf";

function truncateLogin(value: string, max = 28) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 17l5-5-5-5M21 12H9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClearResumeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function QuitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18.36 6.64a9 9 0 1 1-12.73 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 2v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SettingsPanel({ prefs, user, onPersist, onLogout, onQuit, onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const loginLabel = truncateLogin(user.email || user.name || "candidate");
  const opacityPct = Math.round(prefs.overlayOpacity * 100);
  const resumeChars = prefs.resumeText.length;

  const handleResumeFile = (file: File) => {
    setResumeUploading(true);
    void parseResumeUpload(prefs, file)
      .then(({ text }) => {
        onPersist({ ...prefs, resumeText: text });
        if (prefs.token) {
          void saveResumeText(prefs, text).catch(() => undefined);
        }
      })
      .catch((err) => {
        window.alert(err instanceof Error ? err.message : "Could not read resume file");
      })
      .finally(() => {
        setResumeUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      });
  };

  return (
    <aside className="ic-settings">
      <header className="ic-settings-header">
        <h2 className="ic-settings-title">Settings</h2>
        {onClose ? (
          <button type="button" className="ic-settings-close" aria-label="Close settings" onClick={onClose}>
            <CloseIcon />
          </button>
        ) : null}
      </header>

      <div className="ic-settings-body">
        <label className="ic-field">
          <span className="ic-field-label">Output Language</span>
          <SelectField
            value={prefs.outputLanguage}
            options={OUTPUT_LANGUAGE_OPTIONS}
            onChange={(outputLanguage) => onPersist({ ...prefs, outputLanguage })}
          />
        </label>

        <label className="ic-field">
          <span className="ic-field-label">Code Language</span>
          <SelectField
            value={prefs.codeLanguage}
            options={CODE_LANGUAGE_OPTIONS}
            onChange={(codeLanguage) => onPersist({ ...prefs, codeLanguage })}
          />
        </label>

        <label className="ic-field">
          <span className="ic-field-label">Meeting Audio Language</span>
          <SelectField
            value={prefs.meetingAudioLanguage}
            options={MEETING_AUDIO_LANGUAGE_OPTIONS}
            onChange={(meetingAudioLanguage) => onPersist({ ...prefs, meetingAudioLanguage })}
          />
        </label>

        <label className="ic-field ic-field-range">
          <div className="ic-range-header">
            <span className="ic-field-label">Transparency</span>
            <span className="ic-range-value">{opacityPct}%</span>
          </div>
          <input
            type="range"
            className="ic-range"
            min={0.25}
            max={1}
            step={0.05}
            value={prefs.overlayOpacity}
            style={{ ["--range-progress" as string]: `${((prefs.overlayOpacity - 0.25) / 0.75) * 100}%` }}
            onChange={(e) => onPersist({ ...prefs, overlayOpacity: Number(e.target.value) })}
          />
        </label>

        <div className="ic-field ic-resume-field">
          <div className="ic-range-header">
            <span className="ic-field-label">Resume / CV</span>
            <span className="ic-range-value">
              {resumeUploading
                ? "Reading…"
                : resumeChars
                  ? `${resumeChars.toLocaleString()} chars`
                  : "Not set"}
            </span>
          </div>
          <div className="ic-resume-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept={RESUME_ACCEPT}
              className="ic-resume-file-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                handleResumeFile(file);
              }}
            />
            <button
              type="button"
              className="ic-panel-btn ic-resume-upload-btn"
              disabled={resumeUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {resumeUploading ? (
                <>
                  <span className="ic-spinner" aria-hidden />
                  Reading…
                </>
              ) : (
                "Upload Resume/CV"
              )}
            </button>
            {prefs.resumeText ? (
              <button
                type="button"
                className="ic-panel-btn ic-panel-btn-icon ic-panel-btn-muted ic-resume-clear-btn"
                aria-label="Clear resume"
                disabled={resumeUploading}
                onClick={() => {
                  onPersist({ ...prefs, resumeText: "" });
                  if (prefs.token) {
                    void saveResumeText(prefs, "").catch(() => undefined);
                  }
                }}
              >
                <ClearResumeIcon />
              </button>
            ) : null}
          </div>
        </div>

        <div className={`ic-shortcut-block${shortcutsOpen ? " is-open" : ""}`}>
          <button
            type="button"
            className="ic-shortcut-toggle"
            aria-expanded={shortcutsOpen}
            onClick={() => setShortcutsOpen((open) => !open)}
          >
            <span>Shortcuts</span>
            <span className="ic-shortcut-toggle-meta">
              {SHORTCUTS.length}
              <span className="ic-shortcut-chevron" aria-hidden />
            </span>
          </button>
          {shortcutsOpen ? (
            <div className="ic-shortcut-list">
              {SHORTCUTS.map((item) => (
                <div key={item.action} className="ic-shortcut-row">
                  <span className="ic-shortcut-action">{item.action}</span>
                  <span className="ic-hotkey-keys">
                    {item.keys.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="ic-settings-actions">
          <button
            type="button"
            className="ic-panel-btn ic-panel-btn-icon"
            aria-label="Logout"
            onClick={() => onLogout?.()}
          >
            <LogoutIcon />
          </button>
          <button
            type="button"
            className="ic-panel-btn ic-panel-btn-icon ic-panel-btn-danger"
            aria-label="Quit"
            onClick={() => void (onQuit ? onQuit() : quitApp())}
          >
            <QuitIcon />
          </button>
        </div>

        <p className="ic-settings-foot">
          <span className="ic-settings-foot-email" title={user.email || user.name || undefined}>
            {loginLabel}
          </span>
          <span className="ic-settings-foot-sep" aria-hidden>
            ·
          </span>
          <span className="ic-settings-foot-plan">
            {user.fullAccess ? (
              <>
                {user.plan === "month_1"
                  ? "1 month"
                  : user.plan === "month_3"
                    ? "3 months"
                    : user.plan === "year"
                      ? "Yearly"
                      : "Pro"}
                {user.endsAt
                  ? ` · until ${new Date(user.endsAt).toLocaleDateString()}`
                  : " · full access"}
              </>
            ) : (
              <>
                {user.planStatus === "expired" ? "Ended · " : ""}
                Free · {user.exploreRemaining ?? user.creditBalance ?? 0}/{FREE_EXPLORE_SOLVES}
                {user.answerTier === "partial" ? " · preview" : ""}
              </>
            )}
          </span>
        </p>
      </div>
    </aside>
  );
}
