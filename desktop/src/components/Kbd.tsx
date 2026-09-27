import type { ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="ic-kbd">{children}</kbd>;
}

export type HotkeyIcon =
  | "screenshot"
  | "solve"
  | "toggle"
  | "scroll"
  | "scrollDown"
  | "reset"
  | "history"
  | "response"
  | "transcripts";

const KEY_SYMBOLS: Record<string, string> = {
  Ctrl: "⌘",
  Control: "⌘",
  Shift: "⇧",
  Alt: "⌥",
  Enter: "⏎",
  Return: "⏎",
  Backspace: "⌫",
  Delete: "⌦",
  Esc: "⎋",
  Escape: "⎋",
  Tab: "⇥",
  "↑": "↑",
  "↓": "↓",
  "←": "←",
  "→": "→",
};

function keyToSymbol(key: string): string {
  const mapped = KEY_SYMBOLS[key];
  if (mapped) return mapped;
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function HotkeyGlyph({ icon }: { icon: HotkeyIcon }) {
  switch (icon) {
    case "screenshot":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "solve":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3l1.6 4.9H19l-4 2.9 1.5 4.9L12 13.8 7.5 15.7 9 10.8l-4-2.9h5.4L12 3Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "toggle":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "scroll":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 5v14M7 10l5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "scrollDown":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 5v14M7 14l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "reset":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 7V4l-3 3 3 3V7a5 5 0 0 1 8.5 3.5M18 17v3l3-3-3-3v3a5 5 0 0 1-8.5-3.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "history":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8v4.5l3 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "response":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H11l-4 4v-4H7.5A2.5 2.5 0 0 1 5 12.5v-6Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "transcripts":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M8 5v14M12 8v8M16 6v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
}

export function HotkeyHint({
  label,
  keys = [],
  icon,
  onClick,
  active = false,
  flash = false,
}: {
  label: string;
  keys?: string[];
  icon: HotkeyIcon;
  onClick?: () => void;
  active?: boolean;
  flash?: boolean;
}) {
  const shortcutLabel = keys.length ? keys.join(" + ") : label;
  const className = `ic-hotkey-pill${active ? " is-active" : ""}${onClick ? " is-button" : ""}${
    flash ? " is-shot-flash" : ""
  }`;

  const inner = (
    <>
      <span className="ic-hotkey-pill-icon">
        <HotkeyGlyph icon={icon} />
      </span>
      <span className="ic-hotkey-pill-label">{label}</span>
      {keys.length ? (
        <span className="ic-hotkey-pill-keys" aria-label={shortcutLabel}>
          {keys.map((key) => (
            <span key={key} className="ic-hotkey-pill-key">
              {keyToSymbol(key)}
            </span>
          ))}
        </span>
      ) : null}
    </>
  );

  // Same <span> shell as toolbar pills so size/typography match exactly.
  if (onClick) {
    return (
      <span
        role="button"
        tabIndex={0}
        className={className}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
          }
        }}
      >
        {inner}
      </span>
    );
  }

  return <span className={className}>{inner}</span>;
}
