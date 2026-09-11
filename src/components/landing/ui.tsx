import Link from "next/link";
import type { ReactNode } from "react";
import { AppDownloadLink } from "@/components/app-download-link";
import { CrackLogo } from "@/components/crack-logo";
import { WINDOWS_APP_DOWNLOAD_URL } from "@/lib/constants";

export function GoldButton({
  href,
  icon,
  children,
  size = "lg",
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  size?: "sm" | "lg";
}) {
  const large = size === "lg";
  const className = `group inline-flex items-center rounded-full bg-accent font-semibold text-on-accent transition hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] ${
    large ? "h-[46px] gap-1.5 py-1 pl-1 pr-4 text-[15px]" : "h-[38px] gap-1.5 py-1 pl-1 pr-4 text-[13px]"
  }`;
  const inner = (
    <>
      <span
        className={`grid shrink-0 place-items-center rounded-full bg-chocolate text-white ${
          large ? "size-[38px]" : "size-[30px]"
        }`}
      >
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

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-[7px]">
      <span className="grid size-[18px] place-items-center rounded-full bg-accent/[0.06]">
        <span className="size-2 rounded-full bg-accent" />
      </span>
      <span className="text-xs font-medium text-white/70">{children}</span>
    </div>
  );
}
export function CardIcon() {
  return <CrackLogo className="size-10" />;
}

