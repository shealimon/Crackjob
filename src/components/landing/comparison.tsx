"use client";

import { useState } from "react";
import { COMPARISON_FEATURES } from "@/components/landing/data";
import { CheckIcon, CloseIcon, InfoIcon } from "@/components/landing/icons";
import { SectionEyebrow } from "@/components/landing/ui";
import { PRODUCT_NAME } from "@/lib/constants";

const COLUMNS = [PRODUCT_NAME, "UltraCode", "LockedIn", "AIApply"] as const;

function Cell({ on }: { on: boolean }) {
  return (
    <span className="grid place-items-center">
      {on ? <CheckIcon className="size-5" /> : <CloseIcon className="size-5" />}
    </span>
  );
}

export function Comparison() {
  const [active, setActive] = useState<(typeof COMPARISON_FEATURES)[number]["id"]>(
    COMPARISON_FEATURES[0].id,
  );
  const current = COMPARISON_FEATURES.find((item) => item.id === active) ?? COMPARISON_FEATURES[0];

  return (
    <section id="proof" className="scroll-mt-24 bg-background px-4 py-[70px] md:px-12 md:py-16">
      <div className="mx-auto w-full max-w-6xl">
        <SectionEyebrow>Proof</SectionEyebrow>
        <h2 className="text-center text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
          The Proof Is in the Comparison
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-6 text-white/70">
          Compare side-by-side and find out why {PRODUCT_NAME} stays invisible where others fail.
        </p>

        <div className="mt-12 overflow-hidden rounded-[16px] border border-[#202020] bg-[#141414]">
          <div className="grid lg:grid-cols-[1.15fr_1.4fr]">
            <div className="border-b border-[#202020] p-5 lg:border-b-0 lg:border-r">
              <p className="text-[12px] text-white/50">Undetectability features (click to demo)</p>
              <ul className="mt-4 space-y-1">
                {COMPARISON_FEATURES.map((feature) => (
                  <li key={feature.id}>
                    <button
                      type="button"
                      onClick={() => setActive(feature.id)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm underline-offset-4 transition ${
                        active === feature.id
                          ? "bg-white/5 text-white underline decoration-accent"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span>{feature.name}</span>
                      <InfoIcon />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-5 rounded-xl border border-[#202020] bg-[#191919] p-4 text-[13px] leading-6 text-white/60">
                {current.info}
              </p>
            </div>

            <div className="overflow-x-auto p-5">
              <div className="grid min-w-[420px] grid-cols-4 gap-2 text-center text-[12px] font-medium">
                {COLUMNS.map((name, index) => (
                  <div
                    key={name}
                    className={`rounded-lg px-2 py-3 ${
                      index === 0
                        ? "bg-gradient-to-b from-accent to-accent-hover text-on-accent"
                        : "text-white/50"
                    }`}
                  >
                    {name}
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                {COMPARISON_FEATURES.map((feature) => (
                  <div
                    key={feature.id}
                    className={`grid min-w-[420px] grid-cols-4 items-center rounded-lg py-2.5 ${
                      active === feature.id ? "bg-white/5" : ""
                    }`}
                  >
                    <Cell on={feature.us} />
                    <Cell on={feature.ultra} />
                    <Cell on={feature.locked} />
                    <Cell on={feature.apply} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
