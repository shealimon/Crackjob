import Link from "next/link";
import { AppleIcon, WindowsIcon } from "@/components/landing/icons";

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M8 0.8c.35 2.9 1.55 4.35 4.45 4.7-2.9.35-4.1 1.8-4.45 4.7-.35-2.9-1.55-4.35-4.45-4.7 2.9-.35 4.1-1.8 4.45-4.7Z" />
    </svg>
  );
}

export function Hero() {
  return (
    <section className="hero-stage relative flex min-h-[72svh] flex-1 flex-col md:min-h-[76svh]">
      <div className="relative z-10 mx-auto flex min-h-[72svh] w-full max-w-5xl flex-1 flex-col items-center justify-center px-5 pb-10 pt-28 text-center md:min-h-[76svh] md:px-8 md:pb-12 md:pt-32">
        <p className="hero-enter hero-enter-1 inline-flex max-w-full items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-4 py-2.5 text-[13px] font-medium leading-none text-white/75 sm:text-[14px]">
          <SparkIcon className="size-3.5 shrink-0 text-[#d4b896]" />
          <span className="truncate">
            Undetectable AI for live interviews — built for every round
          </span>
        </p>

        <h1 className="hero-enter hero-enter-2 mt-12 text-balance text-[clamp(4rem,11.5vw,8.25rem)] leading-[1.02] text-white">
          <span
            className="font-robotic font-[800] tracking-[0.06em]"
            style={{ fontVariationSettings: '"ROND" 100, "wght" 800' }}
          >
            AI.
          </span>{" "}
          <span className="font-serif italic font-normal tracking-[-0.03em]">Solve.</span>{" "}
          <span className="font-display font-bold tracking-[-0.05em]">Crack.</span>
        </h1>

        <p className="hero-enter hero-enter-3 mt-6 max-w-xl text-[17px] leading-8 text-[#a2a3a6] md:text-[19px] md:leading-9">
          Real-time answers for every interview question — invisible on Zoom, Meet, Teams, and screen
          share.
        </p>

        <div className="hero-enter hero-enter-4 mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/download"
            className="btn-meet inline-flex h-14 items-center gap-2 rounded-full px-8 text-[16px] font-semibold transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <WindowsIcon className="size-4" />
            Download for Windows
          </Link>
          <Link
            href="/download"
            className="inline-flex h-14 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-8 text-[16px] font-semibold text-white transition hover:scale-[1.02] hover:bg-white/[0.07] active:scale-[0.98]"
          >
            <AppleIcon className="size-4" />
            Download for Mac
          </Link>
        </div>

        <p className="hero-enter hero-enter-5 mt-8 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/55">
          <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <rect x="2.5" y="6" width="19" height="12" rx="2" />
            <path d="M2.5 10h19" />
            <path d="M6 14h4" strokeLinecap="round" />
            <path d="M4 20L20 4" strokeLinecap="round" />
          </svg>
          No credit card needed
        </p>
      </div>
    </section>
  );
}
