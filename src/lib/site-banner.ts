import { prisma } from "@/lib/prisma";
import type { Market } from "@/lib/market-shared";

// Lazily-created singleton row (fixed id "singleton") — same
// self-provisioning pattern as getCommerceSettings/getLoyaltySettings.
export async function getSiteBannerSettings() {
  const existing = await prisma.siteBannerSettings.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  try {
    return await prisma.siteBannerSettings.create({ data: { id: "singleton" } });
  } catch {
    return prisma.siteBannerSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  }
}

export interface SiteBannerForMarket {
  enabled: boolean;
  message: string | null;
}

/** The one thing RootLayout actually needs — whether this market's banner
 * is on, and what it says — without the caller touching the raw row shape. */
export async function getSiteBannerForMarket(market: Market): Promise<SiteBannerForMarket> {
  const settings = await getSiteBannerSettings();
  return market === "lk"
    ? { enabled: settings.lkEnabled, message: settings.lkMessage }
    : { enabled: settings.intlEnabled, message: settings.intlMessage };
}
