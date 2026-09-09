"use client";

import { useState } from "react";
import { PLATFORMS } from "@/components/landing/data";
import { SectionEyebrow } from "@/components/landing/ui";
import { PRODUCT_NAME } from "@/lib/constants";

export function Platforms() {
  const [open, setOpen] = useState<string | null>(PLATFORMS[0].n);

  return (
    <section className="bg-background px-5 py-[70px] md:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <SectionEyebrow>Reliability Standard</SectionEyebrow>
        <h2 className="text-center text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Undetectable. Tested daily across every interview app.
        </h2>
        <ul className="mt-12 divide-y divide-[#1E1E1E] overflow-hidden rounded-2xl border border-[#1E1E1E]">
          {PLATFORMS.map((platform) => {
            const expanded = open === platform.n;
            return (
              <li key={platform.n} className="bg-[#191919]">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : platform.n)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left"
                >
                  <span className="w-10 font-mono text-[12px] text-white/40">{platform.n}</span>
                  <span className="grid size-9 place-items-center rounded-lg bg-white/5 text-[11px] font-semibold">
                    {platform.name.slice(0, 2)}
                  </span>
                  <span className="flex-1 text-sm font-medium">{platform.name}</span>
                  <span className="hidden text-[12px] text-white/40 sm:inline">
                    Last updated {platform.updated}
                  </span>
                  <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent">
                    Undetectable
                  </span>
                  <svg
                    viewBox="0 0 20 20"
                    className={`size-4 text-white/40 transition ${expanded ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {expanded ? (
                  <div className="px-5 pb-5 pl-[4.5rem] text-sm leading-6 text-white/60">
                    Watch how it stays undetectable on {platform.name}. 100% uptime on the
                    screen-share path {PRODUCT_NAME} uses.
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <div className="mt-4 rounded-2xl border border-[#1E1E1E] bg-[#191919] p-6">
          <h3 className="text-lg font-medium">and almost all the interview softwares...</h3>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Daily testing and real-world checks keep {PRODUCT_NAME} fully undetectable. Because
            interview platforms use the same screen-share tech, it stays invisible everywhere.
          </p>
        </div>
      </div>
    </section>
  );
}
