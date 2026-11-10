"use client";

import { LazyMotion } from "motion/react";

const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

/**
 * Lets the always-loaded animated components (Navbar, Reveal,
 * HeroSlideshow) use motion's lightweight `m` components, so every page
 * ships motion's small core instead of the whole library (~45KB gzipped
 * off the shared bundle); the animation features stream in as their own
 * chunk once the page is up. Until they arrive, `m` elements just sit in
 * their initial state — for Reveal that's a light dip (opacity 0.6, see
 * REVEAL_HIDDEN_OPACITY), never invisible — and animate once loaded.
 *
 * Not `strict`: a few page-specific components (DigForGemAnimation,
 * AuctionCountdown) still use the full `motion` components, which only
 * load on their own pages.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>;
}
