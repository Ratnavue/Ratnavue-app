import { describe, expect, it } from "vitest";
import { countryFromHeaders, decideGeoLanding, isDirectEntry, parseStoreChoice } from "./geo-landing";

describe("countryFromHeaders", () => {
  it("reads Vercel's header first, then Cloudflare's", () => {
    expect(countryFromHeaders(new Headers({ "x-vercel-ip-country": "lk" }))).toBe("LK");
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "GB" }))).toBe("GB");
    expect(countryFromHeaders(new Headers({ "x-vercel-ip-country": "US", "cf-ipcountry": "LK" }))).toBe("US");
  });

  it("treats missing and unknown markers as no location", () => {
    expect(countryFromHeaders(new Headers())).toBeNull();
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "XX" }))).toBeNull();
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "T1" }))).toBeNull();
  });
});

describe("parseStoreChoice", () => {
  it("accepts only the two stores", () => {
    expect(parseStoreChoice("lk")).toBe("lk");
    expect(parseStoreChoice("intl")).toBe("intl");
    expect(parseStoreChoice(undefined)).toBeNull();
    expect(parseStoreChoice("LK")).toBeNull();
  });
});

describe("isDirectEntry", () => {
  const origin = "https://ratnavue.com";

  it("is direct for a typed/pasted URL or bookmark, and for links from other sites", () => {
    expect(isDirectEntry(new Headers({ "sec-fetch-site": "none" }), origin)).toBe(true);
    expect(isDirectEntry(new Headers({ "sec-fetch-site": "cross-site" }), origin)).toBe(true);
    expect(isDirectEntry(new Headers({ "sec-fetch-site": "same-site" }), origin)).toBe(true);
  });

  it("is not direct when navigating inside the site", () => {
    expect(isDirectEntry(new Headers({ "sec-fetch-site": "same-origin" }), origin)).toBe(false);
  });

  it("falls back to the Referer for browsers without Sec-Fetch-Site", () => {
    expect(isDirectEntry(new Headers(), origin)).toBe(true);
    expect(isDirectEntry(new Headers({ referer: "https://www.google.com/" }), origin)).toBe(true);
    expect(isDirectEntry(new Headers({ referer: "https://ratnavue.com/gems" }), origin)).toBe(false);
    expect(isDirectEntry(new Headers({ referer: "not a url" }), origin)).toBe(true);
  });
});

describe("decideGeoLanding", () => {
  const direct = { storeChoice: null, directEntry: true };

  it("sends a Sri Lankan visitor entering the international store to /lk", () => {
    expect(decideGeoLanding({ ...direct, rawPathname: "/", country: "LK" })).toEqual({ action: "redirect", market: "lk", pathname: "/lk" });
    expect(decideGeoLanding({ ...direct, rawPathname: "/gems", country: "LK" })).toEqual({ action: "redirect", market: "lk", pathname: "/lk/gems" });
  });

  it("sends everyone else entering /lk to the international store", () => {
    expect(decideGeoLanding({ ...direct, rawPathname: "/lk", country: "GB" })).toEqual({ action: "redirect", market: "intl", pathname: "/" });
    expect(decideGeoLanding({ ...direct, rawPathname: "/lk/sourcing", country: "US" })).toEqual({ action: "redirect", market: "intl", pathname: "/sourcing" });
  });

  it("does nothing when the visitor is already on their store", () => {
    expect(decideGeoLanding({ ...direct, rawPathname: "/lk/about", country: "LK" })).toEqual({ action: "none" });
    expect(decideGeoLanding({ ...direct, rawPathname: "/", country: "DE" })).toEqual({ action: "none" });
  });

  it("routes by location on EVERY direct entry, not just the first visit", () => {
    // No state is kept between visits for geo — each direct entry is decided afresh.
    for (let visit = 0; visit < 3; visit++) {
      expect(decideGeoLanding({ ...direct, rawPathname: "/", country: "LK" })).toEqual({ action: "redirect", market: "lk", pathname: "/lk" });
    }
  });

  it("never redirects a click inside the site", () => {
    expect(decideGeoLanding({ rawPathname: "/", country: "LK", storeChoice: null, directEntry: false })).toEqual({ action: "none" });
  });

  it("honours the visitor's own store choice over their location", () => {
    // A Sri Lankan visitor who chose International stays there…
    expect(decideGeoLanding({ rawPathname: "/", country: "LK", storeChoice: "intl", directEntry: true })).toEqual({ action: "none" });
    // …and is brought back to it if they enter via a /lk link.
    expect(decideGeoLanding({ rawPathname: "/lk/gems", country: "LK", storeChoice: "intl", directEntry: true })).toEqual({
      action: "redirect",
      market: "intl",
      pathname: "/gems",
    });
    // The choice applies even when there's no location at all.
    expect(decideGeoLanding({ rawPathname: "/", country: null, storeChoice: "lk", directEntry: true })).toEqual({ action: "redirect", market: "lk", pathname: "/lk" });
  });

  it("does nothing without a location or a choice", () => {
    expect(decideGeoLanding({ ...direct, rawPathname: "/", country: null })).toEqual({ action: "none" });
  });

  it("leaves product, checkout and account deep links where they point", () => {
    for (const path of ["/gems/blue-sapphire-2ct", "/lk/jewelry/ring-1", "/checkout", "/account/orders", "/auction/abc"]) {
      expect(decideGeoLanding({ ...direct, rawPathname: path, country: "LK" })).toEqual({ action: "none" });
    }
  });
});
