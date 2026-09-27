"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { CurrentYear } from "@/components/current-year";
import { LEGAL_NAV, LEGAL_SUPPORT_EMAIL, legalPath } from "@/lib/legal-content";

export function LegalSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-0 flex-col px-2.5 py-4">
      <div className="flex h-14 items-center px-1.5">
        <Link href="/" className="dash-brand inline-flex" onClick={onNavigate}>
          <BrandMark />
        </Link>
      </div>

      <nav className="mt-2 flex-1 space-y-5 overflow-y-auto pb-4">
        <div>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/40">
            Legal
          </p>
          <ul className="mt-0.5 flex flex-col gap-0.5">
            {LEGAL_NAV.map((item) => {
              const href = legalPath(item.id);
              const active = pathname === href;
              return (
                <li key={item.id}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={`block rounded-lg px-3 py-2.5 text-[14px] font-medium transition ${
                      active
                        ? "bg-black/[0.06] text-black"
                        : "text-black/55 hover:bg-black/[0.04] hover:text-black"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/40">
            Support
          </p>
          <a
            href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
            className="mt-1 block rounded-lg px-3 py-2 text-[14px] text-black/55 transition hover:bg-black/[0.04] hover:text-black"
          >
            {LEGAL_SUPPORT_EMAIL}
          </a>
        </div>
      </nav>

      <p className="border-t border-black/8 px-3 pt-4 text-[11px] leading-5 text-black/40">
        © <CurrentYear /> Crackjob.
      </p>
    </div>
  );
}
