import type { MetadataRoute } from "next";
import { COMPARISONS } from "@/content/comparatifs";
import { GUIDES } from "@/content/guides";
import { TRADES } from "@/content/metiers";
import { SITE_URL } from "@/lib/site";

// The pages meant to be found: the landing, the trades, the guides, the comparisons. The legal pages
// stay out until their company details are filled in.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...TRADES.map((t) => ({ url: `${SITE_URL}/community-manager/${t.slug}`, changeFrequency: "monthly" as const, priority: 0.9 })),
    { url: `${SITE_URL}/guides`, changeFrequency: "weekly", priority: 0.7 },
    ...GUIDES.map((g) => ({ url: `${SITE_URL}/guides/${g.slug}`, lastModified: g.updated ?? g.published, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...COMPARISONS.map((c) => ({ url: `${SITE_URL}/comparatif/${c.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
