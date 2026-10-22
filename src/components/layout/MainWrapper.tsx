"use client";

import { useAppPathname } from "@/components/providers/MarketProvider";
import { cn } from "@/lib/utils";

// Routes whose own first section is a full-bleed hero starting at the very
// top of the page (same idea as the homepage hero) — these must NOT get the
// pt-24 nav-clearance padding below, or a strip of bare background shows up
// between the fixed Navbar and the top of their hero image.
const FULL_BLEED_HERO_ROUTES = ["/", "/about", "/sourcing", "/promotions", "/promotions/collection"];
// /collections/[slug] (the hidden subculture landing pages) is dynamic, so
// it can't be listed above — every page under it opens with the same
// full-bleed min-h-dvh hero (see AlternativeCollectionPage).
const FULL_BLEED_HERO_PREFIXES = ["/collections/"];

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
    // marginTop tracks --site-banner-h (see SiteStatusBanner) — 0 when no
    // banner is showing, so this is a no-op the rest of the time. Applied
    // uniformly (hero and non-hero pages alike) since it's clearance for
    // the banner, not the Navbar — pt-24 below is the separate, Navbar-only
    // clearance, and a full-bleed hero page still wants none of that.
    <main key={pathname} style={{ marginTop: "var(--site-banner-h, 0px)" }} className={cn("animate-page-in relative z-[1] flex-1", !hasFullBleedHero && !isAdmin && "pt-24")}>
      {children}
    </main>
  );
}
