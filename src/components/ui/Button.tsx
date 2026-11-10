"use client";

import Link from "@/components/ui/MarketLink";
import { type ButtonHTMLAttributes, type AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useMarket } from "@/components/providers/MarketProvider";
import { withMarket } from "@/lib/market-shared";

const VARIANTS = {
  // The main action colour, per theme (--color-action in globals.css):
  // navy with cream text by day, gold with night text at night. "gold" is
  // the older name for the same button and is kept as an alias.
  primary: "bg-action font-semibold text-action-ink hover:bg-action-hover",
  gold: "bg-action font-semibold text-action-ink hover:bg-action-hover",
  // Literally gold in both themes — for pages with their own art direction
  // (the subculture collections) rather than the site theme.
  accent: "bg-gold font-semibold text-night hover:bg-gold-soft",
  outline: "border border-charcoal/30 text-charcoal hover:border-charcoal bg-transparent",
  "outline-light": "border border-cream/40 text-cream hover:border-cream hover:bg-cream/10 bg-transparent",
  ghost: "text-charcoal hover:bg-charcoal/5",
  // red-600 (not -700/-800): those shades are re-pointed to light text
  // colours in the dark theme (see globals.css status tints).
  destructive: "bg-red-600 text-white hover:brightness-110",
};

// min-h keeps every size at a comfortable thumb target (~44px for md/lg,
// 40px for the compact sm) even where the text is short.
const SIZES = {
  sm: "min-h-10 text-sm px-4 py-2",
  md: "min-h-11 text-sm px-6 py-3",
  lg: "min-h-12 text-base px-8 py-4",
};

type Variant = keyof typeof VARIANTS;
type Size = keyof typeof SIZES;

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-sans tracking-wide transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={cn(base, VARIANTS[variant], SIZES[size], className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; size?: Size; href: string }) {
  return <Link href={href} className={cn(base, VARIANTS[variant], SIZES[size], className)} {...props} />;
}

// Same look as LinkButton, but a plain <a> instead of next/link — a real
// full-page navigation rather than Next's client-side soft nav. For most
// links the soft nav is strictly better (no flash, no re-fetching shared
// layout), but a "reset" action needs the opposite guarantee: a plain
// anchor can't return a stale prefetched/cached response the way a Link
// visited before the underlying data changed could, and the browser's own
// navigation gives it an unambiguous loading state — exactly what "reset
// and reload" should mean.
export function HardLinkButton({
  variant = "primary",
  size = "md",
  className,
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; size?: Size; href: string }) {
  const market = useMarket();
  return <a href={withMarket(href, market)} className={cn(base, VARIANTS[variant], SIZES[size], className)} {...props} />;
}
