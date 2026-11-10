"use client";

import * as m from "motion/react-m";
import type { Variants } from "motion/react";
import type { ReactNode } from "react";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

// Exported so `Reveal.test.ts` can assert on these directly without
// rendering React/Framer Motion (this project's Vitest config is
// deliberately node-only, no jsdom — see vitest.config.ts) — a plain value
// regression is enough to catch someone reverting either of these back to
// the pre-fix behaviour (opacity 0 / negative margin) that made whole
// sections of the home page render blank until scrolled slowly.
export const REVEAL_HIDDEN_OPACITY = 0.6;
// Positive bottom margin: pre-triggers the reveal ~200px before a section
// is actually on screen. See the Reveal doc comment below for the full
// rationale.
export const REVEAL_VIEWPORT_MARGIN = "0px 0px 200px 0px";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** Vertical offset (px) the content travels in from. */
  y?: number;
  /** Reveal as a group — pass to children via variants when `stagger` is used on a parent. */
  as?: "div" | "section";
}

// The "hidden" state is a subtle dip, not a full disappearance
// (opacity 0.6, not 0) — deliberately: this is a scroll-triggered
// IntersectionObserver animation, and anything that can gate a section's
// content on a JS event firing at the right time can fail to fire in time
// (slow hydration, a fast/flicked scroll, a resize, one frame of layout
// thrash while images load in above it). When that happens with a full
// opacity:0 start, the result is a section that's fully blank until
// something nudges the observer — which reads as broken/overlapping
// layout, not a missed animation. At 0.6 the same worst case just looks
// like content still gently settling in, never like something is missing.
const variants: Variants = {
  hidden: { opacity: REVEAL_HIDDEN_OPACITY, y: 28 },
  visible: { opacity: 1, y: 0 },
};

/** Fades + slides content up as it scrolls into view. Plays once.
 *
 * `margin: "0px 0px 200px 0px"` is a *positive* bottom margin — it expands
 * the effective viewport 200px past the real bottom edge for the purposes
 * of triggering, so the reveal starts while a section is still below the
 * fold and has finished (800ms) well before the user actually scrolls it
 * into view. The previous `-80px` did the opposite: a negative margin
 * *shrinks* the effective viewport, so a section had to already be
 * visually on screen before the animation even started, leaving it
 * dimmed for a beat on every normal-speed scroll — on a page with several
 * of these sections back to back (see the home page), that reads as
 * janky performance and, mid-transition, can look like broken/overlapping
 * layout rather than a deliberate animation. */
export function Reveal({ children, delay = 0, className, y = 28, as = "div" }: RevealProps) {
  const Component = m[as];
  return (
    <Component
      className={className}
      initial={{ opacity: y === 28 ? REVEAL_HIDDEN_OPACITY : 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: REVEAL_VIEWPORT_MARGIN }}
      transition={{ duration: 0.8, delay, ease: EASE_OUT }}
      variants={y === 28 ? variants : undefined}
    >
      {children}
    </Component>
  );
}

/** Wrap a grid/list with this and give each child a Reveal (or RevealItem) to stagger their entrance. */
export function RevealGroup({ children, className, stagger = 0.08 }: { children: ReactNode; className?: string; stagger?: number }) {
  return (
    <m.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: REVEAL_VIEWPORT_MARGIN }}
      transition={{ staggerChildren: stagger }}
    >
      {children}
    </m.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <m.div className={className} variants={variants} transition={{ duration: 0.7, ease: EASE_OUT }}>
      {children}
    </m.div>
  );
}
