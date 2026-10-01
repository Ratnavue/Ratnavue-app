"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { signOutAction } from "@/actions/auth";
import { cn } from "@/lib/utils";
import { staffNavLinks } from "@/lib/staff-permissions";

const NAV = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/gems", label: "Gemstones" },
  { href: "/admin/jewelry", label: "Jewelry" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/quotes", label: "Quote Requests" },
  { href: "/admin/sourcing", label: "Sourcing Requests" },
  { href: "/admin/design-studio", label: "Design Studio" },
  { href: "/admin/carts", label: "Submitted Carts" },
  { href: "/admin/discount-codes", label: "Discount Codes" },
  { href: "/admin/bundles", label: "Bundles" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/auctions", label: "Auctions" },
  { href: "/admin/invoices", label: "Invoices" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/staff", label: "Staff Accounts" },
  { href: "/admin/wholesale-applications", label: "Wholesale Applications" },
  { href: "/admin/orders", label: "Retail Orders" },
  { href: "/admin/commerce-settings", label: "Commerce Settings" },
  { href: "/admin/shipping-zones", label: "Shipping Zones" },
];

const MASTER_DATA = [
  { href: "/admin/master-data/minerals", label: "Minerals" },
  { href: "/admin/master-data/cuts", label: "Cuts" },
  { href: "/admin/master-data/clarity", label: "Clarity Scale" },
  { href: "/admin/master-data/treatments", label: "Treatments" },
  { href: "/admin/master-data/origins", label: "Origins" },
  { href: "/admin/master-data/certification-labs", label: "Certification Labs" },
];

const PAGE_CONTENT = [
  { href: "/admin/content/home", label: "Home Page" },
  { href: "/admin/content/about", label: "About Page" },
  { href: "/admin/promotions", label: "Seasonal Promotions" },
  { href: "/admin/alt-collections", label: "Alternative Collections" },
];

const REWARDS = [
  { href: "/admin/loyalty-settings", label: "Loyalty Settings" },
  { href: "/admin/referrals", label: "Referrals" },
  { href: "/admin/business-accounts", label: "Business Accounts" },
];

// A STAFF account only sees the areas an admin switched on for them (see
// lib/staff-permissions.ts) — proxy.ts/admin/layout.tsx and every action do
// the real enforcement; this is just what they're shown.

// Shared by both the always-visible desktop sidebar and the mobile
// full-screen drawer, so the two link lists can't drift apart.
function NavLinks({ pathname, onNavigate, role, staffPermissions }: { pathname: string; onNavigate?: () => void; role: string; staffPermissions: string[] }) {
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  function section(items: typeof NAV) {
    return items.map((item) => (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "block rounded-md px-3 py-2 text-sm transition-colors hover:bg-white/10 hover:text-ivory",
          isActive(item.href, item.exact) && "bg-white/10 text-ivory"
        )}
      >
        {item.label}
      </Link>
    ));
  }

  if (role === "STAFF") {
    return (
      <>
        <div className="space-y-1">{section(staffNavLinks(staffPermissions))}</div>
        <Link href="/" onClick={onNavigate} className="mt-8 block px-3 text-xs text-ivory/40 hover:text-ivory/70">
          ← Back to storefront
        </Link>
        <form action={signOutAction} className="mt-2">
          <button type="submit" className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-ivory/40 transition-colors hover:text-ivory/70">
            <LogOut size={13} /> Sign Out
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <div className="space-y-1">{section(NAV)}</div>

      <p className="mt-8 px-3 text-xs uppercase tracking-wide text-ivory/40">Master Data</p>
      <div className="mt-2 space-y-1">{section(MASTER_DATA)}</div>

      <p className="mt-8 px-3 text-xs uppercase tracking-wide text-ivory/40">CMS</p>
      <div className="mt-2 space-y-1">{section(PAGE_CONTENT)}</div>

      <p className="mt-8 px-3 text-xs uppercase tracking-wide text-ivory/40">Rewards</p>
      <div className="mt-2 space-y-1">{section(REWARDS)}</div>

      <Link href="/" onClick={onNavigate} className="mt-8 block px-3 text-xs text-ivory/40 hover:text-ivory/70">
        ← Back to storefront
      </Link>

      {/* Admin had no sign-out affordance anywhere in /admin/* before this —
          the only way out was to already know to go to /account first. */}
      <form action={signOutAction} className="mt-2">
        <button
          type="submit"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-ivory/40 transition-colors hover:text-ivory/70"
        >
          <LogOut size={13} /> Sign Out
        </button>
      </form>
    </>
  );
}

function Logo({ children }: { children: ReactNode }) {
  return (
    <Link href="/admin" className="block px-2 font-serif text-xl text-ivory">
      {children}
    </Link>
  );
}

export function AdminSidebar({ role, staffPermissions = [] }: { role: string; staffPermissions?: string[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer on navigation. Adjusted during render (React's
  // documented pattern for "reset state when a prop changes") rather than
  // in an effect, which would set state synchronously right after the
  // first render and trigger an extra one.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      {/* Mobile top bar: the permanent 240px desktop sidebar has no room on
          a phone screen — it used to render unconditionally and squeeze
          every admin page's real content into a ~130px sliver. Below lg,
          navigation instead lives behind this bar's toggle. */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-charcoal px-4 py-3 print:hidden lg:hidden">
        <Logo>Ratnavue Admin</Logo>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle admin menu"
          className="text-ivory"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        // flex h-dvh flex-col + overflow-hidden on this outer box, with
        // overflow-y-auto on a separate inner flex-1 region below — not
        // overflow-y-auto directly on this fixed element. The two
        // combined (scrolling a position:fixed element via its own
        // overflow) is a known WebKit/iOS Safari bug where touch-scroll
        // silently does nothing; Navbar.tsx's mobile menu already solves
        // this the same way. The link list has grown past one phone
        // screen (25+ entries across three sections), so this isn't
        // optional here.
        <div className="fixed inset-0 z-50 flex h-dvh flex-col overflow-hidden bg-charcoal text-ivory/80 lg:hidden">
          <div className="flex shrink-0 items-center justify-between px-6 py-6">
            <Logo>Ratnavue Admin</Logo>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="text-ivory">
              <X size={22} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-8">
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} role={role} staffPermissions={staffPermissions} />
          </div>
        </div>
      )}

      {/* Desktop sidebar — unchanged from before, just now gated to lg+
          instead of always rendering. */}
      <nav className="hidden w-60 shrink-0 border-r border-white/10 bg-charcoal px-4 py-8 text-ivory/80 print:hidden lg:block">
        <Logo>Ratnavue Admin</Logo>
        <div className="mt-8">
          <NavLinks pathname={pathname} role={role} staffPermissions={staffPermissions} />
        </div>
      </nav>
    </>
  );
}
