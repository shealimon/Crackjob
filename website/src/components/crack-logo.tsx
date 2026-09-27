"use client";

import { useId } from "react";

/** 6 thick inward pointers — denser than the 4-piece reference. */

const POINTERS =
  "M10.86 4.28L11.53 3.92L12.22 3.6L12.95 3.32L13.69 3.11L14.45 2.95L15.22 2.85L16 2.82L16.78 2.85L17.55 2.95L18.31 3.11L19.05 3.32L19.78 3.6L20.47 3.92L21.14 4.28L18.77 8.49L16 11.4L13.23 8.49ZM23.58 5.68L24.23 6.08L24.86 6.53L25.45 7.02L26.01 7.55L26.53 8.13L27 8.75L27.42 9.41L27.78 10.1L28.08 10.82L28.32 11.55L28.51 12.31L28.63 13.07L28.7 13.83L28.72 14.59L23.88 14.65L19.98 13.7L21.11 9.85ZM28.72 17.41L28.7 18.17L28.63 18.93L28.51 19.69L28.32 20.45L28.08 21.18L27.78 21.9L27.42 22.59L27 23.25L26.53 23.87L26.01 24.45L25.45 24.98L24.86 25.47L24.23 25.92L23.58 26.32L21.11 22.15L19.98 18.3L23.88 17.35ZM21.14 27.72L20.47 28.08L19.78 28.4L19.05 28.68L18.31 28.89L17.55 29.05L16.78 29.15L16 29.18L15.22 29.15L14.45 29.05L13.69 28.89L12.95 28.68L12.22 28.4L11.53 28.08L10.86 27.72L13.23 23.51L16 20.6L18.77 23.51ZM8.42 26.32L7.77 25.92L7.14 25.47L6.55 24.98L5.99 24.45L5.47 23.87L5 23.25L4.58 22.59L4.22 21.9L3.92 21.18L3.68 20.45L3.49 19.69L3.37 18.93L3.3 18.17L3.28 17.41L8.12 17.35L12.02 18.3L10.89 22.15ZM3.28 14.59L3.3 13.83L3.37 13.07L3.49 12.31L3.68 11.55L3.92 10.82L4.22 10.1L4.58 9.41L5 8.75L5.47 8.13L5.99 7.55L6.55 7.02L7.14 6.53L7.77 6.08L8.42 5.68L10.89 9.85L12.02 13.7L8.12 14.65Z";

/** Theme-matched chocolate palette (marketing-dark). */
const TILE_DEEP = "#3d2314";
const TILE_GLOW = "#5c3317";
const TILE_ACCENT = "#9a6b45";
const TILE_WARM = "#b8895c";

function LogoPatterns({ id }: { id: string }) {
  return (
    <g aria-hidden>
      <defs>
        <radialGradient id={`${id}-glow`} cx="32%" cy="28%" r="78%">
          <stop offset="0%" stopColor={TILE_WARM} />
          <stop offset="42%" stopColor={TILE_ACCENT} />
          <stop offset="100%" stopColor={TILE_DEEP} />
        </radialGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
        </linearGradient>
        <pattern id={`${id}-dots`} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1.2" cy="1.2" r="0.7" fill="#ffffff" fillOpacity="0.14" />
        </pattern>
        <pattern id={`${id}-grid`} width="8" height="8" patternUnits="userSpaceOnUse">
          <path
            d="M8 0H0V8"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.08"
            strokeWidth="0.6"
          />
        </pattern>
        <clipPath id={`${id}-clip`}>
          <rect width="32" height="32" rx="8" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${id}-clip)`}>
        <rect width="32" height="32" fill={`url(#${id}-glow)`} />
        <rect width="32" height="32" fill={`url(#${id}-grid)`} />
        <rect width="32" height="32" fill={`url(#${id}-dots)`} />

        <circle
          cx="16"
          cy="34"
          r="18"
          fill="none"
          stroke={TILE_WARM}
          strokeOpacity="0.28"
          strokeWidth="1.4"
        />
        <circle
          cx="16"
          cy="34"
          r="12"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.12"
          strokeWidth="1"
        />
        <circle
          cx="16"
          cy="-2"
          r="14"
          fill="none"
          stroke={TILE_GLOW}
          strokeOpacity="0.55"
          strokeWidth="3"
        />
        <circle cx="28" cy="6" r="10" fill={TILE_WARM} fillOpacity="0.22" />
        <circle cx="4" cy="26" r="8" fill="#000000" fillOpacity="0.22" />

        <path
          d="M-2 22 L14 6 M2 30 L22 10 M10 34 L30 14"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.07"
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        <rect width="32" height="32" fill={`url(#${id}-sheen)`} />
      </g>
    </g>
  );
}

export function CrackMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path fill="currentColor" d={POINTERS} />
    </svg>
  );
}

export function CrackLogo({ className = "size-9" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");

  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <LogoPatterns id={`crack-${uid}`} />
      <g transform="translate(16 16) scale(0.84) translate(-16 -16)">
        <path fill="#ffffff" d={POINTERS} />
      </g>
    </svg>
  );
}
