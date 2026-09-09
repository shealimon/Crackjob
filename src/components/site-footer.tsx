import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { AppleIcon, WindowsIcon } from "@/components/landing/icons";
import { FOOTER_COLUMNS } from "@/components/landing/data";
import { PRODUCT_NAME } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="relative mt-auto overflow-hidden border-t border-white/[0.06] bg-[#0a0604]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 left-1/2 h-56 w-[min(90vw,42rem)] -translate-x-1/2 rounded-full bg-[#1a100c]/50 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 translate-x-1/3 translate-y-1/3 rounded-full bg-[#140e0a]/40 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-6xl px-5 pb-10 pt-16 md:px-8 md:pb-12 md:pt-20">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.85fr)] lg:gap-16">
          <div className="max-w-md">
            <Link href="/" className="inline-flex transition hover:opacity-90">
              <BrandMark />
            </Link>
            <p className="mt-5 text-[15px] leading-7 text-[#a2a3a6]">
              Desktop overlay that helps you ace screen-based technical interviews with
              real-time AI — hidden from dock, share, and recordings.
            </p>

            <div className="mt-8 flex flex-wrap gap-2.5">
              <Link
                href="/download"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[13px] font-semibold tracking-[-0.01em] text-[#0b0705] transition hover:bg-[#eaeaeb]"
              >
                <WindowsIcon className="size-3.5" />
                Windows
              </Link>
              <Link
                href="/download"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 text-[13px] font-semibold tracking-[-0.01em] text-white/85 transition hover:bg-white/[0.08] hover:text-white"
              >
                <AppleIcon className="size-3.5" />
                Mac
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="font-display text-[13px] font-semibold tracking-[-0.01em] text-white">
                  {column.title}
                </p>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={`${column.title}-${link.label}`}>
                      <Link
                        href={link.href}
                        className="text-[13px] leading-none text-[#a2a3a6] transition hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-white/[0.08] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] tracking-wide text-white/45">
            © {new Date().getFullYear()} {PRODUCT_NAME}. All rights reserved.
          </p>
          <p className="inline-flex items-center gap-2 text-[12px] tracking-wide text-white/45">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/35 opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-white/55" />
            </span>
            Built for live interviews
          </p>
        </div>
      </div>
    </footer>
  );
}
