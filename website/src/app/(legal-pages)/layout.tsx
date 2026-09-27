import { SiteHeader } from "@/components/site-header";

export default function LegalPagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-light flex min-h-full flex-1 flex-col bg-[var(--dash-bg)] text-[var(--dash-fg)]">
      <SiteHeader tone="light" />
      {children}
    </div>
  );
}
