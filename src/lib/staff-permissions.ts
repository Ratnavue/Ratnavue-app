// Edge-safe (no Prisma/auth imports) — proxy.ts uses this too.

export const STAFF_AREAS = ["dashboard", "orders", "catalog", "content", "requests", "reviews"] as const;
export type StaffArea = (typeof STAFF_AREAS)[number];

export const STAFF_AREA_LABELS: Record<StaffArea, { label: string; short: string; description: string }> = {
  dashboard: { label: "Dashboard & analytics", short: "Dashboard", description: "See the dashboard and the revenue and order analytics for their store(s). Profit, cost prices, points, referrals and other business-wide figures stay admin-only." },
  orders: { label: "Orders", short: "Orders", description: "Mark bank transfers paid, add tracking, revert a payment, chat on an order." },
  catalog: { label: "Gems & Jewelry", short: "Gems & Jewelry", description: "Add and edit listings, photos, stock and visibility. No deleting, featuring, cost price, or price changes on existing items." },
  content: { label: "Home & About pages", short: "Home & About", description: "Edit the text, images and slideshow on the home page (limited to their store) and the About page. Not promotions, payment instructions, page visibility or pricing." },
  requests: { label: "Messages, quotes & sourcing", short: "Messages & requests", description: "Reply to chats and work quote and sourcing requests. These have no store, so they aren't limited by market." },
  reviews: { label: "Review moderation", short: "Reviews", description: "Approve or reject customer reviews." },
};

const AREA_PATHS: Record<StaffArea, string[]> = {
  // The dashboard itself is the bare /admin page — matched exactly in
  // staffAreaForPath, since as a prefix it would swallow every admin page.
  dashboard: ["/admin/analytics"],
  orders: ["/admin/orders"],
  catalog: ["/admin/gems", "/admin/jewelry"],
  content: ["/admin/content"],
  requests: ["/admin/messages", "/admin/quotes", "/admin/sourcing", "/admin/support", "/admin/design-studio"],
  reviews: ["/admin/reviews"],
};

// Sub-pages of an allowed prefix that stay admin-only regardless.
const ADMIN_ONLY_PATTERNS = [/^\/admin\/orders\/manual(\/|$)/, /^\/admin\/sourcing\/[^/]+\/build-order(\/|$)/];

export function parseStaffPermissions(value: unknown): StaffArea[] {
  if (!Array.isArray(value)) return [];
  return STAFF_AREAS.filter((area) => value.includes(area));
}

export function staffAreaForPath(pathname: string): StaffArea | null {
  if (pathname === "/admin") return "dashboard";
  if (ADMIN_ONLY_PATTERNS.some((re) => re.test(pathname))) return null;
  for (const area of STAFF_AREAS) {
    if (AREA_PATHS[area].some((p) => pathname === p || pathname.startsWith(p + "/"))) return area;
  }
  return null;
}

export function staffCanAccessPath(permissions: readonly string[], pathname: string): boolean {
  const area = staffAreaForPath(pathname);
  return area !== null && permissions.includes(area);
}

export function firstStaffPath(permissions: readonly string[]): string | null {
  for (const area of STAFF_AREAS) {
    if (!permissions.includes(area)) continue;
    return area === "dashboard" ? "/admin" : AREA_PATHS[area][0];
  }
  return null;
}

export function staffNavLinks(permissions: readonly string[]): { href: string; label: string; exact?: boolean }[] {
  const links: { href: string; label: string; exact?: boolean }[] = [];
  if (permissions.includes("dashboard")) {
    links.push({ href: "/admin", label: "Dashboard", exact: true }, { href: "/admin/analytics", label: "Analytics" });
  }
  if (permissions.includes("orders")) links.push({ href: "/admin/orders", label: "Orders" });
  if (permissions.includes("catalog")) {
    links.push({ href: "/admin/gems", label: "Gemstones" }, { href: "/admin/jewelry", label: "Jewelry" });
  }
  if (permissions.includes("content")) {
    links.push({ href: "/admin/content/home", label: "Home Page" }, { href: "/admin/content/about", label: "About Page" });
  }
  if (permissions.includes("requests")) {
    links.push(
      { href: "/admin/messages", label: "Messages" },
      { href: "/admin/quotes", label: "Quote Requests" },
      { href: "/admin/sourcing", label: "Sourcing Requests" },
      { href: "/admin/design-studio", label: "Design Studio" },
    );
  }
  if (permissions.includes("reviews")) links.push({ href: "/admin/reviews", label: "Reviews" });
  return links;
}
