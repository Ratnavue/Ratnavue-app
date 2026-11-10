import { describe, expect, it } from "vitest";
import { canonicalRedirectOrigin } from "./canonical-host";

const prod = { canonicalUrl: "https://www.ratnavue.com", vercelEnv: "production" };

describe("canonicalRedirectOrigin", () => {
  it("sends the production vercel.app address to the real domain", () => {
    expect(canonicalRedirectOrigin({ ...prod, host: "ttgj.vercel.app" })).toBe("https://www.ratnavue.com");
    expect(canonicalRedirectOrigin({ ...prod, host: "TTGJ.Vercel.App" })).toBe("https://www.ratnavue.com");
  });

  it("leaves the real domain alone", () => {
    expect(canonicalRedirectOrigin({ ...prod, host: "www.ratnavue.com" })).toBeNull();
  });

  it("leaves preview deployments and local runs alone", () => {
    expect(canonicalRedirectOrigin({ ...prod, vercelEnv: "preview", host: "ttgj-git-feature.vercel.app" })).toBeNull();
    expect(canonicalRedirectOrigin({ ...prod, vercelEnv: undefined, host: "ttgj.vercel.app" })).toBeNull();
  });

  it("never redirects towards a bad canonical URL", () => {
    for (const canonicalUrl of [undefined, "", "not a url", "http://localhost:3000", "https://localhost", "https://ttgj.vercel.app", "http://www.ratnavue.com"]) {
      expect(canonicalRedirectOrigin({ canonicalUrl, vercelEnv: "production", host: "ttgj.vercel.app" })).toBeNull();
    }
  });

  it("ignores a missing Host header", () => {
    expect(canonicalRedirectOrigin({ ...prod, host: null })).toBeNull();
  });
});
