import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { DeferredAppDemo } from "@/components/landing/deferred-app-demo";
import { Hero } from "@/components/landing/hero";
import { Platforms } from "@/components/landing/platforms";
import { PRODUCT_NAME } from "@/lib/constants";
import { SEO_DESCRIPTION } from "@/lib/seo";

const ProofSection = dynamic(() =>
  import("@/components/landing/proof-section").then((m) => ({
    default: m.ProofSection,
  })),
);

const PricingSection = dynamic(() =>
  import("@/components/landing/pricing-section").then((m) => ({
    default: m.PricingSection,
  })),
);

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
      <DeferredAppDemo />
      <ProofSection />
      <PricingSection />
      <Platforms />
    </main>
  );
}
