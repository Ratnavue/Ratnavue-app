"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/ui/MarketLink";
import { Bell, X } from "lucide-react";
import {
  pollNotifications,
  markAllNotificationsRead,
  dismissNotification,
  dismissAllNotifications,
  type NotificationView,
} from "@/actions/notifications";
import { useAppPathname } from "@/components/providers/MarketProvider";
import { cn } from "@/lib/utils";

// Same "plain polling, not push" reasoning as ChatPanel — see its own
// comment — but slower: this runs on every page for a signed-in customer
// (not just while a specific request's chat is open), so it trades some
// immediacy for a lot less background traffic site-wide.
const POLL_INTERVAL_MS = 20000;

// The dropdown's own target width and the minimum gap it keeps from either
// viewport edge — see the positioning effect below for why this is computed
// in JS rather than a plain `absolute right-0`.
const PANEL_WIDTH = 320;
const PANEL_MARGIN = 12;

function requestHref(n: NotificationView): string {
  if (n.requestType === "quote") return `/account/quotes/${n.requestId}`;
  if (n.requestType === "sourcing") return `/account/sourcing/${n.requestId}`;
  if (n.requestType === "order") return `/account/orders/${n.requestId}`;
  if (n.requestType === "referral") return "/account/rewards";
  return "/account/support";
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

/** Signed-in-only bell in the main Navbar — polls for the customer's own
 * notifications (an admin chat reply, a status change on their quote/
 * sourcing request, or an order being paid/failed/cancelled; see
 * lib/notifications.ts) and lists them in a dropdown. Visiting the linked
 * request page is what actually marks its notifications read (see
 * markNotificationsReadForRequest in the account detail pages) — "Mark all
 * read" here is just a shortcut for clearing the badge without visiting
 * each one; "×"/"Clear all" dismiss a notification outright.
 *
 * `size` defaults to the desktop row's cart-icon size (19) but Navbar
 * passes 21 in its mobile row, matching that row's own larger cart icon —
 * this bell renders once in each row, and a fixed size here previously
 * left it visibly smaller than its neighbour on mobile specifically. */
export function NotificationBell({ transparent, size = 19 }: { transparent: boolean; size?: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationView[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panel, setPanel] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // This bell lives in the persistent Navbar (outside MainWrapper's
  // per-route remount), so it never unmounts across a client-side
  // navigation — including the exact one a customer takes by clicking a
  // notification here. Re-polling on pathname change picks up whatever that
  // destination page just marked read (see markNotificationsReadForRequest
  // in the account detail pages) immediately, rather than leaving the badge
  // stale for up to POLL_INTERVAL_MS.
  const pathname = useAppPathname();

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const result = await pollNotifications();
      if (cancelled) return;
      setItems(result.items);
      setUnreadCount(result.unreadCount);
    }
    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // The panel is `position: fixed` with its position computed here rather
  // than the usual `absolute right-0`: the bell isn't always the rightmost
  // icon in the header (the store/language switchers and, on a phone, the
  // menu button all sit after it), so anchoring a 320px-wide panel purely to
  // the bell's own position could — and on a phone, did — push it off the
  // left edge of the screen. This right-aligns to the button when there's
  // room and otherwise slides left only as far as a small margin from the
  // viewport edge, so it always stays fully on screen.
  useEffect(() => {
    if (!open) return;
    function place() {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const width = Math.min(PANEL_WIDTH, window.innerWidth - PANEL_MARGIN * 2);
      const left = Math.min(Math.max(rect.right - width, PANEL_MARGIN), window.innerWidth - width - PANEL_MARGIN);
      setPanel({ top: rect.bottom + 8, left, width });
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  async function handleMarkAll() {
    setUnreadCount(0);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await markAllNotificationsRead();
  }

  async function handleDismiss(id: string) {
    const wasUnread = items.some((n) => n.id === id && !n.readAt);
    setItems((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((n) => Math.max(0, n - 1));
    await dismissNotification(id);
  }

  async function handleClearAll() {
    setItems([]);
    setUnreadCount(0);
    await dismissAllNotifications();
  }

  return (
    <div className="relative inline-flex" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className={cn("relative transition-colors duration-300", transparent ? "text-cream/85 hover:text-cream" : "text-charcoal/80 hover:text-charcoal")}
      >
        <Bell size={size} />
        {unreadCount > 0 && (
          <span key={unreadCount} className="animate-badge-bump absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-medium text-night">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && panel && (
        <div
          style={{ top: panel.top, left: panel.left, width: panel.width }}
          className="animate-pop-in fixed z-50 rounded-xl border border-border-subtle bg-surface p-2 text-left shadow-lg"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 py-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">Notifications</p>
            {items.length > 0 && (
              <div className="flex items-center gap-3 text-xs">
                {unreadCount > 0 && (
                  <button type="button" onClick={handleMarkAll} className="text-gold-deep hover:underline">
                    Mark all read
                  </button>
                )}
                <button type="button" onClick={handleClearAll} className="text-charcoal/65 hover:text-charcoal hover:underline">
                  Clear all
                </button>
              </div>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && <p className="px-2 py-6 text-center text-sm text-charcoal/65">No notifications yet.</p>}
            {items.map((n) => (
              <div key={n.id} className={cn("flex items-start gap-0.5 rounded-lg transition-colors hover:bg-ivory-soft", !n.readAt && "bg-gold/10")}>
                <Link href={requestHref(n)} onClick={() => setOpen(false)} className="min-w-0 flex-1 px-2.5 py-2 text-sm">
                  <p className="text-charcoal">{n.message}</p>
                  <p className="mt-0.5 text-xs text-charcoal/65">{timeAgo(n.createdAt)}</p>
                </Link>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => handleDismiss(n.id)}
                  className="mr-1 mt-1.5 shrink-0 rounded p-1 text-charcoal/65 transition-colors hover:bg-charcoal/10 hover:text-charcoal"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
