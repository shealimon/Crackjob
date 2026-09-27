import { UNDETECTABLE_FEATURES } from "@/components/landing/data";
import { CardIcon, SectionEyebrow } from "@/components/landing/ui";

function DockArt() {
  return (
    <div className="mt-8 flex h-28 items-end justify-center rounded-[10px] bg-white px-4 pb-4">
      <div className="flex items-end gap-2 rounded-2xl bg-[#ececec] px-3 py-2">
        {["#8b5a2b", "#ef4444", "#ffffff", "#c4a574", "#9ca3af"].map((color, i) => (
          <span
            key={color}
            className="rounded-lg"
            style={{
              width: 28,
              height: i === 3 ? 20 : 28,
              background: i === 3 ? "transparent" : color,
              boxShadow: i === 3 ? "inset 0 0 0 1px #d4d4d4" : undefined,
              opacity: i === 3 ? 0.4 : 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function MonitorArt() {
  return (
    <div className="mt-6 h-[140px] rounded-[10px] bg-white p-3 font-mono text-[10px] text-[#555]">
      {["WindowServer", "Google Chrome", "Code", "Finder", "kernel_task"].map((row) => (
        <div key={row} className="flex items-center justify-between py-1">
          <span>{row}</span>
          <span className="text-[#aaa]">0.1%</span>
        </div>
      ))}
    </div>
  );
}

function ClickArt() {
  return (
    <div className="relative mt-6 h-[140px] overflow-hidden rounded-[10px] bg-white">
      <div className="absolute inset-4 rounded-lg border border-dashed border-accent/60 bg-accent/10" />
      <div className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rotate-12 border-l-2 border-t-2 border-chocolate" />
    </div>
  );
}

function RecordArt() {
  return (
    <div className="mt-6 grid h-[140px] grid-cols-2 gap-2 rounded-[10px] bg-white p-3">
      <div className="rounded-lg bg-[#111] p-2">
        <p className="text-[9px] text-accent">You see</p>
        <p className="mt-2 font-mono text-[9px] text-accent">overlay</p>
      </div>
      <div className="rounded-lg bg-[#eee] p-2">
        <p className="text-[9px] text-[#888]">They see</p>
        <p className="mt-2 font-mono text-[9px] text-[#bbb]">clean IDE</p>
      </div>
    </div>
  );
}

function Art({ kind }: { kind: (typeof UNDETECTABLE_FEATURES)[number]["kind"] }) {
  if (kind === "dock") return <DockArt />;
  if (kind === "monitor") return <MonitorArt />;
  if (kind === "click") return <ClickArt />;
  return <RecordArt />;
}

export function Undetectable() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-background px-6 py-[70px] md:px-12 md:py-16">
      <div className="mx-auto w-full max-w-6xl">
        <SectionEyebrow>How it works</SectionEyebrow>
        <h2 className="text-center text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
          How we&apos;re undetectable
        </h2>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {UNDETECTABLE_FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="flex h-full flex-col rounded-2xl border border-[#1E1E1E] bg-[#191919] p-2.5"
            >
              <Art kind={feature.kind} />
              <div className="mt-2.5 flex flex-1 flex-col gap-4 px-2.5 py-2.5">
                <CardIcon />
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-medium tracking-[-0.02em]">{feature.title}</h3>
                  {"badge" in feature && feature.badge ? (
                    <span className="rounded-full bg-accent/5 p-[5px]">
                      <span className="rounded-full bg-accent px-1.5 py-0.5 text-[8px] font-semibold uppercase text-on-accent">
                        {feature.badge}
                      </span>
                    </span>
                  ) : null}
                </div>
                <p className="text-sm leading-6 text-white/60">{feature.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
