// Keeps search engines on the real domain. Vercel also serves the production
// site at its own *.vercel.app address, and Google indexed that copy as a
// duplicate — listed under the site name "Vercel", since vercel.app is
// Vercel's domain. proxy.ts permanently redirects page requests on that
// address to the canonical domain (AUTH_URL), so the duplicate drops out and
// its links consolidate onto the real site. Preview deployments are left
// reachable (they're for testing) but marked noindex in next.config.ts.
//
// Pure and edge-safe. Deliberately narrow, so a misconfigured AUTH_URL can
// never send the live site somewhere wrong: it only ever acts on Vercel
// production, only for a *.vercel.app host, and only towards a real custom
// domain (never localhost, never another vercel.app address).

const VERCEL_HOST = /\.vercel\.app$/i;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/** The canonical origin to redirect this request to, or null to serve it as-is. */
export function canonicalRedirectOrigin({
  host,
  canonicalUrl,
  vercelEnv,
}: {
  /** The request's own Host header (not req.nextUrl, which Auth.js rewrites to AUTH_URL). */
  host: string | null;
  canonicalUrl: string | undefined;
  vercelEnv: string | undefined;
}): string | null {
  if (vercelEnv !== "production" || !host || !VERCEL_HOST.test(host.split(":")[0])) return null;
  let canonical: URL;
  try {
    canonical = new URL(canonicalUrl ?? "");
  } catch {
    return null;
  }
  if (canonical.protocol !== "https:" || VERCEL_HOST.test(canonical.hostname) || LOCAL_HOST.test(canonical.host)) return null;
  if (canonical.host.toLowerCase() === host.toLowerCase()) return null;
  return canonical.origin;
}
