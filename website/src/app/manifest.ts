import type { MetadataRoute } from "next";
import { PRODUCT_NAME } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${PRODUCT_NAME} — AI Interview Assistant`,
    short_name: PRODUCT_NAME,
    description:
      "AI interview assistant for live interviews — real-time help with coding interviews, DSA, SQL, system design, and interview preparation.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0705",
    theme_color: "#0b0705",
    icons: [
      {
        src: "/logo.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
