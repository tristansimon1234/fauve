import type { MetadataRoute } from "next";
import { COMPARISONS } from "@/content/comparatifs";
import { GUIDES } from "@/content/guides";
import { TRADES } from "@/content/metiers";
import { complete } from "@/lib/legal";
import { SITE_URL } from "@/lib/site";

// The pages meant to be found: the landing, the trades, the guides, the comparisons, and the legal pages
// once their company details are filled in (lib/legal.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...TRADES.map((t) => ({ url: `${SITE_URL}/community-manager/${t.slug}`, changeFrequency: "monthly" as const, priority: 0.9 })),
    { url: `${SITE_URL}/guides`, changeFrequency: "weekly", priority: 0.7 },
    ...GUIDES.map((g) => ({ url: `${SITE_URL}/guides/${g.slug}`, lastModified: g.updated ?? g.published, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...COMPARISONS.map((c) => ({ url: `${SITE_URL}/comparatif/${c.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...(complete ? ["/conditions", "/sous-traitance", "/confidentialite", "/mentions-legales"].map((path) => ({ url: `${SITE_URL}${path}`, changeFrequency: "yearly" as const, priority: 0.2 })) : []),
  ];
}
