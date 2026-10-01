"use client";

import Link from "@/components/ui/MarketLink";
import { useAppPathname, useMarket } from "@/components/providers/MarketProvider";
import { withMarket } from "@/lib/market-shared";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Menu, X, User, ShoppingBag, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { MarketSwitcher, MarketSwitcherInline } from "@/components/layout/MarketSwitcher";
import { KandyanBand } from "@/components/decor/Kandyan";
import { HeaderSearch } from "@/components/layout/HeaderSearch";
import type { AppLocale } from "@/i18n/request";

// `key` looks up the label in messages/*.json's "nav" namespace (see
// useTranslations("nav") below) — kept separate from `href` since a route
// path is never itself translated, only the link text is.
const BASE_NAV_LINKS = [
  { href: "/gems", key: "gems" },
  { href: "/jewelry", key: "jewelry" },
  { href: "/configurator", key: "configurator" },
  { href: "/sourcing", key: "sourcing" },
  { href: "/about", key: "about" },
] as const;

const PROMOTIONS_LINK = { href: "/promotions", key: "promotions" } as const;
const AUCTION_LINK = { href: "/auction", key: "auctions" } as const;
const DESIGN_STUDIO_LINK = { href: "/design-studio", key: "designStudio" } as const;

// Solidify almost as soon as the page moves, on the home page specifically
// — its hero's own headline sits well within the first ~150px, so a
// threshold based on viewport height (e.g. "70% scrolled") leaves a wide
// window where that text scrolls up underneath the still-transparent nav
// and visibly collides with it.
const SOLID_THRESHOLD_PX = 24;

// Every other route that gets the transparent-over-hero treatment has a
// full min-h-dvh hero (see AlternativeCollectionPage and the promotions
// pages) rather than home's short one, so solidifying at the same tiny
// pixel offset would turn the nav solid while most of that hero image is
// still on screen below it. This instead waits until the hero itself is
// nearly scrolled past — clamped so a very short viewport (landscape
// phone) still gets a sane minimum.
function solidThresholdFor(isHome: boolean): number {
  return isHome ? SOLID_THRESHOLD_PX : Math.max(200, window.innerHeight - 120);
}

// Routes whose own first section is a full-bleed hero — same list
// MainWrapper uses for its own "no top padding" treatment (see its own
// comment), reused here since a transparent-until-scrolled nav only makes
// sense over that same hero. Deliberately narrower than MainWrapper's own
// list: /about and /sourcing use a *light* hero image, where light
// ivory nav text wouldn't stay legible the way it does over these
// pages' dark ones. /promotions and /promotions/collection are handled
// separately below — their hero's darkness depends on the active
// seasonal theme (see promotionsThemeIsDark).
const TRANSPARENT_NAV_ROUTES = ["/"];
const PROMOTIONS_ROUTES = ["/promotions", "/promotions/collection"];

export function Navbar({
  user,
  showPromotions,
  showAuction,
  showDesignStudio,
  cartItemCount,
  promotionsThemeIsDark,
  locale,
}: {
  user: { name?: string | null; email?: string | null; hasAdminAccess?: boolean } | null;
  /** True when the seasonal promotions page is Coming Soon or Live (see
   * PageVisibility, key "seasonal") — Hidden means no link at all,
   * matching the page itself not existing publicly. */
  showPromotions: boolean;
  /** Same idea as showPromotions, for the /auction page (PageVisibility
   * key "auction"). */
  showAuction: boolean;
  /** True only when the Design Studio (PageVisibility key "design-studio")
   * is Live — unlike showPromotions/showAuction, Coming Soon doesn't light
   * this up too, since /design-studio has no themed teaser for that state
   * (it would just render the real, working editor) — see
   * src/app/design-studio/page.tsx's own comment on its gate. */
  showDesignStudio: boolean;
  /** Retail (shopping) cart item count — 0 when signed out, in which
   * case the icon itself is still shown (it just links to sign in). */
  cartItemCount: number;
  /** Whether the currently-active seasonal theme's hero is dark (see
   * SeasonalThemeDef.isDark) — only then is transparent ivory nav text
   * legible over /promotions and /promotions/collection. Halloween is
   * dark; Spring/Summer/Autumn/Winter are light. */
  promotionsThemeIsDark: boolean;
  /** The active UI language — see SiteChrome's own comment. */
  locale: AppLocale;
}) {
  const t = useTranslations("nav");
  const tMarket = useTranslations("market");
  const market = useMarket();
  const pathname = useAppPathname();
  const [open, setOpen] = useState(false);
  const navLinks = [
    ...BASE_NAV_LINKS.slice(0, 4),
    ...(showAuction ? [AUCTION_LINK] : []),
    ...(showPromotions ? [PROMOTIONS_LINK] : []),
    ...(showDesignStudio ? [DESIGN_STUDIO_LINK] : []),
    ...BASE_NAV_LINKS.slice(4),
  ];
  // With the optional Auctions and Promotions links showing there are seven
  // links plus the store/language controls and (signed in) an account menu
  // showing the customer's name — 1280px (xl) was the original threshold,
  // but that's the exact width real browsers start needing for this row at
  // 100% zoom with no slack for font-metric variance or a longer name,
  // and it was reported packed tight against the logo in practice. 1536px
  // (2xl) leaves real headroom. With the usual five links it still fits
  // from 1024px (lg). Narrower than its own threshold the hamburger menu
  // takes over (it used to switch at 768px, which wrapped the link labels
  // onto two lines).
  const wide = showAuction || showPromotions || showDesignStudio;
  const isHome = pathname === "/";
  const isTransparentRoute =
    TRANSPARENT_NAV_ROUTES.includes(pathname) ||
    pathname.startsWith("/collections/") ||
    (promotionsThemeIsDark && PROMOTIONS_ROUTES.includes(pathname));
  // `pathname` is stable across the server/client render (Next.js resolves
  // it before hydration), so this initial value never mismatches — only the
  // actual scroll position is genuinely client-only.
  const [scrolled, setScrolled] = useState(!isTransparentRoute);
  // Close on navigation (covers back/forward too, not just link clicks —
  // those already call setOpen(false) directly). Adjusted during render
  // (React's documented pattern for "reset state when a prop changes")
  // rather than in an effect, which would set state synchronously right
  // after the first render and trigger an extra one.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
    // Navbar persists across navigations (it lives outside MainWrapper's
    // per-route remount), so without this, arriving at a fresh
    // full-bleed-hero page could inherit whatever `scrolled` the
    // *previous* page's scroll position had left behind, rather than
    // starting transparent the way a real first paint of that page would.
    setScrolled(!isTransparentRoute);
  }

  const transparent = isTransparentRoute && !scrolled && !open;

  useEffect(() => {
    if (!isTransparentRoute) return;
    const onScroll = () => setScrolled(window.scrollY > solidThresholdFor(isHome));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isTransparentRoute, isHome]);

  // The open menu is a full-screen takeover (below), so background
  // content must not scroll underneath it — otherwise a swipe against the
  // menu can scroll the page behind it (most noticeable as iOS Safari
  // rubber-banding), and the CTA buttons peeking out from under a
  // non-full-screen menu would otherwise stay tappable through it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <motion.header
      initial={false}
      animate={{
        backgroundColor: transparent ? "rgba(33,29,26,0)" : "rgba(251,248,242,0.96)",
        boxShadow: transparent ? "0 1px 0 rgba(255,255,255,0)" : "0 1px 0 rgba(33,29,26,0.08)",
      }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "fixed top-0 z-50 w-full backdrop-blur-sm",
        transparent && !open && "backdrop-blur-0",
        // Capped at (not forced to) full-viewport height while open — the
        // dropdown sizes to its own content and scrolls internally if it's
        // genuinely taller than the screen; forcing a solid h-dvh fill
        // regardless of content left a large blank ivory area below a
        // short menu (e.g. signed out, or a locale with few nav links).
        // Background scroll is blocked independently below (body overflow
        // lock), so this doesn't need to claim the full viewport itself.
        open && "flex max-h-dvh flex-col overflow-hidden bg-ivory",
      )}
    >
      <div className="mx-auto flex w-full max-w-[120rem] shrink-0 items-center justify-between px-5 py-5 sm:px-8 lg:px-12 xl:px-16">
        <Link
          href="/"
          className={cn(
            "font-serif text-2xl tracking-wide transition-colors duration-300",
            transparent ? "text-ivory" : "text-charcoal"
          )}
        >
          Ratnavue
          {/* The badge is redundant in Sinhala/Tamil (the store switcher already
              names the store) and their longer nav labels leave no room for it. */}
          {market === "lk" && locale !== "si" && locale !== "ta" && (
            <span
              className={cn(
                "ml-2 hidden align-super font-sans sm:inline lg:hidden xl:inline text-[10px] font-medium uppercase tracking-[0.22em] transition-colors duration-300",
                transparent ? "text-gold-soft" : "text-gold-deep",
              )}
            >
              {tMarket("badge")}
            </span>
          )}
        </Link>

        <nav className={cn(wide ? "hidden 2xl:flex" : "hidden lg:flex", "items-center gap-5 xl:gap-6 2xl:gap-8")}>
          {navLinks.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative whitespace-nowrap pb-1 text-sm tracking-wide transition-colors duration-300 after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-gold after:transition-all after:duration-300 hover:after:w-full",
                  transparent ? "text-ivory/85 hover:text-ivory" : "text-charcoal/75 hover:text-charcoal",
                  active && (transparent ? "text-ivory" : "text-charcoal font-medium")
                )}
              >
                {t(link.key)}
                {/* Shared layoutId — Framer Motion tracks this element's
                    identity across renders and animates it from wherever it
                    was (under the previously active link) to wherever it now
                    is, instead of the underline just snapping from link to
                    link the way the hover-only `after:` pseudo-element does. */}
                {active && (
                  <motion.span
                    layoutId="navbar-active-indicator"
                    className={cn("absolute -bottom-1 left-0 h-px w-full", transparent ? "bg-ivory" : "bg-gold")}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className={cn(wide ? "hidden 2xl:flex" : "hidden lg:flex", "items-center gap-5")}>
          <HeaderSearch transparent={transparent} />
          <Link
            href={user ? "/account/retail-cart" : "/account/login?callbackUrl=%2Faccount%2Fretail-cart"}
            aria-label={t("cart")}
            className={cn(
              "relative transition-colors duration-300",
              transparent ? "text-ivory/85 hover:text-ivory" : "text-charcoal/80 hover:text-charcoal"
            )}
          >
            <ShoppingBag size={19} />
            {cartItemCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-medium text-charcoal">
                {cartItemCount > 99 ? "99+" : cartItemCount}
              </span>
            )}
          </Link>
          {user && <NotificationBell transparent={transparent} />}
          {user ? (
            <AccountMenu user={user} transparent={transparent} />
          ) : (
            <Link
              href="/account/login"
              className={cn(
                "flex items-center gap-2 whitespace-nowrap text-sm transition-colors duration-300",
                transparent ? "text-ivory/85 hover:text-ivory" : "text-charcoal/80 hover:text-charcoal"
              )}
            >
              <User size={16} />
              {t("signIn")}
            </Link>
          )}
          <MarketSwitcher transparent={transparent} />
          <LocaleSwitcher locale={locale} transparent={transparent} />
        </div>

        <div className={cn(wide ? "2xl:hidden" : "lg:hidden", "flex items-center gap-2.5 min-[430px]:gap-4")}>
          <Link
            href={user ? "/account/retail-cart" : "/account/login?callbackUrl=%2Faccount%2Fretail-cart"}
            aria-label={t("cart")}
            className={cn("relative transition-colors duration-300", transparent ? "text-ivory" : "text-charcoal")}
          >
            <ShoppingBag size={21} />
            {cartItemCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-medium text-charcoal">
                {cartItemCount > 99 ? "99+" : cartItemCount}
              </span>
            )}
          </Link>
          {user && <NotificationBell transparent={transparent} size={21} />}
          {/* A dedicated account entry point, same as the desktop row's
              own AccountMenu/sign-in link — kept separate from the
              hamburger below rather than folded into its dropdown, so
              that menu is purely navigation (search, nav links, store/
              language) and account actions (orders, messages, sign out)
              don't require opening it first. */}
          {user ? (
            <AccountMenu user={user} transparent={transparent} compact />
          ) : (
            <Link href="/account/login" aria-label={t("signIn")} className={cn("transition-colors duration-300", transparent ? "text-ivory" : "text-charcoal")}>
              <User size={21} />
            </Link>
          )}
          <MarketSwitcher transparent={transparent} />
          <LocaleSwitcher locale={locale} transparent={transparent} />
          <button
            className={cn("transition-colors duration-300", transparent ? "text-ivory" : "text-charcoal")}
            onClick={() => setOpen((v) => !v)}
            aria-label={t("toggleMenu")}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Sri Lanka store: a slim Kandyan frieze along the header's lower edge.
          Absolute (not in flow) so it doesn't change the header's height, and
          hidden while the nav is transparent over a hero or the mobile menu is
          open. */}
      {market === "lk" && !open && (
        <KandyanBand
          className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-2 text-gold transition-opacity duration-300", transparent ? "opacity-0" : "opacity-55")}
        />
      )}

      {open && (
        <nav className={cn(wide ? "2xl:hidden" : "lg:hidden", "flex flex-col gap-1 overflow-y-auto border-t border-border-subtle bg-ivory px-5 py-4")}>
          <form action={withMarket("/search", market)} method="get" className="mb-2 flex items-center gap-2 border-b border-border-subtle pb-3">
            <Search size={16} className="shrink-0 text-charcoal/65" />
            <input
              name="q"
              placeholder="Search gems, jewelry..."
              className="w-full bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal/65"
            />
          </form>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "py-3 text-sm text-charcoal/80",
                pathname.startsWith(link.href) && "font-medium text-charcoal"
              )}
              onClick={() => setOpen(false)}
            >
              {t(link.key)}
            </Link>
          ))}
          <div className="mt-2 border-t border-border-subtle pt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-charcoal/65">{tMarket("switchLabel")}</p>
            <MarketSwitcherInline />
          </div>
        </nav>
      )}
    </motion.header>
  );
}
