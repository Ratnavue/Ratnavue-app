"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE_SECONDS, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Dark/light switch for the storefront. Flips <html data-theme> in place (every
 * colour is a CSS variable keyed on it, so nothing re-renders) and saves the
 * choice in a cookie RootLayout reads, so the next page load is painted in the
 * right theme from the first byte.
 */
export function ThemeToggle({ className, transparent = false }: { className?: string; /** Over a dark full-bleed hero (the Navbar's transparent state): light ink, like the header's other controls. */ transparent?: boolean }) {
  const t = useTranslations("theme");
  // null until mounted: the server can't know which icon to show without
  // reading the cookie itself, and the attribute RootLayout set is the truth.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Reading the DOM once on mount is the only way to sync with the
    // server-rendered attribute; there's no external store to subscribe to.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    setTheme(next);
  }

  const label = theme === "light" ? t("toDark") : t("toLight");
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors",
        transparent
          ? "border-cream/30 text-cream/85 hover:border-cream hover:text-cream"
          : "border-border-subtle text-charcoal/85 hover:border-gold/60 hover:text-gold-deep",
        className,
      )}
    >
      {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
