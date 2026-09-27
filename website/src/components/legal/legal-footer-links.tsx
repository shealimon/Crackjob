import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_NAV, LEGAL_SUPPORT_EMAIL, legalPath } from "@/lib/legal-content";

const PRODUCT_LINKS = [
  { href: "/#pricing", label: "Pricing" },
  { href: "/how-it-works/getting-started", label: "How it works" },
  { href: "/questions", label: "Real Questions" },
  { href: "/signup", label: "Try for Free" },
] as const;

export type FooterTone = "dark" | "light";

function footerStyles(tone: FooterTone) {
  const light = tone === "light";
  return {
    heading: light
      ? "text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45"
      : "text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45",
    headingRule: light ? "bg-black/12" : "bg-accent/70",
    link: light
      ? "group inline-flex items-center gap-1.5 text-[15px] text-black/60 transition hover:text-black"
      : "group inline-flex items-center gap-1.5 text-[15px] text-white/70 transition hover:text-white",
    linkArrow: light
      ? "text-black/0 transition-all group-hover:translate-x-0.5 group-hover:text-black/35"
      : "text-white/0 transition-all group-hover:translate-x-0.5 group-hover:text-accent",
    mail: light
      ? "inline-flex w-full max-w-sm items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3.5 text-[14px] font-medium text-black/75 shadow-sm transition hover:border-black/18 hover:shadow"
      : "inline-flex w-full max-w-sm items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-[14px] font-medium text-white/85 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition hover:border-accent/40 hover:bg-white/[0.06]",
    mailIconWrap: light
      ? "grid size-9 shrink-0 place-items-center rounded-lg bg-black/[0.04] text-black/55"
      : "grid size-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent",
    mailHint: light ? "text-[12px] text-black/40" : "text-[12px] text-white/40",
  };
}

function FooterColumn({
  title,
  tone,
  children,
}: {
  title: string;
  tone: FooterTone;
  children: ReactNode;
}) {
  const s = footerStyles(tone);
  return (
    <div>
      <p className={s.heading}>{title}</p>
      <div className={`mt-3 h-px w-8 ${s.headingRule}`} aria-hidden />
      <div className="mt-5">{children}</div>
    </div>
  );
}

function FooterLink({
  href,
  tone,
  children,
}: {
  href: string;
  tone: FooterTone;
  children: ReactNode;
}) {
  const s = footerStyles(tone);
  return (
    <Link href={href} className={s.link}>
      <span>{children}</span>
      <span className={`text-[14px] ${s.linkArrow}`} aria-hidden>
        →
      </span>
    </Link>
  );
}

export function LegalFooterLinks({ tone = "dark" }: { tone?: FooterTone }) {
  const s = footerStyles(tone);

  return (
    <>
      <FooterColumn title="Product" tone={tone}>
        <ul className="space-y-3.5">
          {PRODUCT_LINKS.map((item) => (
            <li key={item.href}>
              <FooterLink href={item.href} tone={tone}>
                {item.label}
              </FooterLink>
            </li>
          ))}
        </ul>
      </FooterColumn>

      <FooterColumn title="Legal" tone={tone}>
        <ul className="space-y-3.5">
          {LEGAL_NAV.map((item) => (
            <li key={item.id}>
              <FooterLink href={legalPath(item.id)} tone={tone}>
                {item.label}
              </FooterLink>
            </li>
          ))}
        </ul>
      </FooterColumn>

      <FooterColumn title="Support" tone={tone}>
        <a href={`mailto:${LEGAL_SUPPORT_EMAIL}`} className={s.mail}>
          <span className={s.mailIconWrap}>
            <svg
              viewBox="0 0 24 24"
              className="size-[18px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden
            >
              <path d="M4 7h16v10H4V7z" strokeLinejoin="round" />
              <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="min-w-0 text-left">
            <span className="block truncate">{LEGAL_SUPPORT_EMAIL}</span>
            <span className={s.mailHint}>Email us anytime</span>
          </span>
        </a>
      </FooterColumn>
    </>
  );
}
