"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AppDownloadLink } from "@/components/app-download-link";
import { SectionEyebrow } from "@/components/landing/ui";
import { WINDOWS_APP_DOWNLOAD_URL } from "@/lib/constants";

const FREE_BULLETS = [
  "Download and explore the app",
  "Audio support for real-time guidance",
  "20+ undetectability features for total stealth",
  "Support for all kinds of interviews",
  "Subscribe to unlock AI features",
];

const PAID_BULLETS = [
  "Full access for all interview types",
  "Audio support for real-time guidance",
  "20+ undetectability features for total stealth",
  "Most powerful fine-tuned AI models",
  "24/7 support",
];

type BillingCycle = "monthly" | "quarterly";

const PRO_OPTIONS = {
  monthly: {
    label: "Monthly",
    eyebrow: "Monthly Pro",
    price: "₹9,999",
    cadence: "/month",
  },
  quarterly: {
    label: "Quarterly",
    eyebrow: "Quarterly Pro",
    price: "₹19,999",
    cadence: "/3 months",
  },
} as const;

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <path
        d="M4 6.5 8 10.5 12 6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon({ muted }: { muted?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="8" className={muted ? "fill-white/25" : "fill-accent"} />
      <path
        d="M4.8 8.2l2.1 2.1 4.3-4.4"
        stroke={muted ? "#0b0705" : "var(--on-accent)"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlanButton({
  href,
  children,
  variant,
}: {
  href: string;
  children: ReactNode;
  variant: "free" | "paid";
}) {
  const free = variant === "free";
  const className = `mt-auto inline-flex h-[48px] w-full items-center gap-2 rounded-full py-1 pl-1 pr-5 font-display text-[15px] font-semibold transition hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] ${
    free ? "bg-white text-[#0b0705]" : "bg-accent text-on-accent"
  }`;
  const inner = (
    <>
      <span
        className={`grid size-[40px] shrink-0 place-items-center rounded-full ${
          free ? "bg-[#0b0705] text-white" : "bg-chocolate text-white"
        }`}
      >
        <ChevronDown className="size-4" />
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

function FeatureList({ items, mutedChecks }: { items: string[]; mutedChecks?: boolean }) {
  return (
    <ul className="mt-10 mb-10 flex-1 space-y-4 text-left text-[14px] leading-snug">
      {items.map((bullet) => (
        <li key={bullet} className="flex gap-2.5 text-left">
          <CheckIcon muted={mutedChecks} />
          <span className="text-white/65">{bullet}</span>
        </li>
      ))}
    </ul>
  );
}

export function PricingSection() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const pro = PRO_OPTIONS[cycle];

  return (
    <section id="pricing" className="scroll-mt-24 px-5 py-[70px] md:py-20">
      <div className="mx-auto w-full max-w-[88rem]">
        <SectionEyebrow>Pricing</SectionEyebrow>
        <h2 className="mx-auto max-w-3xl text-center font-display text-3xl font-semibold tracking-[-0.03em] text-white sm:text-5xl sm:leading-[1.1]">
          Simple, transparent pricing
        </h2>

        <div className="mt-12 grid items-stretch gap-4 lg:grid-cols-3 lg:gap-6">
          {/* Free */}
          <article className="flex h-full min-h-[520px] flex-col rounded-[22px] border border-line bg-surface p-8 text-left sm:min-h-[560px] sm:p-9">
            <p className="font-display text-[12px] font-medium uppercase tracking-[0.16em] text-white/45">
              Free Download
            </p>
            <div className="mt-6 flex items-end gap-2">
              <p className="font-display text-6xl font-semibold tracking-tight text-white sm:text-7xl">
                ₹0
              </p>
              <p className="mb-2 font-display text-sm uppercase tracking-[0.08em] text-white/45">
                /forever
              </p>
            </div>

            <FeatureList items={FREE_BULLETS} mutedChecks />

            <PlanButton href={WINDOWS_APP_DOWNLOAD_URL} variant="free">
              Get Started
            </PlanButton>
          </article>

          {/* Monthly / Quarterly — highlighted */}
          <article className="flex h-full min-h-[520px] flex-col rounded-[22px] border border-accent bg-surface p-8 text-left shadow-[0_0_0_1px_rgb(154_107_69_/0.25)] sm:min-h-[560px] sm:p-9">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-[12px] font-medium uppercase tracking-[0.16em] text-accent">
                {pro.eyebrow}
              </p>
              <div
                className="inline-flex shrink-0 rounded-full border border-accent/35 bg-[#0b0705]/55 p-0.5"
                role="tablist"
                aria-label="Billing cycle"
              >
                {(Object.keys(PRO_OPTIONS) as BillingCycle[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={cycle === key}
                    onClick={() => setCycle(key)}
                    className={`rounded-full px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-[0.08em] transition ${
                      cycle === key
                        ? "bg-accent text-on-accent shadow-sm"
                        : "text-white/45 hover:text-white/75"
                    }`}
                  >
                    {PRO_OPTIONS[key].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-end gap-2">
              <p className="font-display text-6xl font-semibold tracking-tight text-accent sm:text-7xl">
                {pro.price}
              </p>
              <p className="mb-2 font-display text-sm uppercase tracking-[0.08em] text-white/45">
                {pro.cadence}
              </p>
            </div>

            <FeatureList items={PAID_BULLETS} />

            <PlanButton href="/signup" variant="paid">
              Subscribe
            </PlanButton>
          </article>

          {/* Yearly */}
          <article className="flex h-full min-h-[520px] flex-col rounded-[22px] border border-line bg-surface p-8 text-left sm:min-h-[560px] sm:p-9">
            <p className="font-display text-[12px] font-medium uppercase tracking-[0.16em] text-white/45">
              Yearly Pro
            </p>
            <div className="mt-6 flex items-end gap-2">
              <p className="font-display text-6xl font-semibold tracking-tight text-white sm:text-7xl">
                ₹49,999
              </p>
              <p className="mb-2 font-display text-sm uppercase tracking-[0.08em] text-white/45">
                /year
              </p>
            </div>

            <FeatureList items={PAID_BULLETS} />

            <PlanButton href="/signup" variant="free">
              Buy now
            </PlanButton>
          </article>
        </div>
      </div>
    </section>
  );
}
