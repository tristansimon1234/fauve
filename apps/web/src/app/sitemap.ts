import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only the pages meant to be found. The legal pages stay out until their company details are filled in.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, changeFrequency: "weekly", priority: 1 }];
}
