"use client";

import { ViewTransition } from "react";
import { useAppPathname } from "@/components/providers/MarketProvider";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { NavigationOverlay } from "./NavigationOverlay";
import { FloatingChatButton } from "./FloatingChatButton";
import { BackToTop } from "./BackToTop";
import { SiteStatusBanner } from "./SiteStatusBanner";
import { MotionProvider } from "@/components/providers/MotionProvider";
import type { AppLocale } from "@/i18n/request";
import type { FooterMessages } from "@/lib/i18n-messages";
import type { CustomLocale } from "@/lib/locales";

interface SiteChromeUser {
  name?: string | null;
  email?: string | null;
  hasAdminAccess?: boolean;
}

/**
 * The public Navbar/Footer wrap every route by default, but the
 * admin panel has its own self-contained shell (AdminSidebar + dark theme,
 * see admin/layout.tsx) — without this check, admin pages were rendering
 * sandwiched between the storefront's fixed nav and footer as well.
 */
export function SiteChrome({
  user,
  footerMessages,
  showPromotions,
  showAuction,
  showDesignStudio,
  cartItemCount,
  promotionsThemeIsDark,
  locale,
  customLocales,
  lkPaymentMethodsLive,
  siteBannerMessage,
  children,
}: {
  user: SiteChromeUser | null;
  /** Resolved once on the server (RootLayout) and threaded through as a
   * plain prop — see src/lib/i18n-messages.ts for why Footer (rendered
   * from this Client Component) can't call getTranslations itself. */
  footerMessages: FooterMessages;
  /** Whether the seasonal promotions page is Coming Soon or Live —
   * fetched once server-side in RootLayout (see PageVisibility) rather
   * than Navbar querying it itself, same "compute where it's cheap,
   * thread down as a plain prop" reasoning as `year`. */
  showPromotions: boolean;
  /** Same idea as showPromotions, for the /auction page's visibility. */
  showAuction: boolean;
  /** Whether an admin has turned the Design Studio (/design-studio) LIVE
   * for customers — unlike showPromotions/showAuction this is strictly
   * LIVE-only (no Coming Soon teaser exists for this page), see
   * Navbar's own comment. */
  showDesignStudio: boolean;
  /** Retail (shopping) cart item count for the nav's cart badge — 0 when
   * signed out. Same "compute where it's cheap" reasoning as `year`. */
  cartItemCount: number;
  /** Whether the currently-active seasonal theme's hero is dark — see
   * SeasonalThemeDef.isDark. Navbar needs this to know whether /promotions
   * can safely use the transparent-over-hero nav treatment. */
  promotionsThemeIsDark: boolean;
  /** The active UI language — read once in RootLayout (see src/i18n/request.ts)
   * and threaded down as a plain prop, same "compute where it's cheap"
   * reasoning as `year`. Navbar needs it for LocaleSwitcher's own highlight. */
  locale: AppLocale;
  /** Admin-added languages beyond the 7 built into the code (lib/locales.ts)
   * — read once in RootLayout and threaded down the same way as `locale`
   * itself, so LocaleSwitcher can show the full, current list. */
  customLocales: CustomLocale[];
  /** Real resolved live/coming-soon status for the Sri Lanka store's card
   * and COD methods (lib/payment-methods.ts's resolvePaymentMethods,
   * layering any /admin/commerce-settings override on the hardcoded
   * defaults) — threaded to Footer so its "Payment Options" blurb can't
   * drift from what /checkout itself actually offers. */
  lkPaymentMethodsLive: { card: boolean; cod: boolean };
  /** This market's site status banner message, already resolved from
   * whether an admin has it enabled (null = don't render one) — see
   * SiteBannerSettings. */
  siteBannerMessage: string | null;
  children: React.ReactNode;
}) {
  const pathname = useAppPathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) return <>{children}</>;

  return (
    <MotionProvider>
      <NavigationOverlay />
      {siteBannerMessage && <SiteStatusBanner message={siteBannerMessage} />}
      <Navbar
        user={user}
        showPromotions={showPromotions}
        showAuction={showAuction}
        showDesignStudio={showDesignStudio}
        cartItemCount={cartItemCount}
        promotionsThemeIsDark={promotionsThemeIsDark}
        locale={locale}
        customLocales={customLocales}
      />
      {/* Page transitions: the page and its footer sit in one <ViewTransition>
          keyed on the pathname, so a navigation (a React transition)
          unmounts the old pair and mounts the new one inside a browser view
          transition — the old page fades out ("page-exit") and the new one
          rises in ("page-enter"); see globals.css. The footer moves with the
          page so the new page's footer never shows over the outgoing one.
          update="none": a Suspense reveal or router.refresh() within one
          page isn't a page change and doesn't animate. Browsers without the
          API fall back to MainWrapper's .animate-page-in. */}
      <ViewTransition key={pathname} enter="page-enter" exit="page-exit" update="none" default="none">
        <div className="flex flex-1 flex-col">
          {children}
          <Footer messages={footerMessages} paymentMethodsLive={lkPaymentMethodsLive} />
        </div>
      </ViewTransition>
      <BackToTop />
      {user && <FloatingChatButton />}
    </MotionProvider>
  );
}
