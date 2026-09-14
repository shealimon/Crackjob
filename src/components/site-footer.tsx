import Link from "next/link";
import type { ReactNode } from "react";
import { AppDownloadLink } from "@/components/app-download-link";
import { CrackMark } from "@/components/crack-logo";
import { WindowsIcon } from "@/components/landing/icons";
import { SectionEyebrow } from "@/components/landing/ui";
import { WINDOWS_APP_DOWNLOAD_URL } from "@/lib/constants";

function CtaButton({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const className =
    "group inline-flex h-[52px] items-center gap-2.5 rounded-full bg-accent py-1 pl-1 pr-6 text-[15px] font-semibold tracking-[-0.01em] text-on-accent transition hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]";
  const inner = (
    <>
      <span className="grid size-[44px] shrink-0 place-items-center rounded-full bg-chocolate text-white">
        {icon}
      </span>
      {children}
    </>
  );
  if (href === WINDOWS_APP_DOWNLOAD_URL) {
    return <AppDownloadLink className={className}>{inner}</AppDownloadLink>;
  }
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

function SideMark({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute top-1/2 hidden -translate-y-1/2 lg:block ${
        isLeft ? "left-[-2%] xl:left-[2%]" : "right-[-2%] xl:right-[2%]"
      }`}
    >
      <CrackMark
        className={`size-[min(28vw,17rem)] text-accent opacity-40 ${
          isLeft ? "-rotate-[18deg]" : "rotate-[18deg] scale-x-[-1]"
        }`}
      />
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative mt-auto overflow-hidden border-t border-white/[0.06] bg-[#0a0604]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />

      <div className="relative overflow-hidden px-5 pt-24 pb-16 md:pt-28 md:pb-20">
        <SideMark side="left" />
        <SideMark side="right" />

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <SectionEyebrow>Start Cracking</SectionEyebrow>

          <h2 className="font-display text-[clamp(3rem,7.5vw,5.25rem)] font-bold leading-[1.05] tracking-[-0.04em] text-white">
            Ready to Crack
            <br />
            Any Interviews
            <br />
            100% Undetectable AI?
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-7 text-[#a2a3a6] sm:text-[18px] sm:leading-8">
            Real-time AI answers that stay off Zoom, Meet, Teams, and screen share — so only you see the help.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <CtaButton href={WINDOWS_APP_DOWNLOAD_URL} icon={<WindowsIcon className="size-4" />}>
              Get for Windows
            </CtaButton>
          </div>
        </div>
      </div>
    </footer>
  );
}
