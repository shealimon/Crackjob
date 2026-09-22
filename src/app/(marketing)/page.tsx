import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { DeferredAppDemo } from "@/components/landing/deferred-app-demo";
import { Hero } from "@/components/landing/hero";
import { Platforms } from "@/components/landing/platforms";
import { homepageJsonLd, homepageMetadata } from "@/lib/seo";

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

export const metadata: Metadata = homepageMetadata;

export default function Home() {
  return (
    <main className="flex-1">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homepageJsonLd()).replace(/</g, "\\u003c"),
        }}
      />
      <Hero />
      <DeferredAppDemo />
      <ProofSection />
      <PricingSection />
      <Platforms />
    </main>
  );
}
