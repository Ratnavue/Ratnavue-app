import type { Metadata } from "next";
import Link from "@/components/ui/MarketLink";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pollChatMessages } from "@/actions/chat";
import { getChatContext, getConversationsForCustomer, getGeneralThreadInfo, type ChatRequestType } from "@/lib/chat";
import { markNotificationsReadForRequest } from "@/lib/notifications";
import { buildConversationRows, designLabel } from "@/lib/account-hub";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ConversationRow } from "@/components/account/ConversationRow";
import { RefreshOnSelect } from "@/components/account/RefreshOnSelect";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Messages" };

const TYPES: ChatRequestType[] = ["general", "quote", "sourcing"];

// The customer's inbox: every conversation in one list (support, plus a thread
// for each quote, custom design and sourcing request that has messages), with
// the selected one open beside it. On a phone it's one or the other — the list,
// then the thread with a back link.
export default async function AccountMessagesPage({ searchParams }: PageProps<"/account/messages">) {
  const session = await auth();
  if (!session?.user) return null; // proxy.ts guards this route
  const userId = session.user.id;

  const sp = await searchParams;
  const [conversations, general] = await Promise.all([getConversationsForCustomer(userId), getGeneralThreadInfo(userId)]);
  const rows = buildConversationRows(conversations, general);

  // Which conversation is open. The support thread is keyed by the customer's
  // own id; for a request thread the id must belong to this customer (the same
  // ownership check every chat action starts from) or nothing is opened.
  const typeParam = typeof sp.type === "string" ? (sp.type as ChatRequestType) : null;
  const type = typeParam && TYPES.includes(typeParam) ? typeParam : null;
  const requestId = type === "general" ? userId : typeof sp.id === "string" ? sp.id : "";
  const context = type && requestId ? await getChatContext(type, requestId) : null;
  const selectedKey = type && context?.customerId === userId ? (type === "general" ? "general" : `${type}:${requestId}`) : null;

  let selected: { type: ChatRequestType; id: string; title: string; requestHref: string | null } | null = null;
  if (type && selectedKey) {
    const known = rows.find((r) => r.key === selectedKey);
    let title = known?.title ?? "Conversation";
    if (!known && type === "quote") {
      const quote = await prisma.quoteRequest.findUnique({ where: { id: requestId }, include: { gemstone: { select: { name: true } }, jewelry: { select: { name: true } } } });
      if (quote) title = quote.gemstone?.name ?? quote.jewelry?.name ?? designLabel(quote);
    } else if (!known && type === "sourcing") {
      const request = await prisma.sourcingRequest.findUnique({ where: { id: requestId }, select: { mineralDescription: true } });
      if (request) title = request.mineralDescription;
    }
    selected = {
      type,
      id: requestId,
      title,
      requestHref: type === "quote" ? `/account/quotes/${requestId}` : type === "sourcing" ? `/account/sourcing/${requestId}` : null,
    };
  }

  const thread = selected
    ? await Promise.all([
        prisma.cart.findFirst({ where: { userId, status: "OPEN" }, include: { items: true } }),
        pollChatMessages(selected.type, selected.id),
        markNotificationsReadForRequest(selected.type, selected.id, userId),
      ])
    : null;

  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-gold-deep">Account</p>
      <h1 className="mt-2 font-serif text-3xl text-charcoal sm:text-4xl">Messages</h1>
      <p className="mt-1 text-sm text-charcoal/60">Your conversations with Ratnavue — about a quote, a sourcing request, a custom design, or anything else.</p>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <div className={cn("self-start overflow-hidden rounded-xl border border-border-subtle bg-surface", selected && "hidden lg:block")}>
          {rows.map((row) => (
            <ConversationRow key={row.key} item={row.key === selectedKey ? { ...row, unread: 0 } : row} active={row.key === selectedKey} />
          ))}
        </div>

        <div className={cn("min-w-0", !selected && "hidden lg:block")}>
          {selected && thread ? (
            <div>
              <RefreshOnSelect selectedKey={`${selected.type}:${selected.id}`} />
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Link href="/account/messages" className="mb-1 inline-flex items-center gap-1 text-xs text-charcoal/60 hover:text-charcoal lg:hidden">
                    <ArrowLeft size={12} /> All messages
                  </Link>
                  <h2 className="truncate font-serif text-2xl text-charcoal">{selected.title}</h2>
                </div>
                {selected.requestHref && (
                  <Link href={selected.requestHref} className="text-xs text-gold-deep underline-offset-4 hover:underline">
                    View request →
                  </Link>
                )}
              </div>
              <ChatPanel
                key={`${selected.type}:${selected.id}`}
                requestType={selected.type}
                requestId={selected.id}
                currentUserId={userId}
                initialMessages={thread[1]}
                hasOpenCart={!!thread[0] && thread[0].items.length > 0}
              />
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center">
              <MessageCircle size={32} strokeWidth={1.2} className="text-charcoal/30" />
              <p className="mt-3 font-serif text-xl text-charcoal">Select a conversation</p>
              <p className="mt-1 max-w-xs text-sm text-charcoal/60">
                Pick one from the list, or start with Ratnavue Support — we reply to questions about anything here.
              </p>
              <Link href="/account/messages?type=general" className="mt-4 rounded-full border border-gold bg-gold/10 px-4 py-1.5 text-xs font-medium text-charcoal hover:bg-gold/25">
                Chat with support
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
