import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Crawl the storefronts (both / and /lk); keep crawlers out of the back
// office, signed-in and transactional areas, and API routes — those pages
// also carry a noindex robots meta (RootLayout), this just saves crawl budget.
// Search results stay crawlable (their links lead to products) but are
// noindexed on the page itself.
export default function robots(): MetadataRoute.Robots {
  const privateAreas = ["/admin", "/account", "/checkout", "/api/"];
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...privateAreas, ...privateAreas.filter((p) => p !== "/admin" && p !== "/api/").map((p) => `/lk${p}`)],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
