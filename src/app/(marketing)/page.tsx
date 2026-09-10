import type { Metadata } from "next";
import { Hero } from "@/components/landing/hero";
import { AppDemoSection } from "@/components/landing/app-demo-section";
import { FinalCta } from "@/components/landing/final-cta";
import { PricingSection } from "@/components/landing/pricing-section";
import { ProofSection } from "@/components/landing/proof-section";
import { PRODUCT_NAME } from "@/lib/constants";
import { SEO_DESCRIPTION } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: `${PRODUCT_NAME} — AI Interview Assistant | ChatGPT-style Help for Coding Interviews`,
  },
  description: SEO_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${PRODUCT_NAME} — AI Interview Application for Live Coding Rounds`,
    description: SEO_DESCRIPTION,
    url: "/",
  },
};

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
