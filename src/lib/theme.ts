// Storefront colour theme (see the colour-system notes at the top of
// globals.css). Pure — safe to import from client components.
//
// Stored in a cookie, not localStorage, so RootLayout can read it on the
// server and render <html data-theme="…"> correctly in the very first paint;
// a localStorage-only theme always flashes the default before JS runs.

export type Theme = "dark" | "light";

export const THEME_COOKIE = "ratnavue-theme";
export const DEFAULT_THEME: Theme = "dark";
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function parseTheme(value: string | undefined | null): Theme {
  return value === "light" || value === "dark" ? value : DEFAULT_THEME;
}

/**
 * The theme to render for a path. The admin back office keeps the light
 * theme regardless of the visitor's storefront choice: it's a dense,
 * data-heavy tool built and checked against light surfaces only.
 */
export function themeForPath(path: string, saved: Theme): Theme {
  return path === "/admin" || path.startsWith("/admin/") ? "light" : saved;
}
