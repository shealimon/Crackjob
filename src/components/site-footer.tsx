import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { PRODUCT_NAME } from "@/lib/constants";

const FOOTER_LINKS = [
  { href: "/#pricing", label: "Pricing" },
  { href: "/download", label: "Download" },
  { href: "/#faq", label: "Help" },
  { href: "/login", label: "Login" },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative mt-auto overflow-hidden border-t border-white/[0.06] bg-[#0a0604]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10 md:px-8 md:py-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="inline-flex w-fit transition hover:opacity-90">
            <BrandMark />
          </Link>
          <nav className="flex flex-wrap gap-x-6 gap-y-3">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[13px] text-[#a2a3a6] transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="text-[12px] tracking-wide text-white/45">
          © {new Date().getFullYear()} {PRODUCT_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
