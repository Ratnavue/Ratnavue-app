// Storefront colour theme (see the colour-system notes at the top of
// globals.css). Pure — safe to import from client components.
//
// Two sources, in order:
//  1. The visitor's own choice from ThemeToggle, kept in a cookie so
//     RootLayout can render <html data-theme="…"> correctly in the very first
//     paint (a localStorage-only theme always flashes before JS runs).
//  2. Until they've chosen: daylight where they are. The hosting platform
//     tags each request with the visitor's IP location, so the server works
//     out whether the sun is up there right now — light by day, dark by night.
//     When the platform gives no location (local dev, an unknown IP),
//     RootLayout lets the browser decide from its own clock before first paint.

export type Theme = "dark" | "light";

export const THEME_COOKIE = "ratnavue-theme";
export const DEFAULT_THEME: Theme = "dark";
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** The saved choice, or null when the visitor hasn't picked one. */
export function parseTheme(value: string | undefined | null): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

const isAdminPath = (path: string) => path === "/admin" || path.startsWith("/admin/");

export interface VisitorLocation {
  latitude: number | null;
  longitude: number | null;
  timeZone: string | null;
}

/** IP location from the hosting platform's headers (Vercel, then Cloudflare's visitor-location headers). */
export function locationFromHeaders(headers: Headers): VisitorLocation {
  const num = (value: string | null) => {
    if (value === null || value.trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const latitude = num(headers.get("x-vercel-ip-latitude") ?? headers.get("cf-iplatitude"));
  const longitude = num(headers.get("x-vercel-ip-longitude") ?? headers.get("cf-iplongitude"));
  const timeZone = headers.get("x-vercel-ip-timezone") ?? headers.get("cf-timezone");
  return {
    latitude: latitude !== null && Math.abs(latitude) <= 90 ? latitude : null,
    longitude: longitude !== null && Math.abs(longitude) <= 180 ? longitude : null,
    timeZone: timeZone?.trim() || null,
  };
}

/**
 * The sun's elevation above the horizon, in degrees, at a place and moment
 * (a standard low-precision solar-position formula, good to well under a
 * degree — plenty for "is it day").
 */
export function solarElevationDeg(latitude: number, longitude: number, at: Date): number {
  const rad = Math.PI / 180;
  const days = at.getTime() / 86_400_000 - 10_957.5; // days since J2000.0 (2000-01-01 12:00 UTC)
  const meanAnomaly = (357.529 + 0.98560028 * days) * rad;
  const meanLongitude = 280.459 + 0.98564736 * days;
  const eclipticLongitude = (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * rad;
  const obliquity = (23.439 - 0.00000036 * days) * rad;
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude));
  const siderealDeg = ((18.697374558 + 24.06570982441908 * days) % 24) * 15;
  const hourAngle = (siderealDeg + longitude) * rad - rightAscension;
  const lat = latitude * rad;
  return Math.asin(Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle)) / rad;
}

/** The local hour (0–23) in an IANA time zone, or null for an unknown zone. */
export function localHourIn(timeZone: string, at: Date): number | null {
  try {
    const hour = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hourCycle: "h23" }).format(at);
    const n = Number(hour);
    return Number.isInteger(n) ? n : null;
  } catch {
    return null;
  }
}

// Daytime by the clock when only a time zone is known: 06:00–17:59.
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 18;
// Sunrise/sunset are defined as the sun's centre at -0.833° (refraction plus
// the sun's own radius), so a sky that's still lit counts as day.
const SUNRISE_ELEVATION_DEG = -0.833;

/** Whether it's daytime where the visitor is — null when their location is unknown. */
export function isDaylightAt(location: VisitorLocation, at: Date): boolean | null {
  if (location.latitude !== null && location.longitude !== null) {
    return solarElevationDeg(location.latitude, location.longitude, at) > SUNRISE_ELEVATION_DEG;
  }
  if (location.timeZone) {
    const hour = localHourIn(location.timeZone, at);
    if (hour !== null) return hour >= DAY_START_HOUR && hour < DAY_END_HOUR;
  }
  return null;
}

export type ThemeSource = "saved" | "daylight" | "admin" | "unknown";

/**
 * The theme to render: the admin back office always light (a dense tool built
 * and checked against light surfaces only); else the visitor's saved choice;
 * else light by day / dark by night at their location; else the dark default
 * with source "unknown", which tells RootLayout to let the browser's own clock
 * decide before first paint.
 */
export function resolveTheme({
  path,
  saved,
  location,
  at,
}: {
  path: string;
  saved: Theme | null;
  location: VisitorLocation;
  at: Date;
}): { theme: Theme; source: ThemeSource } {
  if (isAdminPath(path)) return { theme: "light", source: "admin" };
  if (saved) return { theme: saved, source: "saved" };
  const daylight = isDaylightAt(location, at);
  if (daylight !== null) return { theme: daylight ? "light" : "dark", source: "daylight" };
  return { theme: DEFAULT_THEME, source: "unknown" };
}

/**
 * Inline <head> script for the "unknown" case: picks the theme from the
 * device's own clock before first paint (the device is almost always in the
 * same place as the visitor). Same 06:00–17:59 daytime window as above.
 */
export const DEVICE_CLOCK_THEME_SCRIPT = `(function(){try{var h=new Date().getHours();document.documentElement.dataset.theme=h>=${DAY_START_HOUR}&&h<${DAY_END_HOUR}?"light":"dark";}catch(e){}})();`;
