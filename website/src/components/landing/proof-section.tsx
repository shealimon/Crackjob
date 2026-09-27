"use client";

import { useEffect, useState } from "react";
import { OFFER_CARDS } from "@/components/landing/data";
import { SectionEyebrow } from "@/components/landing/ui";

const INITIAL_VISIBLE = 6;

function CompanyMark({ company, accent }: { company: string; accent: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid size-8 place-items-center rounded-lg text-[13px] font-bold text-white"
        style={{ background: accent }}
      >
        {company.slice(0, 1)}
      </span>
      <span className="font-display text-[15px] font-semibold tracking-tight text-white">
        {company}
      </span>
    </div>
  );
}

function OfferLetterImage({
  src,
  alt,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static offer assets; avoid optimizer blanks on expand
    <img
      src={src}
      alt={alt}
      width={1024}
      height={1536}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={className}
    />
  );
}

export function ProofSection() {
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState<(typeof OFFER_CARDS)[number] | null>(null);
  const visible = expanded ? OFFER_CARDS : OFFER_CARDS.slice(0, INITIAL_VISIBLE);

  useEffect(() => {
    OFFER_CARDS.slice(INITIAL_VISIBLE).forEach((offer) => {
      const img = new window.Image();
      img.src = offer.image;
    });
  }, []);

  return (
    <section id="proof" className="scroll-mt-24 px-5 py-[70px] md:py-20">
      <div className="mx-auto w-full max-w-6xl">
        <SectionEyebrow>Proven results</SectionEyebrow>
        <h2 className="mx-auto max-w-3xl text-center font-display text-3xl font-semibold tracking-[-0.03em] text-white sm:text-5xl sm:leading-[1.1]">
          10,000+ candidates cracked job offers by using Crack
        </h2>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {visible.map((offer) => (
            <article
              key={offer.company}
              className="flex flex-col overflow-hidden rounded-[22px] border border-line bg-surface p-3 sm:p-3.5"
            >
              <button
                type="button"
                onClick={() => setActive(offer)}
                className="group relative aspect-[3/4] overflow-hidden rounded-[14px] bg-[#efece4] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <OfferLetterImage
                  src={offer.image}
                  alt={`${offer.company} ${offer.role} offer letter`}
                  priority={expanded}
                  className="absolute inset-0 h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.02]"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  <span className="-rotate-[28deg] select-none font-display text-[22px] font-bold tracking-[0.08em] text-black/10 sm:text-[26px]">
                    Crack
                  </span>
                </span>
              </button>

              <div className="flex flex-1 flex-col px-2 pb-2 pt-4 sm:px-2.5 sm:pt-5">
                <CompanyMark company={offer.company} accent={offer.accent} />
                <p className="mt-2 font-display text-[12px] font-medium uppercase tracking-[0.1em] text-white/40">
                  {offer.field} · {offer.role}
                </p>
                <p className="mt-2 font-display text-[15px] leading-snug text-white/80 sm:text-[16px]">
                  Cracked{" "}
                  <span className="font-semibold text-accent">{offer.salary}</span>{" "}
                  <span className="font-semibold text-accent">{offer.role}</span> offer at{" "}
                  <span className="font-semibold text-accent">{offer.company}</span> with help of
                  Crack
                </p>
                <button
                  type="button"
                  onClick={() => setActive(offer)}
                  className="mt-4 inline-flex items-center gap-1 self-start font-display text-[13px] font-medium text-white/45 transition hover:text-white/75"
                >
                  View offer
                  <span aria-hidden>›</span>
                </button>
              </div>
            </article>
          ))}
        </div>

        {!expanded && OFFER_CARDS.length > INITIAL_VISIBLE ? (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="group inline-flex items-center gap-3 font-display text-[15px] font-semibold text-white transition hover:brightness-110"
            >
              <span className="grid size-12 place-items-center rounded-full bg-accent text-on-accent shadow-sm transition group-hover:scale-[1.04] group-active:scale-[0.98]">
                <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
                  <path
                    d="M4 6.5 8 10.5 12 6.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              View more
            </button>
          </div>
        ) : null}
      </div>

      {active ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${active.company} offer letter`}
          onClick={() => setActive(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div>
                <CompanyMark company={active.company} accent={active.accent} />
                <p className="mt-1.5 pl-10 text-[12px] text-white/45">
                  {active.role} · {active.salary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="shrink-0 rounded-full px-3 py-1.5 text-sm text-white/55 transition hover:bg-white/5 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="relative aspect-[3/4] w-full overflow-y-auto bg-[#efece4]">
              <OfferLetterImage
                src={active.image}
                alt={`${active.company} ${active.role} offer letter`}
                priority
                className="h-auto w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
