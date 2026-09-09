"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { BrandMark } from "@/components/brand-mark";
import { NAV_LINKS } from "@/components/landing/data";

function DownloadArrow({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <path
        d="M8 2.5v8M4.5 8.5 8 12l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 13.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const { data, status } = useSession();
  const [open, setOpen] = useState(false);
  const firstName = data?.user?.name?.split(" ")[0];
  const signedIn = status === "authenticated";

  if (pathname.startsWith("/dashboard")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 md:px-8">
        <Link href="/" onClick={() => setOpen(false)} className="relative z-10 shrink-0">
          <BrandMark compact />
        </Link>

        <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-6 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1.5 font-display text-[14px] font-medium tracking-[-0.01em] text-white/65 transition hover:text-white"
            >
              {link.label}
              {"badge" in link && link.badge ? (
                <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent shadow-[0_0_12px_rgb(154_107_69_/_0.35)]">
                  {link.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          {signedIn ? (
            <>
              <Link
                href="/dashboard"
                className="font-display text-[14px] font-medium tracking-[-0.01em] text-white/65 transition hover:text-white"
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="font-display text-[14px] font-medium tracking-[-0.01em] text-white/65 transition hover:text-white"
              >
                {firstName ?? "Sign out"}
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="font-display text-[14px] font-medium tracking-[-0.01em] text-white/65 transition hover:text-white"
            >
              Login
            </Link>
          )}
          <Link
            href="/download"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-5 font-display text-[13px] font-semibold tracking-[-0.01em] text-on-accent transition hover:bg-accent-hover"
          >
            Download for free
            <DownloadArrow />
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
        <div className="border-t border-white/10 bg-background px-5 py-4 lg:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 font-display text-[16px] font-medium tracking-[-0.01em]">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2.5 text-white/75 hover:bg-white/5 hover:text-white"
              >
                {link.label}
                {"badge" in link && link.badge ? (
                  <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
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
              {signedIn ? "Dashboard" : "Login"}
            </Link>
            <Link
              href="/download"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-accent text-[15px] font-semibold text-on-accent"
            >
              Download for free
              <DownloadArrow />
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
