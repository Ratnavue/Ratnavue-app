"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/ui/MarketLink";
import PlainLink from "next/link";
import { useAppPathname } from "@/components/providers/MarketProvider";
import { User, ChevronDown } from "lucide-react";
import { signOutAction } from "@/actions/auth";
import { cn } from "@/lib/utils";

// Shared with Navbar's mobile menu (its account section mirrors this same
// list) so the two can't drift apart.
export const ACCOUNT_MENU_LINKS = [
  { href: "/", label: "Home" },
  { href: "/account", label: "My Account" },
  { href: "/account/orders", label: "My Orders" },
  { href: "/account/messages", label: "Messages" },
  { href: "/account/retail-cart", label: "My Cart" },
  { href: "/account/wishlist", label: "My Wishlist" },
  { href: "/account/sourcing", label: "Sourcing Requests" },
  { href: "/account/custom-designs", label: "Custom Designs" },
  { href: "/account/quotes", label: "Quote Requests" },
  { href: "/account/change-password", label: "Change Password" },
];

export function AccountMenu({
  user,
  transparent,
  compact = false,
}: {
  user: { name?: string | null; hasAdminAccess?: boolean };
  transparent: boolean;
  /** Icon only, no name/chevron — for the mobile icon row, which is
   * already packing cart/bell/store/language/hamburger into one line
   * with real width constraints the desktop row doesn't have. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = useAppPathname();

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={compact ? (user.name?.split(" ")[0] ?? "Account") : undefined}
        className={cn(
          "flex items-center gap-2 text-sm transition-colors duration-300",
          transparent ? "text-cream/85 hover:text-cream" : "text-charcoal/80 hover:text-charcoal",
        )}
      >
        <User size={compact ? 21 : 16} />
        {!compact && (
          <>
            {user.name?.split(" ")[0] ?? "Account"}
            <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
          </>
        )}
      </button>

      {open && (
        <div className="animate-pop-in absolute right-0 top-full mt-2 w-56 rounded-lg border border-border-subtle bg-surface py-1.5 shadow-lg">
          {ACCOUNT_MENU_LINKS.map((link) => {
            const active = pathname === link.href;
            // Already there — showing it as a plain (non-Link) element
            // styled like its own hover state means clicking it can't
            // fire a redundant navigation/refresh, and the permanent
            // highlight itself communicates "you're here" without
            // needing to actually click to find out.
            if (active) {
              return (
                <span
                  key={link.href}
                  aria-current="page"
                  className="block cursor-default bg-ivory-soft px-4 py-2 text-sm font-medium text-charcoal"
                >
                  {link.label}
                </span>
              );
            }
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-charcoal/80 hover:bg-ivory-soft hover:text-charcoal"
              >
                {link.label}
              </Link>
            );
          })}
          {user.hasAdminAccess && (
            // Admin isn't part of either storefront, so this is a plain
            // (non-market-prefixed) link.
            <PlainLink
              href="/admin"
              onClick={() => setOpen(false)}
              className="mt-1 block border-t border-border-subtle px-4 py-2 pt-3 text-sm font-medium text-charcoal hover:bg-ivory-soft"
            >
              Admin Portal
            </PlainLink>
          )}
          <form action={signOutAction} className="border-t border-border-subtle mt-1 pt-1">
            <button type="submit" className="block w-full px-4 py-2 text-left text-sm text-charcoal/60 hover:bg-ivory-soft hover:text-charcoal">
              Sign Out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
