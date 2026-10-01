"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { QuoteStatusBadge } from "@/components/ui/Badge";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { pollChatMessages, getHasOpenCartForRequest, type ChatMessageView } from "@/actions/chat";
import type { ChatRequestType } from "@/lib/chat";
import { cn } from "@/lib/utils";
import { CARD_TABLE, CARD_THEAD, CARD_TBODY, CARD_TR, CARD_TD, CARD_FIRST, CARD_SECOND } from "@/components/admin/responsive-table";

export interface InboxRow {
  requestType: ChatRequestType;
  requestId: string;
  itemLabel: string;
  customerName: string;
  customerEmail: string;
  // null for "general" — a support chat has no QuoteStatus of its own.
  status: string | null;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  unread: number;
}

function rowHref(r: Pick<InboxRow, "requestType" | "requestId">): string {
  if (r.requestType === "quote") return `/admin/quotes/${r.requestId}`;
  if (r.requestType === "sourcing") return `/admin/sourcing/${r.requestId}`;
  return `/admin/support/${r.requestId}`;
}

function rowKey(r: Pick<InboxRow, "requestType" | "requestId">): string {
  return `${r.requestType}-${r.requestId}`;
}

/** The table itself is server-rendered data (search/sort/pagination all
 * stay query-param-driven — see AdminMessagesPage), but replying needs
 * client interactivity: clicking a row selects it and loads its
 * ChatPanel inline on the right, the same "select a conversation, reply
 * right there" pattern an email client's split view uses, rather than
 * every reply requiring a full navigation to that request's own detail
 * page (still one click away via "Full page" for anything that needs
 * more, like changing a quote's status). */
export function AdminMessagesInbox({ rows: initialRows, currentAdminId }: { rows: InboxRow[]; currentAdminId: string }) {
  const [rows, setRows] = useState(initialRows);
  const [selected, setSelected] = useState<InboxRow | null>(null);
  const [panelMessages, setPanelMessages] = useState<ChatMessageView[] | null>(null);
  const [panelHasOpenCart, setPanelHasOpenCart] = useState(false);

  async function select(r: InboxRow) {
    setSelected(r);
    setPanelMessages(null);
    // Opening a conversation is what actually marks it read (ChatPanel
    // does this itself on mount) - the row list is otherwise static data
    // from the initial server render, so without this its unread badge
    // would sit there until the whole page was reloaded.
    if (r.unread > 0) {
      setRows((prev) => prev.map((row) => (rowKey(row) === rowKey(r) ? { ...row, unread: 0 } : row)));
    }
    const [messages, hasOpenCart] = await Promise.all([
      pollChatMessages(r.requestType, r.requestId),
      getHasOpenCartForRequest(r.requestType, r.requestId),
    ]);
    setPanelMessages(messages);
    setPanelHasOpenCart(hasOpenCart);
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className={CARD_TABLE}>
          <thead className={CARD_THEAD}>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-charcoal/65">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Last Message</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className={CARD_TBODY}>
            {rows.map((r) => {
              const active = selected && rowKey(selected) === rowKey(r);
              return (
                <tr
                  key={rowKey(r)}
                  onClick={() => select(r)}
                  className={cn(CARD_TR, "cursor-pointer", active && "bg-ivory-soft")}
                >
                  <td className={CARD_FIRST}>
                    <div className="flex items-center gap-2 text-charcoal">
                      {r.customerName}
                      {r.unread > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-medium text-charcoal">
                          <MessageCircle size={10} /> {r.unread}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-charcoal/45">{r.customerEmail}</p>
                  </td>
                  <td data-label="Type" className={`${CARD_TD} text-charcoal/70`}>{r.requestType === "quote" ? "Quote" : r.requestType === "sourcing" ? "Sourcing" : "Support"}</td>
                  <td data-label="Item" className={`${CARD_TD} text-charcoal/70`}>{r.itemLabel}</td>
                  <td data-label="Last message" className={`${CARD_TD} text-charcoal/70 max-lg:flex-col max-lg:items-start max-lg:gap-0 max-lg:text-left`}>
                    {r.lastMessagePreview ? (
                      <>
                        <p className="max-w-xs truncate max-lg:max-w-none">{r.lastMessagePreview}</p>
                        <p className="text-xs text-charcoal/45">{r.lastMessageAt?.toLocaleString()}</p>
                      </>
                    ) : (
                      <span className="text-charcoal/40">Attachment only</span>
                    )}
                  </td>
                  <td data-label="Status" className={CARD_SECOND}>{r.status ? <QuoteStatusBadge status={r.status} /> : <span className="text-charcoal/30">—</span>}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr className="max-lg:block"><td colSpan={5} className="px-4 py-8 text-center text-charcoal/65 max-lg:block">No conversations found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="lg:sticky lg:top-6">
        {!selected ? (
          <div className="rounded-xl border border-dashed border-border-subtle bg-surface p-6 text-center text-sm text-charcoal/50">
            Select a conversation to reply.
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between gap-2 rounded-t-xl border border-b-0 border-border-subtle bg-ivory-soft px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-charcoal">{selected.customerName}</p>
                <p className="truncate text-xs text-charcoal/50">{selected.itemLabel}</p>
              </div>
              <Link href={rowHref(selected)} className="shrink-0 text-xs text-gold hover:underline">
                Full page ↗
              </Link>
            </div>
            {panelMessages === null ? (
              <div className="rounded-b-xl border border-t-0 border-border-subtle bg-surface p-5">
                <p className="text-sm text-charcoal/50">Loading...</p>
              </div>
            ) : (
              <div className="[&>div]:rounded-t-none">
                <ChatPanel
                  key={rowKey(selected)}
                  requestType={selected.requestType}
                  requestId={selected.requestId}
                  currentUserId={currentAdminId}
                  initialMessages={panelMessages}
                  hasOpenCart={panelHasOpenCart}
                  allowVideoCallRequest={selected.requestType === "quote" || selected.requestType === "sourcing"}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
