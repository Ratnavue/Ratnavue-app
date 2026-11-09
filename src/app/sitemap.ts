import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getPageVisibilities } from "@/lib/page-visibility";
import { SUBCULTURE_KEYS } from "@/lib/subculture-collections";
import { getAllSubcultureContent } from "@/lib/subculture-content";

const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3000";
const LK = "/lk";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [gems, jewelry, collectionVisibilities, collectionContent] = await Promise.all([
    prisma.gemstone.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true, market: true } }),
    prisma.jewelryPiece.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true, market: true } }),
    getPageVisibilities([...SUBCULTURE_KEYS]),
    getAllSubcultureContent(),
  ]);

  // The five hidden subculture collections: never linked from nav, but —
  // unlike /promotions, which deliberately omits itself here — these
  // should be discoverable by search engines once an admin turns one on,
  // per the brief's explicit ask. Hidden ones stay out entirely, same
  // "doesn't exist publicly yet" rule the page itself enforces. Listed by
  // each collection's current, admin-editable urlSlug — never the fixed
  // internal key, which won't reflect a rename.
  const collectionRoutes: MetadataRoute.Sitemap = SUBCULTURE_KEYS.filter((key) => collectionVisibilities[key] === "LIVE").map((key) => ({
    url: `${BASE_URL}/collections/${collectionContent[key].urlSlug}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/gems`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/jewelry`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/configurator`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/sourcing`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/contact`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE_URL}/size-guide`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const gemRoutes: MetadataRoute.Sitemap = gems.filter((g) => g.market === "intl").map((g) => ({
    url: `${BASE_URL}/gems/${g.slug}`,
    lastModified: g.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const jewelryRoutes: MetadataRoute.Sitemap = jewelry.filter((j) => j.market === "intl").map((j) => ({
    url: `${BASE_URL}/jewelry/${j.slug}`,
    lastModified: j.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // The Sri Lanka store (/lk) has its own catalog (listings never appear on
  // both stores): its home and list pages plus its own product pages. The
  // other marketing pages are shared and stay under the main entries.
  const lkRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}${LK}`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}${LK}/gems`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}${LK}/jewelry`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}${LK}/configurator`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}${LK}/sourcing`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}${LK}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}${LK}/contact`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE_URL}${LK}/size-guide`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}${LK}/terms`, changeFrequency: "yearly", priority: 0.2 },
    ...gems.filter((g) => g.market === "lk").map((g) => ({ url: `${BASE_URL}${LK}/gems/${g.slug}`, lastModified: g.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...jewelry.filter((j) => j.market === "lk").map((j) => ({ url: `${BASE_URL}${LK}/jewelry/${j.slug}`, lastModified: j.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];

  return [...staticRoutes, ...gemRoutes, ...jewelryRoutes, ...collectionRoutes, ...lkRoutes];
}
