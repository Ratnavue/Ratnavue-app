import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";
import { staffAreaForPath } from "@/lib/staff-permissions";
import { APP_PATH_HEADER, LK_PREFIX, MARKET_HEADER, isLkPath, stripMarket } from "@/lib/market-shared";
import { SALES_REF_COOKIE, SALES_REF_COOKIE_MAX_AGE_SECONDS } from "@/lib/sales-referrals-shared";

// Deliberately NOT `import { auth } from "@/lib/auth"` — that config pulls in
// PrismaAdapter, Prisma Client, and the Credentials/Google providers
// (bcryptjs included), which are heavy and unnecessary here: the proxy only
// ever needs to read/verify the existing session JWT, which needs no
// providers at all, so it gets its own `auth()` built from just the slice of
// the config that doesn't touch the database.
const { auth } = NextAuth(authConfig);

// Known legitimate non-browser clients that must still get through —
// search engine crawlers (so the sitemap-driven discoverability these
// pages are built for actually works) and the link-preview bots chat
// apps use to render an OG card when someone shares a /collections URL.
const ALLOWED_BOT_UA = /googlebot|bingbot|duckduckbot|slurp|baiduspider|yandexbot|applebot|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot/i;

// A handful of common non-browser HTTP client signatures. This is a
// speed bump against casual scraping, not real security — curl (or
// anything else) can trivially set `-A "Mozilla/5.0 ..."` and sail
// through, since a User-Agent is just a header the client chooses to
// send. It's scoped to /collections only: these are the hidden pages
// meant to be found by a person following a link, not queried directly.
const NON_BROWSER_UA = /^curl\/|^wget\/|python-requests|python-urllib|okhttp|go-http-client|java\/|apache-httpclient|libwww-perl|postmanruntime|insomnia|httpie|^axios\/|node-fetch/i;

function isBrowserRequest(userAgent: string): boolean {
  if (!userAgent) return false;
  if (ALLOWED_BOT_UA.test(userAgent)) return true;
  if (NON_BROWSER_UA.test(userAgent)) return false;
  // Every real desktop/mobile browser (Chrome, Firefox, Safari, Edge)
  // includes "Mozilla/5.0" for historical compatibility reasons — a
  // request without it almost certainly isn't one.
  return /mozilla/i.test(userAgent);
}

// Vercel runs this proxy a SECOND time on the rewritten request: after
// "/lk/gems" is rewritten to "/gems", the proxy is invoked again with
// pathname "/gems" (the request carries x-vercel-is-internal-rewrite). A proxy
// that always re-derives the market from the path would then see no /lk
// prefix and overwrite the "lk" stamped by the first pass — the page would
// render the international store under a /lk URL. Local `next dev`/`start`
// only runs it once, which is why this never showed up there.
//
// So the stamp carries a signature over (market, path) that only this
// server can produce (HMAC with AUTH_SECRET). On the second pass a request
// that arrives with a valid signature is trusted and keeps its market; one
// with a missing or wrong signature — anything a visitor could send
// themselves — is still overwritten from its own path.
const MARKET_SIG_HEADER = "x-market-sig";

async function signMarket(market: string, path: string): Promise<string> {
  const secret = process.env.AUTH_SECRET ?? "market-stamp-dev-secret";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${market}|${path}`));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default auth(async (req) => {
  const rawPath = req.nextUrl.pathname;
  // Second pass of a /lk rewrite (see above): no prefix left in the path, but
  // the first pass's signed stamp says it's the Sri Lanka store.
  const incomingSignature = req.headers.get(MARKET_SIG_HEADER);
  const alreadyStampedLk =
    !isLkPath(rawPath) &&
    req.headers.get(MARKET_HEADER) === "lk" &&
    !!incomingSignature &&
    incomingSignature === (await signMarket("lk", rawPath));
  const isLk = isLkPath(rawPath) || alreadyStampedLk;
  // Every check below runs against the path WITHOUT the market prefix, so
  // "/lk/admin" is protected exactly like "/admin" and can't be used to
  // sidestep a rule written against the international paths.
  const pathname = stripMarket(rawPath);
  const prefix = isLk ? LK_PREFIX : "";
  const role = req.auth?.user?.role;

  // Admin is one shared back office, not part of either storefront.
  if (isLk && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    return NextResponse.redirect(new URL(pathname + req.nextUrl.search, req.nextUrl.origin));
  }

  if (pathname.startsWith("/collections")) {
    const userAgent = req.headers.get("user-agent") ?? "";
    if (!isBrowserRequest(userAgent)) {
      // Reads as though the route doesn't exist, same as a page that's
      // actually Hidden — no hint that a stricter check exists at all.
      return new NextResponse("Not Found", { status: 404 });
    }
  }

  // Includes the query string (e.g. ?highlight=ORD-...), not just the
  // bare pathname — otherwise a redirect like /account/orders?highlight=
  // loses that param on the round trip through login and a customer
  // sent back here after re-authenticating lands on the plain list
  // instead of their highlighted order (the hash portion, if any, is
  // never sent to the server at all — that part of the round trip is an
  // inherent browser limitation, not something this can fix).
  // Keeps the visitor in their storefront: /lk/account -> /lk/account/login
  // with a /lk-prefixed callback.
  function loginRedirect() {
    const loginUrl = new URL(`${prefix}/account/login`, req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", prefix + pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin")) {
    if (!req.auth) return loginRedirect();
    // STAFF is a strict allow-list, not "admin minus a few things" — only
    // pages that belong to one of the per-account areas in
    // lib/staff-permissions.ts are ever reachable, and every other admin
    // page stays ADMIN-only, the exact same protection it has always had.
    // This edge check only sees the permissions copied into the token at
    // sign-in (which can be stale), so it just gates "could this ever be a
    // staff page"; the precise per-account check happens in
    // admin/layout.tsx and again in every action, against fresh data.
    const staffAllowed = role === "STAFF" && (pathname === "/admin" || staffAreaForPath(pathname) !== null);
    if (role !== "ADMIN" && !staffAllowed) {
      return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
    }
  }

  const PUBLIC_ACCOUNT_PATHS = ["/account/login", "/account/register", "/account/forgot-password", "/account/reset-password"];
  if (pathname.startsWith("/account") && !PUBLIC_ACCOUNT_PATHS.some((p) => pathname.startsWith(p))) {
    if (!req.auth) return loginRedirect();
  }

  // Only the checkout form itself (building an order from *your* cart)
  // needs a session. /checkout/return and /checkout/cancel are PayHere's
  // own redirect targets — the browser lands there straight from
  // PayHere's hosted page, which may not carry this app's session
  // cookie (a different tab/context, a mobile card-issuer 3DS redirect,
  // etc.) — so they're deliberately public. That's safe specifically
  // because neither page ever renders order details: they look up the
  // order by its high-entropy internal id (not the guessable sequential
  // order number) and show only a status, handing off to the
  // authenticated /account/orders for anything sensitive. See
  // getPublicOrderStatus in actions/checkout.ts.
  // /checkout/wire (where a bank-transfer customer is told where to send
  // the money) and /checkout/cod (deposit/delivery details for a cash-on-
  // delivery order) show the amount and bank details, so unlike the
  // PayHere return pages they require the order's own session.
  if (pathname === "/checkout" || pathname === "/checkout/wire" || pathname === "/checkout/cod") {
    if (!req.auth) return loginRedirect();
  }

  // Stamp the request with its market. Never trusted from the client: it is
  // derived from the path here, or carried over only when it arrives with our
  // own valid signature (the second pass above), so `x-market` can't be
  // spoofed by sending the header yourself.
  const market = isLk ? "lk" : "intl";
  const headers = new Headers(req.headers);
  headers.set(MARKET_HEADER, market);
  headers.set(MARKET_SIG_HEADER, await signMarket(market, pathname));
  // The market-stripped path, for the root layout's canonical/hreflang tags
  // (layouts can't read the URL themselves). Overwritten for the same reason.
  headers.set(APP_PATH_HEADER, pathname);

  const response = isLkPath(rawPath)
    ? NextResponse.rewrite((() => {
        const rewritten = req.nextUrl.clone();
        rewritten.pathname = pathname;
        return rewritten;
      })(), { request: { headers } })
    : NextResponse.next({ request: { headers } });

  // Sales-referral link capture (lib/sales-referrals.ts): any ?ref=<token>
  // on any page refreshes a 24h cookie, no DB lookup here on purpose —
  // this file deliberately stays Prisma-free (see the auth() comment up
  // top). An unknown/stale token just never resolves to a real promoter
  // later (actions/checkout.ts), which is harmless. Last click always
  // wins: landing on a (possibly different) referral link resets the
  // clock to a fresh token. The query param itself is left in the URL,
  // same "doesn't need cleaning up" treatment a UTM param gets — the
  // cookie, not the param, is what actually persists across the site.
  const refToken = req.nextUrl.searchParams.get("ref");
  if (refToken) {
    response.cookies.set(SALES_REF_COOKIE, refToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SALES_REF_COOKIE_MAX_AGE_SECONDS,
    });
  }

  return response;
});

export const config = {
  // Every page request (the market header has to be set on all of them),
  // but not framework internals, API routes (the PayHere/NextAuth callbacks
  // stay unprefixed), uploaded media, or static files.
  matcher: [
    "/((?!_next/static|_next/image|api|media|images|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|css|js|map|woff2?|mp4|webm|pdf)$).*)",
  ],
};
