import { PLATFORMS } from "@/components/landing/data";

const VERIFIED = "#22c55e";

function ShieldCheck() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M12 3.2 5.5 5.8v5.4c0 4.15 2.75 7.95 6.5 9.1 3.75-1.15 6.5-4.95 6.5-9.1V5.8L12 3.2z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m9.2 12.1 1.9 1.9 3.7-3.9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Platforms() {
  return (
    <section id="platforms" className="scroll-mt-24 px-5 py-16 md:py-20">
      <div className="mx-auto w-full max-w-[88rem]">
        <div className="flex flex-col items-center justify-center gap-2 text-center sm:flex-row sm:flex-wrap sm:gap-x-3">
          <p className="inline-flex items-center gap-2 font-display text-base font-semibold tracking-tight text-white sm:text-lg">
            <span style={{ color: VERIFIED }}>
              <ShieldCheck />
            </span>
            We check it stays invisible on every one of these
          </p>
          <p className="text-sm text-white/45">Checked daily</p>
        </div>

        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8 lg:gap-3">
          {PLATFORMS.map((platform) => (
            <li key={platform.id}>
              <article className="flex h-full min-h-[168px] flex-col rounded-2xl border border-line bg-surface p-4 transition hover:border-accent/35 hover:bg-surface-2 sm:min-h-[180px] sm:p-5">
                <div className="flex flex-1 items-center justify-center py-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- mixed SVG/PNG brand marks */}
                  <img
                    src={platform.logo}
                    alt={`${platform.name} logo`}
                    width={56}
                    height={56}
                    className="size-12 object-contain sm:size-14"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="mt-auto flex flex-col items-center text-center">
                  <p className="font-display text-[13px] font-semibold leading-snug tracking-tight text-white sm:text-sm">
                    {platform.name}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-2 text-[12px] text-white/45">
                    <span
                      className="inline-block rounded-full"
                      style={{ width: 6, height: 6, backgroundColor: VERIFIED }}
                      aria-hidden="true"
                    />
                    Verified
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-sm text-white/40">
          Same screen-share path across every platform above.
        </p>
      </div>
    </section>
  );
}
