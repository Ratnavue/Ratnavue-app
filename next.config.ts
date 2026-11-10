import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// No remotePatterns needed: every uploaded image is served from our own
// origin at /media/[filename] (see app/media/[filename]/route.ts), not a
// direct Supabase Storage URL, so next/image treats it as a same-origin
// local image with no extra config.
const nextConfig: NextConfig = {
  // Server Actions default to a 1MB body limit, which the remaining
  // upload-through-an-action spots (hero slides, certificate scans, lab
  // logos, customer reference photos) blow past with a normal phone photo.
  // 4MB matches Vercel's own ~4.5MB serverless request cap — raising it
  // further wouldn't help there. Product photos/videos don't go through
  // an action at all (see lib/media.ts's direct-upload comment).
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // Anything served on a *.vercel.app address (preview deployments, and the
  // production one's alias before proxy.ts redirects it) is never indexed —
  // only the real domain should appear in search. See lib/canonical-host.ts.
  async headers() {
    return [{ source: "/:path*", has: [{ type: "host", value: ".*\\.vercel\\.app" }], headers: [{ key: "X-Robots-Tag", value: "noindex" }] }];
  },
};

// Resolves src/i18n/request.ts (see its own comment) for both the server
// and client bundles — needed even though this app has no [locale] URL
// routing, since next-intl still needs to know where its request config
// lives.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
