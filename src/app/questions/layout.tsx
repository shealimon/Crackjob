import { AppDownloadLink } from "@/components/app-download-link";
import { BrandMark } from "@/components/brand-mark";
import { SiteHeader } from "@/components/site-header";
import Link from "next/link";

export default function QuestionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-light flex min-h-full flex-1 flex-col bg-[var(--dash-bg)] text-[var(--dash-fg)]">
      <SiteHeader tone="light" />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <footer className="border-t border-black/8 px-5 py-8">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <Link href="/" className="dash-brand text-black">
            <BrandMark />
          </Link>
          <AppDownloadLink className="inline-flex h-10 items-center rounded-full bg-black px-5 text-[13px] font-semibold text-white transition hover:bg-black/85">
            Get for Windows
          </AppDownloadLink>
        </div>
      </footer>
    </div>
  );
}
