import { unstable_cache } from "next/cache";
import { getPageVisibilities, type PageVisibilityKey } from "@/lib/page-visibility";
import { getSeasonalContent } from "@/lib/page-content";
import { getSiteBannerForMarket } from "@/lib/site-banner";
import type { Market } from "@/lib/market-shared";

// The root layout needs these two site-wide settings on EVERY page view, and
// they only change when an admin edits them — so reading them from the
// database each time was two round trips on every navigation for nothing.
// They're cached for a minute and dropped the moment an admin changes either
// (the actions that write them call revalidateTag(SITE_CONFIG_TAG)), so an
// edit shows up straight away rather than after the minute.
export const SITE_CONFIG_TAG = "site-config";

export const getCachedPageVisibilities = unstable_cache(
  (keys: string[]) => getPageVisibilities(keys as PageVisibilityKey[]),
  ["site-config-page-visibilities"],
  { revalidate: 60, tags: [SITE_CONFIG_TAG] },
);

export const getCachedSeasonalContent = unstable_cache(
  (market: Market) => getSeasonalContent(market),
  ["site-config-seasonal-content"],
  { revalidate: 60, tags: [SITE_CONFIG_TAG] },
);

export const getCachedSiteBanner = unstable_cache(
  (market: Market) => getSiteBannerForMarket(market),
  ["site-config-site-banner"],
  { revalidate: 60, tags: [SITE_CONFIG_TAG] },
);
