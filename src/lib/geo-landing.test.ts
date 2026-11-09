import { describe, expect, it } from "vitest";
import { countryFromHeaders, decideGeoLanding } from "./geo-landing";

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

describe("decideGeoLanding", () => {
  const base = { hasStorePref: false };

  it("sends a Sri Lankan visitor on an international landing page to /lk", () => {
    expect(decideGeoLanding({ ...base, rawPathname: "/", country: "LK" })).toEqual({ action: "redirect", market: "lk", pathname: "/lk" });
    expect(decideGeoLanding({ ...base, rawPathname: "/gems", country: "LK" })).toEqual({ action: "redirect", market: "lk", pathname: "/lk/gems" });
  });

  it("sends everyone else on a /lk landing page to the international store", () => {
    expect(decideGeoLanding({ ...base, rawPathname: "/lk", country: "GB" })).toEqual({ action: "redirect", market: "intl", pathname: "/" });
    expect(decideGeoLanding({ ...base, rawPathname: "/lk/sourcing", country: "US" })).toEqual({ action: "redirect", market: "intl", pathname: "/sourcing" });
  });

  it("only remembers when the visitor is already on the right store", () => {
    expect(decideGeoLanding({ ...base, rawPathname: "/lk/about", country: "LK" })).toEqual({ action: "remember", market: "lk" });
    expect(decideGeoLanding({ ...base, rawPathname: "/", country: "DE" })).toEqual({ action: "remember", market: "intl" });
  });

  it("never overrides a stored choice", () => {
    expect(decideGeoLanding({ rawPathname: "/", country: "LK", hasStorePref: true })).toEqual({ action: "none" });
  });

  it("does nothing without a location", () => {
    expect(decideGeoLanding({ ...base, rawPathname: "/", country: null })).toEqual({ action: "none" });
  });

  it("leaves product, checkout and account deep links where they point", () => {
    for (const path of ["/gems/blue-sapphire-2ct", "/lk/jewelry/ring-1", "/checkout", "/account/orders", "/auction/abc"]) {
      expect(decideGeoLanding({ ...base, rawPathname: path, country: "LK" })).toEqual({ action: "none" });
    }
  });
});
