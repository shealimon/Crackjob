import Link from "next/link";
import { AppDownloadLink } from "@/components/app-download-link";
import { BrandMark } from "@/components/brand-mark";
import { CurrentYear } from "@/components/current-year";
import { LegalFooterLinks } from "@/components/legal/legal-footer-links";
import { WindowsIcon } from "@/components/landing/icons";
import { PRODUCT_NAME } from "@/lib/constants";

export function SiteFooterBottom({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const light = tone === "light";

  const panel = light
    ? "rounded-2xl border border-black/[0.07] bg-white px-6 py-8 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] sm:px-8 sm:py-10"
    : "rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.045] to-white/[0.015] px-6 py-8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] sm:px-8 sm:py-10 md:px-10 md:py-11";

  return (
    <div
      className={
        light
          ? "border-t border-black/8 bg-[var(--dash-bg)] px-5 py-10 md:py-12"
          : "relative border-t border-white/[0.08] bg-[#070504] px-5 py-12 md:py-14"
      }
    >
      {!light ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_0%,rgba(154,107,69,0.12),transparent_55%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent"
          />
        </>
      ) : null}

      <div className="relative mx-auto max-w-6xl">
        <div className={panel}>
          <div className="grid gap-10 sm:gap-12 xl:grid-cols-4 xl:items-start xl:gap-8">
            <div className="xl:pr-2">
              <Link
                href="/"
                className={`inline-flex ${light ? "dash-brand text-black" : "text-white"}`}
              >
                <BrandMark />
              </Link>
              <p
                className={`mt-4 max-w-[17rem] text-[15px] leading-[1.7] ${
                  light ? "text-black/55" : "text-white/55"
                }`}
              >
                Real-time AI interview help — on your screen, invisible on screen share.
              </p>
              {light ? (
                <AppDownloadLink className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-black px-5 text-[13px] font-semibold text-white transition hover:bg-black/85">
                  <WindowsIcon className="size-3.5" />
                  Get for Windows
                </AppDownloadLink>
              ) : (
                <AppDownloadLink className="mt-6 inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-5 text-[13px] font-semibold text-white/90 transition hover:border-accent/45 hover:bg-white/[0.08]">
                  <WindowsIcon className="size-3.5" />
                  Get for Windows
                </AppDownloadLink>
              )}
            </div>

            <div className="grid gap-10 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3 xl:col-span-3 xl:gap-8">
              <LegalFooterLinks tone={tone} />
            </div>
          </div>
        </div>

        <p
          className={`mt-8 px-1 text-[12px] tracking-[0.01em] md:mt-9 ${
            light ? "text-black/40" : "text-white/35"
          }`}
        >
          {PRODUCT_NAME}™ · © <CurrentYear /> {PRODUCT_NAME}. All rights reserved.
        </p>
      </div>
    </div>
  );
}
