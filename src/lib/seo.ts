import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/constants";

/** Canonical production site (www — matches desktop + middleware). */
export const SITE_URL = "https://www.porpin.com";

export const SITE_NAME = PRODUCT_NAME;

export const SEO_TITLE_DEFAULT =
  `${PRODUCT_NAME} — AI Interview Assistant for Coding & Live Rounds`;

export const SEO_TITLE_TEMPLATE = `%s | ${PRODUCT_NAME}`;

export const SEO_DESCRIPTION =
  `${PRODUCT_NAME} is an undetectable AI interview application for Zoom, Google Meet, and Teams. Real-time answers for coding interviews, DSA, system design, LLD, OA, and behavioral rounds — like ChatGPT built for live interviews, hidden from screen share.`;

/** Search phrases people use when looking for AI interview tools. */
export const SEO_KEYWORDS = [
  "AI interview assistant",
  "AI interview application",
  "AI for coding interviews",
  "ChatGPT for interviews",
  "ChatGPT interview helper",
  "AI coding interview copilot",
  "undetectable AI interview",
  "live interview AI",
  "technical interview AI",
  "DSA interview AI",
  "system design interview AI",
  "LeetCode interview AI",
  "Zoom interview AI",
  "Google Meet interview AI",
  "Teams interview AI",
  "screen share invisible AI",
  "AI interview overlay",
  "Crackjob",
  "Crackjob AI",
  "porpin",
];

export function absoluteUrl(path = "/"): string {
  if (!path || path === "/") return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const defaultMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SEO_TITLE_DEFAULT,
    template: SEO_TITLE_TEMPLATE,
  },
  description: SEO_DESCRIPTION,
  applicationName: PRODUCT_NAME,
  authors: [{ name: PRODUCT_NAME, url: SITE_URL }],
  creator: PRODUCT_NAME,
  publisher: PRODUCT_NAME,
  keywords: SEO_KEYWORDS,
  category: "technology",
  classification: "AI Interview Software",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: PRODUCT_NAME,
    title: SEO_TITLE_DEFAULT,
    description: SEO_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_TITLE_DEFAULT,
    description: SEO_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
  other: {
    "theme-color": "#0b0705",
  },
};

/** JSON-LD for Google rich results / Knowledge-style understanding. */
export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: PRODUCT_NAME,
    alternateName: ["Crackjob AI", "Porpin Crackjob", "Crack AI Interview"],
    url: SITE_URL,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "AI Interview Assistant",
    operatingSystem: "Windows",
    description: SEO_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free explore mode; paid plans for full interview access",
    },
    featureList: [
      "Real-time AI answers during live interviews",
      "Invisible on Zoom, Google Meet, and Microsoft Teams screen share",
      "DSA, system design, LLD, OA, and behavioral interview support",
      "Desktop overlay for coding interviews",
    ],
    keywords: SEO_KEYWORDS.join(", "),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: PRODUCT_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/logo.svg"),
    description: SEO_DESCRIPTION,
    sameAs: [] as string[],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: PRODUCT_NAME,
    alternateName: ["Crackjob", "porpin.com"],
    url: SITE_URL,
    description: SEO_DESCRIPTION,
  };
}
