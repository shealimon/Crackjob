"use client";

import { useState } from "react";
import { FAQS } from "@/components/landing/data";
import { SectionEyebrow } from "@/components/landing/ui";

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24 bg-background px-5 py-[70px] md:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <SectionEyebrow>Frequently Asked Questions</SectionEyebrow>
        <h2 className="text-center text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Got questions ? We&apos;ve got answers
        </h2>
        <p className="mt-4 text-center text-sm text-white/70">
          Couldn&apos;t find your answer?{" "}
          <a href="mailto:hello@interviewpilot.app" className="text-accent hover:underline">
            Send us an email
          </a>
        </p>
        <ul className="mt-10 divide-y divide-[#1E1E1E] overflow-hidden rounded-2xl border border-[#1E1E1E]">
          {FAQS.map((item, index) => {
            const expanded = open === index;
            return (
              <li key={item.q} className="bg-[#191919]">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-medium sm:text-[15px]">{item.q}</span>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[#1E1E1E] text-lg leading-none text-white/50">
                    {expanded ? "–" : "+"}
                  </span>
                </button>
                {expanded ? (
                  <p className="px-5 pb-5 text-sm leading-6 text-white/60">{item.a}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
