"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { BrandMark } from "@/components/brand-mark";
import { NAV_LINKS } from "@/components/landing/data";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { status } = useSession();
  const signedIn = status === "authenticated";

  return (
    <header className="absolute inset-x-0 top-0 z-50 bg-transparent">
      <div className="mx-auto flex h-[84px] w-full max-w-6xl items-center justify-between gap-4 px-5 md:px-8">
        <Link href="/" onClick={() => setOpen(false)} className="relative z-10 shrink-0">
          <BrandMark />
        </Link>

        <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-6 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1.5 font-display text-[15px] font-medium tracking-[-0.01em] text-white/70 transition hover:text-white"
            >
              {link.label}
              {"badge" in link && link.badge ? (
                <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
                  {link.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <Link
            href={signedIn ? "/dashboard" : "/login"}
            className="font-display text-[16px] font-medium tracking-[-0.01em] text-white/70 transition hover:text-white"
          >
            Login
          </Link>
          <Link
            href={signedIn ? "/dashboard" : "/signup"}
            className="inline-flex h-10 items-center rounded-full bg-white px-5 font-display text-[14px] font-semibold tracking-[-0.01em] text-[#0b0705] transition hover:bg-[#eaeaeb]"
          >
            {signedIn ? "Open app" : "Try for Free"}
          </Link>
        </div>

        <button
          type="button"
          className="relative z-10 grid size-10 place-items-center rounded-full border border-white/15 bg-white/5 text-foreground lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">Menu</span>
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-[#0b0705] px-5 py-4 lg:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 font-display text-[17px] font-medium tracking-[-0.01em]">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2.5 text-white/75 hover:bg-white/5 hover:text-white"
              >
                {link.label}
                {"badge" in link && link.badge ? (
                  <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
                    {link.badge}
                  </span>
                ) : null}
              </Link>
            ))}
            <Link
              href={signedIn ? "/dashboard" : "/login"}
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-2.5 text-white/75 hover:bg-white/5 hover:text-white"
            >
              Login
            </Link>
            <Link
              href={signedIn ? "/dashboard" : "/signup"}
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-white text-[15px] font-semibold text-[#0b0705]"
            >
              {signedIn ? "Open app" : "Try for Free"}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
