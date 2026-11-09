import { describe, expect, it } from "vitest";
import { DEVICE_CLOCK_THEME_SCRIPT, isDaylightAt, localHourIn, locationFromHeaders, parseTheme, resolveTheme, solarElevationDeg } from "./theme";

const COLOMBO = { latitude: 6.93, longitude: 79.85 };
const LONDON = { latitude: 51.51, longitude: -0.13 };
const at = (iso: string) => new Date(iso);
const nowhere = { latitude: null, longitude: null, timeZone: null };

describe("parseTheme", () => {
  it("returns the saved choice, or null when there isn't one", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    for (const value of [undefined, null, "", "LIGHT", "sepia", "dark; injected"]) {
      expect(parseTheme(value)).toBeNull();
    }
  });
});

describe("locationFromHeaders", () => {
  it("reads Vercel's location headers", () => {
    const h = new Headers({ "x-vercel-ip-latitude": "6.93", "x-vercel-ip-longitude": "79.85", "x-vercel-ip-timezone": "Asia/Colombo" });
    expect(locationFromHeaders(h)).toEqual({ latitude: 6.93, longitude: 79.85, timeZone: "Asia/Colombo" });
  });

  it("falls back to Cloudflare's visitor-location headers", () => {
    const h = new Headers({ "cf-iplatitude": "51.5", "cf-iplongitude": "-0.1", "cf-timezone": "Europe/London" });
    expect(locationFromHeaders(h)).toEqual({ latitude: 51.5, longitude: -0.1, timeZone: "Europe/London" });
  });

  it("drops missing, malformed and out-of-range values", () => {
    expect(locationFromHeaders(new Headers())).toEqual(nowhere);
    const h = new Headers({ "x-vercel-ip-latitude": "abc", "x-vercel-ip-longitude": "500", "x-vercel-ip-timezone": " " });
    expect(locationFromHeaders(h)).toEqual(nowhere);
  });
});

describe("solarElevationDeg", () => {
  it("puts the sun high over Colombo at local noon and below the horizon at local midnight", () => {
    // Colombo is UTC+5:30.
    expect(solarElevationDeg(COLOMBO.latitude, COLOMBO.longitude, at("2026-06-21T06:30:00Z"))).toBeGreaterThan(70);
    expect(solarElevationDeg(COLOMBO.latitude, COLOMBO.longitude, at("2026-06-21T18:30:00Z"))).toBeLessThan(-55); // lowest possible: 6.93 + 23.44 - 90 ≈ -59.6°
  });

  it("matches London's short winter day (sunset ~15:55 GMT on 21 Dec)", () => {
    expect(solarElevationDeg(LONDON.latitude, LONDON.longitude, at("2026-12-21T12:00:00Z"))).toBeGreaterThan(10);
    expect(solarElevationDeg(LONDON.latitude, LONDON.longitude, at("2026-12-21T16:30:00Z"))).toBeLessThan(-0.833);
  });
});

describe("localHourIn", () => {
  it("returns the hour in that time zone", () => {
    expect(localHourIn("Asia/Colombo", at("2026-11-09T06:30:00Z"))).toBe(12);
    expect(localHourIn("UTC", at("2026-11-09T23:15:00Z"))).toBe(23);
  });

  it("returns null for an unknown zone", () => {
    expect(localHourIn("Mars/Olympus_Mons", new Date())).toBeNull();
  });
});

describe("isDaylightAt", () => {
  it("uses the sun's position when coordinates are known", () => {
    expect(isDaylightAt({ ...COLOMBO, timeZone: null }, at("2026-06-21T06:30:00Z"))).toBe(true);
    expect(isDaylightAt({ ...COLOMBO, timeZone: null }, at("2026-06-21T18:30:00Z"))).toBe(false);
    // 17:00 in London in December is already dark — a fixed 6–18 clock would get this wrong.
    expect(isDaylightAt({ ...LONDON, timeZone: "Europe/London" }, at("2026-12-21T17:00:00Z"))).toBe(false);
  });

  it("falls back to the local clock when only a time zone is known", () => {
    const tz = { latitude: null, longitude: null, timeZone: "Asia/Colombo" };
    expect(isDaylightAt(tz, at("2026-11-09T06:30:00Z"))).toBe(true); // 12:00 local
    expect(isDaylightAt(tz, at("2026-11-09T20:30:00Z"))).toBe(false); // 02:00 local
  });

  it("is unknown with no location at all", () => {
    expect(isDaylightAt(nowhere, new Date())).toBeNull();
  });
});

describe("resolveTheme", () => {
  const colomboNoon = { location: { ...COLOMBO, timeZone: "Asia/Colombo" }, at: at("2026-06-21T06:30:00Z") };
  const colomboMidnight = { location: { ...COLOMBO, timeZone: "Asia/Colombo" }, at: at("2026-06-21T18:30:00Z") };

  it("follows daylight at the visitor's location until they choose", () => {
    expect(resolveTheme({ path: "/", saved: null, ...colomboNoon })).toEqual({ theme: "light", source: "daylight" });
    expect(resolveTheme({ path: "/", saved: null, ...colomboMidnight })).toEqual({ theme: "dark", source: "daylight" });
  });

  it("always honours the visitor's own choice", () => {
    expect(resolveTheme({ path: "/gems", saved: "dark", ...colomboNoon })).toEqual({ theme: "dark", source: "saved" });
    expect(resolveTheme({ path: "/gems", saved: "light", ...colomboMidnight })).toEqual({ theme: "light", source: "saved" });
  });

  it("keeps the admin back office light whatever the time or choice", () => {
    expect(resolveTheme({ path: "/admin", saved: "dark", ...colomboMidnight })).toEqual({ theme: "light", source: "admin" });
    expect(resolveTheme({ path: "/admin/gems/new", saved: null, ...colomboMidnight })).toEqual({ theme: "light", source: "admin" });
    // A storefront path that merely starts with the letters "admin" isn't the back office.
    expect(resolveTheme({ path: "/administration-guide", saved: null, ...colomboMidnight }).source).toBe("daylight");
  });

  it("defers to the device clock (source 'unknown') with no location", () => {
    expect(resolveTheme({ path: "/", saved: null, location: nowhere, at: new Date() })).toEqual({ theme: "dark", source: "unknown" });
  });
});

describe("DEVICE_CLOCK_THEME_SCRIPT", () => {
  function runAt(hour: number): string | undefined {
    const root = { dataset: {} as Record<string, string> };
    const RealDate = Date;
    class FakeDate extends RealDate {
      getHours() {
        return hour;
      }
    }
    new Function("document", "Date", DEVICE_CLOCK_THEME_SCRIPT)({ documentElement: root }, FakeDate);
    return root.dataset.theme;
  }

  it("picks light by day and dark by night from the device clock", () => {
    expect(runAt(9)).toBe("light");
    expect(runAt(17)).toBe("light");
    expect(runAt(18)).toBe("dark");
    expect(runAt(2)).toBe("dark");
  });
});
