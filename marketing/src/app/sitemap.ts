import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE.domain, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE.domain}${SITE.privacyUrl}`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.domain}${SITE.termsUrl}`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
