import type { MetadataRoute } from "next";
import { PRODUCT_NAME } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${PRODUCT_NAME} — AI Interview Assistant`,
    short_name: PRODUCT_NAME,
    description:
      "Undetectable AI interview application for coding interviews, DSA, system design, and live rounds on Zoom, Meet, and Teams.",
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
