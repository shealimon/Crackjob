import { SiteFooterBottom } from "@/components/site-footer-bottom";
import { SiteHeader } from "@/components/site-header";

export default function QuestionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-light flex min-h-full flex-1 flex-col bg-[var(--dash-bg)] text-[var(--dash-fg)]">
      <SiteHeader tone="light" />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <SiteFooterBottom tone="light" />
    </div>
  );
}
