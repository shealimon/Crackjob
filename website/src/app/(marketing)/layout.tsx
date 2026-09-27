import { HeroAurora } from "@/components/landing/hero-aurora";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="marketing-dark relative flex min-h-full flex-1 flex-col bg-[#0b0705]">
      <HeroAurora />
      <SiteHeader />
      <div className="relative z-10 flex flex-1 flex-col">
        {children}
        <SiteFooter />
      </div>
    </div>
  );
}
