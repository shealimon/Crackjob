import { Hero } from "@/components/landing/hero";
import { AppDemoSection } from "@/components/landing/app-demo-section";
import { FinalCta } from "@/components/landing/final-cta";
import { PricingSection } from "@/components/landing/pricing-section";
import { ProofSection } from "@/components/landing/proof-section";

export default function Home() {
  return (
    <main className="flex-1">
      <Hero />
      <AppDemoSection />
      <ProofSection />
      <PricingSection />
      <FinalCta />
    </main>
  );
}
