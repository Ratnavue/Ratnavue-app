"use client";

import { useAppPathname } from "@/components/providers/MarketProvider";
import { cn } from "@/lib/utils";

// Routes whose own first section is a full-bleed hero starting at the very
// top of the page (same idea as the homepage hero) — these must NOT get the
// NAV_CLEARANCE padding below, or a strip of bare background shows up
// between the fixed Navbar and the top of their hero image.
// Home, Our Story and Sourcing used to open on full-bleed photos too; their
// redesigned heroes are contained layouts and take the normal padding.
const FULL_BLEED_HERO_ROUTES = ["/promotions", "/promotions/collection"];
// /collections/[slug] (the hidden subculture landing pages) is dynamic, so
// it can't be listed above — every page under it opens with the same
// full-bleed min-h-dvh hero (see AlternativeCollectionPage).
const FULL_BLEED_HERO_PREFIXES = ["/collections/"];

// Exactly the fixed Navbar's height (py-4 around its 40px controls, plus the
// 1px bottom border = 73px), so content starts right under it; each page adds
// its own consistent top spacing (pt-10) from there. This used to be pt-24
// (96px), which with pages' own py-12..py-24 left a large empty band.
const NAV_CLEARANCE = "pt-[73px]";

/**
 * The Navbar is fixed (not sticky) so it can float transparently over the
 * homepage's full-bleed hero. Every other storefront page needs top padding
 * to clear it, since fixed elements are pulled out of document flow. Admin
 * routes render their own chrome (see SiteChrome) and never show the public
 * Navbar at all, so they need neither the home treatment nor the padding.
 *
 * `key={pathname}` forces a fresh <main> on every navigation so
 * .animate-page-in's entrance (see globals.css) restarts each time instead
 * of only playing once on first load — without it, React would just patch
 * the existing DOM in place and the new page would simply pop in, which is
 * the "not just appearing right away" this exists to fix. Each route is
 * already an independent Server Component render, so remounting here
 * doesn't lose anything a real navigation wouldn't already have reset.
 *
 * The "blur the outgoing page" part of a navigation's loading feedback
 * lives in NavigationOverlay (see SiteChrome), not here — an earlier
 * version tried to do it here by holding the previous `children` in state
 * for a beat before swapping. Verified live (instrumented render/effect
 * logging) that doesn't work reliably: Next's Suspense-streamed
 * `children` and `usePathname()` don't always update in lockstep, so
 * "snapshot the old children" ended up snapshotting the *new* route's
 * loading.tsx fallback in some runs instead of the actual outgoing page.
 * A `backdrop-blur` overlay sitting on top of whatever's currently
 * painted sidesteps that entirely — it doesn't care what's underneath or
 * when it changes.
 */
export function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = useAppPathname();
  const hasFullBleedHero = FULL_BLEED_HERO_ROUTES.includes(pathname) || FULL_BLEED_HERO_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAdmin = pathname.startsWith("/admin");

  return (
    // relative: lets PageLoader (the Suspense fallback — see loading.tsx)
    // cover this box exactly via `absolute inset-0` instead of a
    // percentage height. flex-1 gives <main> a real *layout* size (via
    // flex-grow), but that's not the same as a CSS-definite `height` —
    // Chromium doesn't reliably resolve a percentage-height child (e.g.
    // min-h-full) against a flex-grown parent, so PageLoader was
    // rendering short with a gap of bare page background around it
    // rather than actually filling this box. absolute positioning reads
    // the parent's real layout box directly, sidestepping that.
    // z-[1]: <main> is a stacking context (its entrance animation) and comes
    // BEFORE the footer in the DOM, so without a z-index any footer element that
    // creates its own stacking context (an opacity or mask, like the Sri Lanka
    // ornament band) painted on top of the full-screen page loader inside it —
    // a line across the loader's logo mid-navigation. Raising <main> keeps the
    // loader above the footer; the Navbar (z-50) and the chat/overlay layers
    // (z-40) still sit above <main>.
    // min-h-dvh: while a page is still streaming in (loading.tsx's loader
    // is absolutely positioned, so it adds no height) <main> would otherwise
    // be nearly empty and the footer would sit in view — then jump away as
    // the content arrives (CLS up to 0.9 on product pages). With a screen's
    // height reserved, the footer starts below the fold.
    //
    // The site status banner's height is reserved by its own in-flow copy
    // ahead of <main> (see SiteStatusBanner) — on hero and non-hero pages
    // alike, since it's clearance for the banner, not the Navbar;
    // NAV_CLEARANCE is the separate, Navbar-only clearance.
    <main key={pathname} className={cn("animate-page-in relative z-[1] flex-1", !isAdmin && "min-h-dvh", !hasFullBleedHero && !isAdmin && NAV_CLEARANCE)}>
      {children}
    </main>
  );
}
