import type { Metadata } from "next";
import { headers } from "next/headers";
import { Cormorant_Garamond, Inter, Noto_Sans_Sinhala, Noto_Serif_Sinhala, Noto_Sans_Tamil, Noto_Serif_Tamil } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { marketVisibilityKey } from "@/lib/page-visibility";
import { getCachedPageVisibilities, getCachedSeasonalContent } from "@/lib/site-config-cache";
import { SEASONAL_THEMES } from "@/lib/seasonal-themes";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { MainWrapper } from "@/components/layout/MainWrapper";
import { getFooterMessages, getTrustBarMessages } from "@/lib/i18n-messages";
import { getMarket } from "@/lib/market";
import { hasAdminPortalAccess } from "@/lib/admin-access";
import { APP_PATH_HEADER, withMarket } from "@/lib/market-shared";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { MarketProvider } from "@/components/providers/MarketProvider";
import { ConfirmProvider } from "@/components/providers/ConfirmProvider";
import type { AppLocale } from "@/i18n/request";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Cormorant and Inter have no Sinhala or Tamil glyphs, so those scripts fall
// back to Noto. Declared after the Latin fonts in the per-language font
// stacks (see globals.css) so English words and numbers keep the brand
// typefaces. preload is off — the files are only fetched when a Sinhala or
// Tamil character is actually on the page (unicode-range), so English and
// the other languages never pay for them.
const notoSansSinhala = Noto_Sans_Sinhala({ variable: "--font-noto-sans-sinhala", subsets: ["sinhala"], display: "swap", preload: false });
const notoSerifSinhala = Noto_Serif_Sinhala({ variable: "--font-noto-serif-sinhala", subsets: ["sinhala"], display: "swap", preload: false });
const notoSansTamil = Noto_Sans_Tamil({ variable: "--font-noto-sans-tamil", subsets: ["tamil"], display: "swap", preload: false });
const notoSerifTamil = Noto_Serif_Tamil({ variable: "--font-noto-serif-tamil", subsets: ["tamil"], display: "swap", preload: false });

const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3000";
// Signed-in / transactional areas — never worth a canonical or hreflang.
const PRIVATE_PREFIXES = ["/account", "/checkout", "/admin", "/api"];

export async function generateMetadata(): Promise<Metadata> {
  const [headerStore, market] = await Promise.all([headers(), getMarket()]);
  const path = headerStore.get(APP_PATH_HEADER) ?? "/";
  const isPrivate = PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + "/"));

  return {
    title: {
      default: "Ratnavue — Ceylon Gemstones & Jewelry",
      template: "%s · Ratnavue",
    },
    description:
      "Ratnavue is a Ceylon gemstone and jewelry house offering ethically sourced sapphires, rubies, and fine jewelry, with bespoke gem sourcing and quotation.",
    // The same page exists on both storefronts (dollars at /…, rupees at
    // /lk/…). Each is canonical to itself, and they're declared as
    // alternates of each other so search engines show Sri Lankan searchers
    // the rupee store and everyone else the international one, instead of
    // treating one as a duplicate of the other.
    ...(isPrivate
      ? {}
      : {
          alternates: {
            canonical: BASE_URL + withMarket(path, market),
            languages: { "en-LK": BASE_URL + withMarket(path, "lk"), "x-default": BASE_URL + path },
          },
        }),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const market = await getMarket();
  const seasonalKey = marketVisibilityKey("seasonal", market);
  const auctionKey = marketVisibilityKey("auction", market);
  const [session, visibilities, seasonalContent, locale] = await Promise.all([
    auth(),
    getCachedPageVisibilities([seasonalKey, auctionKey, "design-studio"]),
    getCachedSeasonalContent(market),
    getLocale(),
  ]);
  // Navbar's transparent-over-hero treatment on /promotions is only safe
  // when that season's hero is actually dark (Halloween) — Spring/Summer/
  // Autumn/Winter's are light, where transparent ivory nav text would go
  // illegible. Computed here (cheap, and this already fetches session/
  // visibility fresh on every navigation) rather than Navbar querying it
  // itself, same "compute where it's cheap" reasoning as cartItemCount.
  const promotionsThemeIsDark = SEASONAL_THEMES[seasonalContent.activeTheme]?.isDark ?? false;
  // Computed once here (a Server Component, so this only ever runs on the
  // server) and threaded down through SiteChrome to Footer as plain
  // prop values — see src/lib/i18n-messages.ts for why Footer can't
  // resolve its own translations.
  const [footerMessages, trustBarMessages] = await Promise.all([
    getFooterMessages(new Date().getFullYear()),
    getTrustBarMessages(),
  ]);
  // Same reasoning for the nav's cart badge — cheap enough to read fresh
  // on every navigation rather than push it into the session/JWT. Summed
  // quantity, not a row count, to match the cart page's own "N items"
  // wording (retailCartSubtotal's sibling reduce in lib/retail-cart.ts).
  const cartItemCount = session?.user
    ? (await prisma.retailCartItem.aggregate({
        where: { cart: { userId: session.user.id, market } },
        _sum: { quantity: true },
      }))._sum.quantity ?? 0
    : 0;

  return (
    <html lang={locale} data-market={market} className={`${cormorant.variable} ${inter.variable} ${notoSansSinhala.variable} ${notoSerifSinhala.variable} ${notoSansTamil.variable} ${notoSerifTamil.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-ivory text-charcoal">
        <MarketProvider market={market}>
        <NextIntlClientProvider>
          <ConfirmProvider>
            <SiteChrome
              user={session?.user ? { name: session.user.name, email: session.user.email, hasAdminAccess: hasAdminPortalAccess(session.user) } : null}
              footerMessages={footerMessages}
              trustBarMessages={trustBarMessages}
              showPromotions={visibilities[seasonalKey] !== "HIDDEN"}
              showAuction={visibilities[auctionKey] !== "HIDDEN"}
              showDesignStudio={visibilities["design-studio"] === "LIVE"}
              cartItemCount={cartItemCount}
              promotionsThemeIsDark={promotionsThemeIsDark}
              locale={locale as AppLocale}
            >
              <MainWrapper>{children}</MainWrapper>
            </SiteChrome>
          </ConfirmProvider>
        </NextIntlClientProvider>
        </MarketProvider>
        {/* Real-visitor page speed (Core Web Vitals) for the Vercel dashboard's
            Speed Insights tab; reports nothing outside a Vercel deployment. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
