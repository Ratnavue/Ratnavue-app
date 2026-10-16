"use client";

import type { ComponentType } from "react";
import Link from "@/components/ui/MarketLink";
import PlainLink from "next/link";
import { useAppPathname } from "@/components/providers/MarketProvider";
import { Building2, CreditCard, FileText, Gift, LayoutDashboard, LogOut, MessageCircle, Package, PenTool, Percent, Search, ShieldCheck, ShoppingBag } from "lucide-react";
import { signOutAction } from "@/actions/auth";
import { cn } from "@/lib/utils";
import type { HubCounts } from "@/lib/account-hub";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** Only the exact path is "active" (the overview would otherwise match every /account/… page). */
  exact?: boolean;
  badge?: (counts: HubCounts) => number;
  /** A badge that needs attention (unread, awaiting payment) rather than a plain count. */
  attention?: boolean;
}

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "My Account",
    items: [{ href: "/account", label: "Overview", icon: LayoutDashboard, exact: true }],
  },
  {
    title: "Shopping",
    items: [
      { href: "/account/orders", label: "My Orders", icon: Package, badge: (c) => c.ordersAwaitingPayment, attention: true },
      { href: "/account/retail-cart", label: "Shopping Cart", icon: ShoppingBag, badge: (c) => c.cartItems },
      { href: "/account/cart", label: "Quote Payments", icon: CreditCard, badge: (c) => c.quotePayments, attention: true },
    ],
  },
  {
    title: "Messages & Requests",
    items: [
      { href: "/account/messages", label: "Messages", icon: MessageCircle, badge: (c) => c.unreadMessages, attention: true },
      { href: "/account/sourcing", label: "Sourcing Requests", icon: Search, badge: (c) => c.sourcingRequests },
      { href: "/account/custom-designs", label: "Custom Designs", icon: PenTool, badge: (c) => c.customDesigns },
      { href: "/account/quotes", label: "Quote Requests", icon: FileText, badge: (c) => c.catalogQuotes },
    ],
  },
  {
    title: "Rewards",
    items: [{ href: "/account/rewards", label: "Points & Referrals", icon: Gift }],
  },
];

const BUSINESS_ITEM: NavItem = { href: "/account/business", label: "Business", icon: Building2 };
// Only shown for a user an admin has designated a sales referral promoter
// (see AccountHubLayout's salesReferralPromoter check) — most users never
// see this item at all.
const SALES_REFERRAL_ITEM: NavItem = { href: "/account/sales-referral", label: "Sales Referral", icon: Percent };

// /account/support is the "Chat with Support" thread — it lives inside Messages
// now, so the Messages item stays lit while you're on it.
const ALIASES: Record<string, string> = { "/account/support": "/account/messages" };

export function AccountSidebar({
  user,
  counts,
  showBusiness,
  showAdminPortal,
  showSalesReferral,
}: {
  user: { name?: string | null; email?: string | null };
  counts: HubCounts;
  showBusiness?: boolean;
  showAdminPortal?: boolean;
  showSalesReferral?: boolean;
}) {
  const pathname = useAppPathname();
  const current = ALIASES[pathname] ?? pathname;
  const initial = (user.name?.trim()?.[0] ?? user.email?.[0] ?? "?").toUpperCase();

  const isActive = (item: NavItem) => (item.exact ? current === item.href : current === item.href || current.startsWith(`${item.href}/`));

  // Extra Rewards-group items appended conditionally, rather than whole new
  // one-item groups — a wholesale team member's "Business" (businessRole
  // set) and a designated promoter's "Sales Referral" (see AccountHubLayout).
  const extraRewardsItems = [...(showBusiness ? [BUSINESS_ITEM] : []), ...(showSalesReferral ? [SALES_REFERRAL_ITEM] : [])];
  const groups = extraRewardsItems.length > 0
    ? GROUPS.map((g) => (g.title === "Rewards" ? { ...g, items: [...g.items, ...extraRewardsItems] } : g))
    : GROUPS;

  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      {/* Desktop: the marketplace-style left rail — a profile card, then grouped links. */}
      <div className="hidden rounded-xl border border-border-subtle bg-surface lg:block">
        <div className="flex items-center gap-3 border-b border-border-subtle p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold/20 font-serif text-lg text-charcoal">{initial}</span>
          <div className="min-w-0">
            <p className="truncate font-medium text-charcoal">{user.name ?? "My Account"}</p>
            <p className="truncate text-xs text-charcoal/60">{user.email}</p>
          </div>
        </div>
        <nav className="p-3" aria-label="Account">
          {groups.map((group) => (
            <div key={group.title} className="mb-3 last:mb-0">
              <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-charcoal/65">{group.title}</p>
              {group.items.map((item) => {
                const active = isActive(item);
                const badge = item.badge?.(counts) ?? 0;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active ? "bg-gold/15 font-medium text-charcoal" : "text-charcoal/75 hover:bg-ivory-soft hover:text-charcoal",
                    )}
                  >
                    <Icon size={16} className={active ? "text-gold-deep" : "text-charcoal/65"} />
                    <span className="flex-1">{item.label}</span>
                    {badge > 0 && (
                      <span
                        className={cn(
                          "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-medium",
                          item.attention ? "bg-gold text-charcoal" : "bg-charcoal/8 text-charcoal/70",
                        )}
                      >
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        {showAdminPortal && (
          // Admin isn't part of either storefront, so a plain (non-market-prefixed) link.
          <div className="border-t border-border-subtle p-3">
            <PlainLink href="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-ivory-soft">
              <ShieldCheck size={16} className="text-gold-deep" /> Admin Portal
            </PlainLink>
          </div>
        )}
        <form action={signOutAction} className="border-t border-border-subtle p-3">
          <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-charcoal/65 transition-colors hover:bg-ivory-soft hover:text-charcoal">
            <LogOut size={16} className="text-charcoal/65" /> Sign out
          </button>
        </form>
      </div>

      {/* Phone / tablet: the same links as a scrolling tab strip above the page. */}
      <nav aria-label="Account" className="-mx-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-2">
          {groups.flatMap((g) => g.items).map((item) => {
            const active = isActive(item);
            const badge = item.badge?.(counts) ?? 0;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm transition-colors",
                  active ? "border-charcoal bg-charcoal text-ivory" : "border-border-subtle bg-surface text-charcoal/75",
                )}
              >
                <Icon size={15} />
                {item.label}
                {badge > 0 && (
                  <span className={cn("rounded-full px-1.5 text-[11px] font-medium", active ? "bg-ivory/20" : item.attention ? "bg-gold text-charcoal" : "bg-charcoal/10")}>
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
          {showAdminPortal && (
            <PlainLink href="/admin" className="flex items-center gap-2 whitespace-nowrap rounded-full border border-gold/50 bg-gold/10 px-3.5 py-2 text-sm font-medium text-charcoal">
              <ShieldCheck size={15} />
              Admin Portal
            </PlainLink>
          )}
        </div>
      </nav>
    </aside>
  );
}
