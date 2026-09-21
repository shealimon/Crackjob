import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const websiteRoot = path.dirname(fileURLToPath(import.meta.url));

const CANONICAL_ORIGIN = "https://crackjob.co";
const REDIRECT_HOSTS = ["www.porpin.com", "porpin.com", "www.crackjob.co"];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "razorpay", "pdf-parse", "pdfjs-dist"],
  async redirects() {
    return REDIRECT_HOSTS.flatMap((host) => [
      {
        source: "/",
        has: [{ type: "host" as const, value: host }],
        destination: CANONICAL_ORIGIN,
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host" as const, value: host }],
        destination: `${CANONICAL_ORIGIN}/:path*`,
        permanent: true,
      },
    ]);
  },
  turbopack: {
    root: websiteRoot,
  },
  experimental: {
    // Keep soft-navigations snappy; dashboard menus remount less often.
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  env: {
    NEXT_PUBLIC_GOOGLE_CONFIGURED: process.env.AUTH_GOOGLE_ID ? "true" : "false",
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
