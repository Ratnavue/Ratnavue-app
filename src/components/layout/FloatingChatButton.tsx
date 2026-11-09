"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/ui/MarketLink";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { pollMyConversations, pollChatMessages, getHasOpenCartForRequest, type ConversationView, type ChatMessageView } from "@/actions/chat";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { cn } from "@/lib/utils";

// Same "plain polling" convention as ChatPanel/NotificationBell — see
// NotificationBell's own comment for why this trades some immediacy for
// far less background traffic than a per-request panel's 3s poll.
const POLL_INTERVAL_MS = 20000;

function requestHref(c: Pick<ConversationView, "requestType" | "requestId">): string {
  if (c.requestType === "quote") return `/account/quotes/${c.requestId}`;
  if (c.requestType === "sourcing") return `/account/sourcing/${c.requestId}`;
  return "/account/support";
}

function timeAgo(iso: string | null): string | null {
  if (!iso) return null;
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

/** Bottom-right floating entry point into chat — signed-in only. Always
 * offers "Chat with Support" (a general thread the customer starts
 * themselves, see /account/support) pinned first, plus any existing
 * quote/sourcing conversations below. Selecting a conversation chats
 * right there in the popup (an embedded ChatPanel, same component the
 * full account pages use) — "Open full page" is offered alongside it for
 * anyone who'd rather have the whole page. With nothing else going on
 * (the common case — just Support, no other conversation yet) this skips
 * the list and opens straight into that chat. */
export function FloatingChatButton() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ConversationView[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<ConversationView | null>(null);
  const [panelMessages, setPanelMessages] = useState<ChatMessageView[] | null>(null);
  const [panelHasOpenCart, setPanelHasOpenCart] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const result = await pollMyConversations();
      if (cancelled) return;
      setItems(result.items);
      setUnreadCount(result.unreadCount);
      setCurrentUserId(result.userId);
      setLoaded(true);
    }
    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function openConversation(c: ConversationView) {
    setSelected(c);
    setPanelMessages(null);
    // Opening a conversation is what actually marks it read (ChatPanel
    // does this itself on mount) - clear its badge here right away rather
    // than waiting up to POLL_INTERVAL_MS for the next background poll to
    // notice, which read as the unread number never going away.
    if (c.unreadCount > 0) {
      setItems((prev) => prev.map((item) => (item.requestType === c.requestType && item.requestId === c.requestId ? { ...item, unreadCount: 0 } : item)));
      setUnreadCount((prev) => Math.max(0, prev - c.unreadCount));
    }
    const [messages, hasOpenCart] = await Promise.all([pollChatMessages(c.requestType, c.requestId), getHasOpenCartForRequest(c.requestType, c.requestId)]);
    setPanelMessages(messages);
    setPanelHasOpenCart(hasOpenCart);
  }

  function handleClick() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    // Not loaded yet (first poll still in flight) — the popup shows its
    // own loading state rather than guessing at a single-conversation
    // shortcut from stale/empty data.
    if (loaded && items.length === 1) {
      openConversation(items[0]);
    } else {
      setSelected(null);
    }
  }

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-40">
      {open && (
        <div className="absolute bottom-16 right-0">
          {!selected ? (
            <div className="w-80 max-w-[85vw] rounded-xl border border-border-subtle bg-surface p-2 text-left shadow-lg">
              <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-charcoal/65">Chat</p>
              <div className="max-h-80 overflow-y-auto">
                {!loaded && <p className="px-2 py-6 text-center text-sm text-charcoal/65">Loading...</p>}
                {loaded &&
                  items.map((c, i) => (
                    <button
                      key={`${c.requestType}-${c.requestId}`}
                      type="button"
                      onClick={() => openConversation(c)}
                      className={cn(
                        "block w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-ivory-soft",
                        c.unreadCount > 0 && "bg-gold/10",
                        // A visual break between the always-there "Chat
                        // with Support" pin and whatever quote/sourcing
                        // conversations follow it — skipped when Support
                        // is the only entry, since there'd be nothing to
                        // separate.
                        i === 0 && items.length > 1 && "mb-1 border-b border-border-subtle pb-2.5",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium text-charcoal">{c.itemLabel}</p>
                        {c.unreadCount > 0 && (
                          <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-medium text-night">
                            {c.unreadCount > 9 ? "9+" : c.unreadCount}
                          </span>
                        )}
                      </div>
                      {c.lastMessagePreview ? (
                        <>
                          <p className="truncate text-xs text-charcoal/60">{c.lastMessagePreview}</p>
                          <p className="mt-0.5 text-xs text-charcoal/65">{timeAgo(c.lastMessageAt)}</p>
                        </>
                      ) : (
                        <p className="text-xs text-charcoal/60">Start a conversation with our team.</p>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            <div className="w-96 max-w-[90vw]">
              <div className="flex items-center justify-between rounded-t-xl border border-b-0 border-border-subtle bg-surface px-3 py-2 shadow-lg">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex items-center gap-1 text-sm text-charcoal/70 hover:text-charcoal"
                >
                  <ChevronLeft size={16} />
                  {items.length > 1 ? "Back" : "Chat"}
                </button>
                <p className="truncate px-2 text-sm font-medium text-charcoal">{selected.itemLabel}</p>
                <Link href={requestHref(selected)} className="shrink-0 text-xs text-gold-deep hover:underline">
                  Open full page ↗
                </Link>
              </div>
              {panelMessages === null || !currentUserId ? (
                <div className="rounded-b-xl border border-t-0 border-border-subtle bg-surface p-5 shadow-lg">
                  <p className="text-sm text-charcoal/65">Loading...</p>
                </div>
              ) : (
                <div className="[&>div]:rounded-t-none [&>div]:shadow-lg">
                  <ChatPanel
                    key={`${selected.requestType}-${selected.requestId}`}
                    requestType={selected.requestType}
                    requestId={selected.requestId}
                    currentUserId={currentUserId}
                    initialMessages={panelMessages}
                    hasOpenCart={panelHasOpenCart}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        aria-label="Your conversations"
        className={cn(
          "relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5",
          // Glass bubble: a translucent tint (not a solid fill) plus
          // backdrop-blur is what actually reads as "glass" — a border
          // alone on a transparent background just looks unstyled. The
          // charcoal tint (rather than white) is what keeps the white
          // icon/badge legible over both this site's light pages and its
          // dark home/collection heroes, since backdrop-blur alone doesn't
          // add contrast, it only blurs whatever's already behind it.
          "border border-white/30 bg-charcoal/35 hover:bg-charcoal/50",
        )}
      >
        <MessageCircle size={24} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[11px] font-medium text-night">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
