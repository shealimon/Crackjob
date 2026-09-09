import Link from "next/link";
import type { ReactNode } from "react";
import { CrackMark } from "@/components/crack-logo";
import { AppleIcon, WindowsIcon } from "@/components/landing/icons";
import { SectionEyebrow } from "@/components/landing/ui";

function CtaButton({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex h-[52px] items-center gap-2.5 rounded-full bg-accent py-1 pl-1 pr-6 text-[15px] font-semibold tracking-[-0.01em] text-on-accent transition hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
    >
      <span className="grid size-[44px] shrink-0 place-items-center rounded-full bg-chocolate text-white">
        {icon}
      </span>
      {children}
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

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-transparent px-5 py-24 md:py-28">
      <SideMark side="left" />
      <SideMark side="right" />

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <SectionEyebrow>Take the Next Step</SectionEyebrow>

        <h2 className="font-display text-[clamp(1.85rem,4.2vw,3.15rem)] font-bold leading-[1.15] tracking-[-0.035em] text-white">
          Ready to Pass Any Interviews with 100% Undetectable AI?
        </h2>

        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-[#a2a3a6] sm:text-[17px] sm:leading-8">
          Step into your next interview with AI support designed to stay completely undetectable.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <CtaButton href="/download" icon={<WindowsIcon className="size-4" />}>
            Get for Windows
          </CtaButton>
          <CtaButton href="/download" icon={<AppleIcon className="size-4" />}>
            Get for Mac
          </CtaButton>
        </div>
      </div>
    </section>
  );
}
