import type { MetadataRoute } from "next";
import { HELP_TOPIC_IDS } from "@/lib/help-content";
import { absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const helpPages = HELP_TOPIC_IDS.map((topic) => ({
    url: absoluteUrl(`/how-it-works/${topic}`),
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: absoluteUrl("/"),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...helpPages,
    {
      url: absoluteUrl("/signup"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/login"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
