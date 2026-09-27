import {
  ACTION_VIDEOS,
  INTERVIEW_TYPES,
  OFFER_CARDS,
  TESTIMONIALS,
} from "@/components/landing/data";
import { ChevronDownIcon } from "@/components/landing/icons";
import { GoldButton, SectionEyebrow } from "@/components/landing/ui";
import { PRODUCT_NAME, WINDOWS_APP_DOWNLOAD_URL } from "@/lib/constants";

function TestimonialCard({
  quote,
  name,
  role,
  letter,
  color,
}: (typeof TESTIMONIALS)[number]) {
  return (
    <article className="w-[320px] shrink-0 rounded-2xl border border-[#1E1E1E] bg-[#191919] p-5">
      <div className="flex items-center gap-3">
        <span
          className="grid size-10 place-items-center rounded-full text-sm font-semibold text-on-accent"
          style={{ background: color }}
        >
          {letter}
        </span>
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted">{role}</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-white/80">“{quote}”</p>
    </article>
  );
}

function MarqueeRow({
  items,
  reverse = false,
}: {
  items: readonly (typeof TESTIMONIALS)[number][];
  reverse?: boolean;
}) {
  const track = items.map((item) => <TestimonialCard key={item.role + item.quote.slice(0, 12)} {...item} />);
  return (
    <div className="overflow-hidden">
      <div className={`flex w-max gap-4 ${reverse ? "animate-marquee-reverse" : "animate-marquee-slow"}`}>
        <div className="flex gap-4">{track}</div>
        <div className="flex gap-4" aria-hidden>
          {track}
        </div>
      </div>
    </div>
  );
}

export function SocialProof() {
  const firstHalf = TESTIMONIALS.slice(0, 4);
  const secondHalf = TESTIMONIALS.slice(4);

  return (
    <section className="bg-background px-5 py-24">
      <div className="mx-auto w-full max-w-6xl text-center">
        <SectionEyebrow>Candidates Spotlight</SectionEyebrow>
        <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Trusted by 150,000+
          <br className="hidden sm:block" /> candidates
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/70">
          From landing internships to staff roles at FAANG, Big Tech, Quant firms, and beyond.
        </p>
        <div className="mt-8 flex justify-center">
          <GoldButton href={WINDOWS_APP_DOWNLOAD_URL} icon={<ChevronDownIcon className="size-2.5" />}>
            Download for free
          </GoldButton>
        </div>
      </div>
      <div className="relative mt-12 space-y-4">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent sm:w-28" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent sm:w-28" />
        <MarqueeRow items={firstHalf} />
        <MarqueeRow items={secondHalf} reverse />
      </div>
    </section>
  );
}

export function InAction() {
  return (
    <section className="bg-background px-5 py-24">
      <div className="mx-auto w-full max-w-6xl">
        <SectionEyebrow>Interview Coder In Action</SectionEyebrow>
        <h2 className="text-center text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
          {PRODUCT_NAME} working on real Interviews
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-6 text-white/70">
          Works seamlessly in real interviews across engineering, product, data, and more.
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ACTION_VIDEOS.map((item) => (
            <article
              key={item.company}
              className="group overflow-hidden rounded-2xl border border-[#1E1E1E] bg-[#191919]"
            >
              <div className="relative aspect-video bg-gradient-to-br from-[#202020] to-[#0a0a0a]">
                <div className="absolute inset-0 grid place-items-center">
                  <span className="grid size-12 place-items-center rounded-full bg-accent text-on-accent shadow-[0_0_40px_rgb(154_107_69_/_0.25)] transition group-hover:scale-105">
                    <svg viewBox="0 0 24 24" className="size-5 translate-x-0.5" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </div>
                <span className="absolute left-3 top-3 rounded-md bg-black/50 px-2 py-1 text-[11px] text-white/80">
                  {item.tag}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-medium">{item.company}</p>
                <span className="text-[12px] text-muted">Watch</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function InterviewTypes() {
  const pills = [...INTERVIEW_TYPES, ...INTERVIEW_TYPES];
  return (
    <section id="types" className="scroll-mt-24 bg-background px-5 py-20">
      <h2 className="text-center text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
        Works Across Every Interview Type
      </h2>
      <div className="relative mt-10 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent" />
        <div className="flex w-max animate-marquee gap-3">
          {pills.map((type, index) => (
            <span
              key={`${type}-${index}`}
              className="rounded-full border border-white/10 bg-surface px-4 py-2 text-sm text-white/80"
            >
              {type}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Offers() {
  return (
    <section className="bg-background px-5 pb-24">
      <div className="mx-auto w-full max-w-6xl">
        <SectionEyebrow>Proven Results</SectionEyebrow>
        <h2 className="text-center text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
          10,000+ Candidates cracked Job Offers
          <br className="hidden sm:block" /> by using {PRODUCT_NAME}
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OFFER_CARDS.map((offer) => (
            <article
              key={offer.company}
              className="overflow-hidden rounded-2xl border border-[#1E1E1E] bg-[#191919]"
            >
              <div className="relative h-36 bg-[#141414] p-4">
                <div
                  className="h-full rounded-lg border border-[#1E1E1E] p-3"
                  style={{ background: `linear-gradient(180deg, ${offer.accent}22, transparent)` }}
                >
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Offer letter</p>
                  <p className="mt-3 text-lg font-semibold">{offer.company}</p>
                  <p className="mt-1 text-sm text-accent">{offer.salary}</p>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm leading-6 text-muted">
                  Cracked {offer.salary} job at {offer.company} with help of {PRODUCT_NAME}
                </p>
                <span className="mt-3 inline-block text-[13px] text-accent">View offer</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
