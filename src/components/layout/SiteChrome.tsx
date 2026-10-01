"use client";

import { useAppPathname } from "@/components/providers/MarketProvider";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { IntroLoader } from "./IntroLoader";
import { NavigationOverlay } from "./NavigationOverlay";
import { FloatingChatButton } from "./FloatingChatButton";
import { BackToTop } from "./BackToTop";
import type { AppLocale } from "@/i18n/request";
import type { FooterMessages, TrustBarMessages } from "@/lib/i18n-messages";

interface SiteChromeUser {
  name?: string | null;
  email?: string | null;
  hasAdminAccess?: boolean;
}

/**
 * The public Navbar/Footer/IntroLoader wrap every route by default, but the
 * admin panel has its own self-contained shell (AdminSidebar + dark theme,
 * see admin/layout.tsx) — without this check, admin pages were rendering
 * sandwiched between the storefront's fixed nav and footer as well.
 */
export function SiteChrome({
  user,
  footerMessages,
  trustBarMessages,
  showPromotions,
  showAuction,
  showDesignStudio,
  cartItemCount,
  promotionsThemeIsDark,
  locale,
  children,
}: {
  user: SiteChromeUser | null;
  /** Resolved once on the server (RootLayout) and threaded through as a
   * plain prop — see src/lib/i18n-messages.ts for why Footer (rendered
   * from this Client Component) can't call getTranslations itself. */
  footerMessages: FooterMessages;
  /** Same reasoning, forwarded through Footer to TrustBar. */
  trustBarMessages: TrustBarMessages;
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
  children: React.ReactNode;
}) {
  const pathname = useAppPathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <IntroLoader />
      <NavigationOverlay />
      <Navbar
        user={user}
        showPromotions={showPromotions}
        showAuction={showAuction}
        showDesignStudio={showDesignStudio}
        cartItemCount={cartItemCount}
        promotionsThemeIsDark={promotionsThemeIsDark}
        locale={locale}
      />
      {children}
      <Footer messages={footerMessages} trustBarMessages={trustBarMessages} showTrustBar={pathname !== "/"} />
      <BackToTop />
      {user && <FloatingChatButton />}
    </>
  );
}
