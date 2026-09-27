import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/constants";

/** Canonical production site (matches desktop + middleware). */
export const SITE_URL = "https://crackjob.co";

export const SITE_NAME = PRODUCT_NAME;

export const SEO_TITLE_DEFAULT = `${PRODUCT_NAME} – AI Interview Assistant`;

export const SEO_TITLE_TEMPLATE = `%s | ${PRODUCT_NAME}`;

export const SEO_DESCRIPTION =
  `${PRODUCT_NAME} is an AI interview assistant for live interviews. Get real-time help with interview questions, including coding interviews, DSA, SQL, system design, and interview preparation.`;

export function absoluteUrl(path = "/"): string {
  if (!path || path === "/") return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

const indexRobots: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export const SEO_SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${PRODUCT_NAME} – AI interview assistant`,
} as const;

/** Site-wide defaults. Canonical and Open Graph URL are set per public page. */
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
  robots: indexRobots,
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple: "/logo.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: PRODUCT_NAME,
    images: [SEO_SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/twitter-image"],
  },
  other: {
    "theme-color": "#0b0705",
  },
};

export const homepageMetadata: Metadata = {
  title: {
    absolute: SEO_TITLE_DEFAULT,
  },
  description: SEO_DESCRIPTION,
  alternates: {
    canonical: absoluteUrl("/"),
  },
  robots: indexRobots,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: absoluteUrl("/"),
    title: SEO_TITLE_DEFAULT,
    description: SEO_DESCRIPTION,
    siteName: PRODUCT_NAME,
    images: [SEO_SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_TITLE_DEFAULT,
    description: SEO_DESCRIPTION,
    images: ["/twitter-image"],
  },
};

export function organizationJsonLd() {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: PRODUCT_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/logo.svg"),
    description: SEO_DESCRIPTION,
  };
}

export function websiteJsonLd() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: PRODUCT_NAME,
    url: absoluteUrl("/"),
    description: SEO_DESCRIPTION,
    publisher: {
      "@id": `${SITE_URL}/#organization`,
    },
  };
}

export function homepageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [organizationJsonLd(), websiteJsonLd()],
  };
}
