import type { Metadata } from "next";
import { Suspense } from "react";
import { QuestionsBoard } from "@/components/questions/questions-board";
import { PRODUCT_NAME } from "@/lib/constants";
import { REAL_QUESTIONS } from "@/lib/real-questions";
import { absoluteUrl, SEO_SHARE_IMAGE } from "@/lib/seo";

const TITLE = "Real Interview Questions";
const DESCRIPTION = `Recent coding, LLD, and system-design interview write-ups from product companies — shared so you can see what ${PRODUCT_NAME} users actually faced.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/questions") },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl("/questions"),
    images: [SEO_SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/twitter-image"],
  },
};

function questionsJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl("/questions"),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: REAL_QUESTIONS.length,
      itemListElement: REAL_QUESTIONS.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/questions/${item.slug}`),
        name: item.title,
      })),
    },
  };
}

export default function QuestionsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(questionsJsonLd()).replace(/</g, "\\u003c"),
        }}
      />
      <h1 className="sr-only">{TITLE}</h1>
      <Suspense
        fallback={<div className="mx-auto h-64 w-full max-w-[880px] animate-pulse rounded-2xl bg-black/[0.04]" />}
      >
        <QuestionsBoard />
      </Suspense>
    </main>
  );
}
