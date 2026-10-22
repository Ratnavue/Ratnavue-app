"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getMarket } from "@/lib/market";
import {
  getChatContext,
  getOrCreateChatThread,
  getChatMessages,
  getConversationsForCustomer,
  getGeneralThreadInfo,
  snapshotOpenCart,
  type ChatRequestType,
} from "@/lib/chat";
import { createNotification } from "@/lib/notifications";
import type { ActionResult } from "./auth";

export type ChatTag = { type: "gemstone" | "jewelry"; id: string } | { type: "cart" } | { type: "videoCallRequest" };

/** True when this session may act on the "admin side" of a conversation —
 * a real ADMIN always. A STAFF user needs the matching area switched on:
 * "orders" for an order thread (and then only within their market scope,
 * since an order has a store), "requests" for quote, sourcing and general
 * support threads (which have no store, so no market check applies). */
async function isChatAdminSide(user: { id: string; role: string; staffMarketScope: string | null; staffPermissions: string[] }, requestType: ChatRequestType, requestId: string): Promise<boolean> {
  // A "general" thread's requestId IS the customer's own userId (see
  // getChatContext's own comment) — so when it's this session's own id,
  // they're necessarily the customer in this conversation (their own
  // "contact support" thread), never "admin side," no matter their
  // site-wide role. Without this, an admin/staff account viewing their
  // own /account/messages support thread got treated as the admin side of
  // a conversation with themselves: markChatRead wrote lastReadByAdminAt
  // instead of lastReadByCustomerAt, and sendChatMessage tagged their own
  // messages senderRole ADMIN instead of CUSTOMER — so the customer-facing
  // unread count for their own thread could never clear, and the "general"
  // request path (/admin/support/<their own id>) is reserved for admin
  // staff viewing *someone else's* thread, never their own.
  if (requestType === "general" && requestId === user.id) return false;
  if (user.role === "ADMIN") return true;
  if (user.role !== "STAFF") return false;
  if (requestType !== "order") return user.staffPermissions.includes("requests");
  if (!user.staffPermissions.includes("orders")) return false;
  const order = await prisma.order.findUnique({ where: { id: requestId }, select: { market: true } });
  return !!order && (user.staffMarketScope === "both" || user.staffMarketScope === order.market);
}

function requestPaths(requestType: ChatRequestType, requestId: string): string[] {
  if (requestType === "quote") return [`/admin/quotes/${requestId}`, `/account/quotes/${requestId}`];
  if (requestType === "sourcing") return [`/admin/sourcing/${requestId}`, `/account/sourcing/${requestId}`];
  if (requestType === "order") return [`/admin/orders/${requestId}`, `/admin/orders`, `/account/orders/${requestId}`];
  // "general": requestId is the customer's own userId, not a request id —
  // see getChatContext's own comment.
  return [`/admin/support/${requestId}`, `/account/support`];
}

/**
 * Both sides send through this one action — the only difference is
 * whether the caller has to *own* the request (a customer) or just be an
 * admin (who can message on any request). A customer messaging a request
 * that isn't theirs, or that doesn't exist, gets the same "not found"
 * either way — no distinction that would confirm a guessed id belongs to
 * someone else.
 */
export async function sendChatMessage(input: {
  requestType: ChatRequestType;
  requestId: string;
  body: string;
  tag?: ChatTag;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sign in required." };

  const context = await getChatContext(input.requestType, input.requestId);
  if (!context) return { ok: false, error: "Request not found." };

  const isAdminSide = await isChatAdminSide(session.user, input.requestType, input.requestId);
  if (!isAdminSide && session.user.id !== context.customerId) return { ok: false, error: "Request not found." };

  const body = input.body.trim();
  if (!body && !input.tag) return { ok: false, error: "Write a message or attach something first." };
  if (body.length > 2000) return { ok: false, error: "Messages are limited to 2000 characters." };

  let taggedGemstoneId: string | undefined;
  let taggedJewelryId: string | undefined;
  let taggedCartSnapshot: object | undefined;
  let isVideoCallRequest = false;

  if (input.tag?.type === "gemstone") {
    const gem = await prisma.gemstone.findUnique({ where: { id: input.tag.id }, select: { id: true } });
    if (!gem) return { ok: false, error: "That gemstone couldn't be found." };
    taggedGemstoneId = gem.id;
  } else if (input.tag?.type === "jewelry") {
    const piece = await prisma.jewelryPiece.findUnique({ where: { id: input.tag.id }, select: { id: true } });
    if (!piece) return { ok: false, error: "That jewelry piece couldn't be found." };
    taggedJewelryId = piece.id;
  } else if (input.tag?.type === "cart") {
    const snapshot = await snapshotOpenCart(context.customerId);
    if (!snapshot) return { ok: false, error: "There's no open cart with items to attach." };
    taggedCartSnapshot = snapshot;
  } else if (input.tag?.type === "videoCallRequest") {
    isVideoCallRequest = true;
  }

  const threadId = context.threadId ?? (await getOrCreateChatThread(input.requestType, input.requestId));

  await prisma.chatMessage.create({
    data: {
      threadId,
      senderId: session.user.id,
      senderRole: isAdminSide ? session.user.role : "CUSTOMER",
      body: body || undefined,
      taggedGemstoneId,
      taggedJewelryId,
      taggedCartSnapshot,
      isVideoCallRequest,
    },
  });

  for (const path of requestPaths(input.requestType, input.requestId)) revalidatePath(path);

  // Only the admin side notifies — a customer sending a message doesn't
  // need to be told about their own message, and the admin's equivalent
  // (an unread badge) is already covered by getUnreadCount in the
  // /admin/messages inbox.
  if (isAdminSide) {
    const message =
      input.requestType === "quote"
        ? "You have a new reply on your quote request."
        : input.requestType === "sourcing"
          ? "You have a new reply on your sourcing request."
          : input.requestType === "order"
            ? "You have a new message about your order."
            : "You have a new reply from support.";
    await createNotification({ userId: context.customerId, type: "CHAT_REPLY", message, requestType: input.requestType, requestId: input.requestId });
  }

  return { ok: true };
}

/** Called when a thread is opened — records that this side has seen
 * everything up to now, which is what an unread count is measured
 * against (see getUnreadCount). A no-op if the thread doesn't exist yet
 * (nothing to have read). */
export async function markChatRead(requestType: ChatRequestType, requestId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sign in required." };

  const context = await getChatContext(requestType, requestId);
  if (!context) return { ok: false, error: "Request not found." };

  const isAdminSide = await isChatAdminSide(session.user, requestType, requestId);
  if (!isAdminSide && session.user.id !== context.customerId) return { ok: false, error: "Request not found." };
  if (!context.threadId) return { ok: true }; // nothing sent yet

  await prisma.chatThread.update({
    where: { id: context.threadId },
    data: isAdminSide ? { lastReadByAdminAt: new Date() } : { lastReadByCustomerAt: new Date() },
  });
  return { ok: true };
}

/**
 * The polling endpoint — called on an interval by the client panel (see
 * ChatPanel) to pick up new messages without a page reload. Same
 * ownership rule as sendChatMessage; returns an empty array rather than
 * an error for a thread that doesn't exist yet, since "no messages" is a
 * completely normal state here, not a failure.
 */
export async function pollChatMessages(requestType: ChatRequestType, requestId: string) {
  const session = await auth();
  if (!session?.user) return [];

  const context = await getChatContext(requestType, requestId);
  if (!context) return [];

  const isAdminSide = await isChatAdminSide(session.user, requestType, requestId);
  if (!isAdminSide && session.user.id !== context.customerId) return [];

  const messages = await getChatMessages(context.threadId);
  // A tagged item's price is shown in the viewer's own storefront currency.
  const lk = (await getMarket()) === "lk";
  return messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    senderRole: m.senderRole,
    senderName: m.sender.name ?? m.sender.email,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    taggedGemstone: m.taggedGemstone
      ? { name: m.taggedGemstone.name, slug: m.taggedGemstone.slug, price: lk ? m.taggedGemstone.lkrPrice : m.taggedGemstone.price, showPrice: m.taggedGemstone.showPrice, imageUrl: m.taggedGemstone.media[0]?.url }
      : null,
    taggedJewelry: m.taggedJewelry
      ? { name: m.taggedJewelry.name, slug: m.taggedJewelry.slug, price: lk ? m.taggedJewelry.lkrPrice : m.taggedJewelry.price, showPrice: m.taggedJewelry.showPrice, imageUrl: m.taggedJewelry.media[0]?.url }
      : null,
    taggedCartSnapshot: m.taggedCartSnapshot as { items: { label: string; amount: number }[]; total: number } | null,
    isVideoCallRequest: m.isVideoCallRequest,
  }));
}

export type ChatMessageView = Awaited<ReturnType<typeof pollChatMessages>>[number];

/** Lets an embedded ChatPanel (the floating bubble's inline chat, and the
 * admin messages inbox's split view — see FloatingChatButton and
 * AdminMessagesInbox) bootstrap its "tag the cart" option without a
 * server-rendered page fetching it up front the way every full detail
 * page already does. Same ownership rule as the rest of this file. */
export async function getHasOpenCartForRequest(requestType: ChatRequestType, requestId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;

  const context = await getChatContext(requestType, requestId);
  if (!context) return false;

  const isAdminSide = await isChatAdminSide(session.user, requestType, requestId);
  if (!isAdminSide && session.user.id !== context.customerId) return false;

  const cart = await prisma.cart.findFirst({ where: { userId: context.customerId, status: "OPEN" }, include: { items: true } });
  return !!cart && cart.items.length > 0;
}

export interface ConversationView {
  requestType: ChatRequestType;
  requestId: string;
  itemLabel: string;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

/** The floating chat bubble's polling endpoint (see FloatingChatButton) —
 * every one of the signed-in customer's own conversations, most recent
 * first, with a total unread count for the bubble's badge. Empty for a
 * signed-out visitor rather than an error, same convention as
 * pollNotifications.
 *
 * "Chat with Support" (the general thread) is always pinned first, even
 * with no messages yet — unlike a quote/sourcing conversation, which only
 * ever appears once an admin has replied and a thread exists, this one is
 * something the customer starts themselves, so there's always something
 * to click into. */
export async function pollMyConversations(): Promise<{ items: ConversationView[]; unreadCount: number; userId: string | null }> {
  const session = await auth();
  if (!session?.user) return { items: [], unreadCount: 0, userId: null };

  const [rows, general] = await Promise.all([getConversationsForCustomer(session.user.id), getGeneralThreadInfo(session.user.id)]);

  const items: ConversationView[] = [
    {
      requestType: "general",
      requestId: session.user.id,
      itemLabel: "Chat with Support",
      lastMessagePreview: general.lastMessagePreview,
      lastMessageAt: general.lastMessageAt?.toISOString() ?? null,
      unreadCount: general.unreadCount,
    },
    ...rows.map((r) => ({
      requestType: r.requestType,
      requestId: r.requestId,
      itemLabel: r.itemLabel,
      lastMessagePreview: r.lastMessagePreview,
      lastMessageAt: r.lastMessageAt.toISOString(),
      unreadCount: r.unreadCount,
    })),
  ];

  return { unreadCount: items.reduce((sum, i) => sum + i.unreadCount, 0), items, userId: session.user.id };
}

/** Either side can tag a catalog item, so this only requires being
 * signed in, not being an admin — the gemstone/jewelry pickers for the
 * composer need this same published-items list either way. */
export async function getChatTagOptions() {
  const session = await auth();
  if (!session?.user) return { gemstones: [], jewelry: [] };

  // An admin (who sits outside both storefronts) sees everything; a customer
  // can only tag items from the storefront they're on.
  const market = session.user.role === "ADMIN" ? undefined : await getMarket();
  const [gemstones, jewelry] = await Promise.all([
    prisma.gemstone.findMany({ where: { isPublished: true, ...(market ? { market } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.jewelryPiece.findMany({ where: { isPublished: true, ...(market ? { market } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { gemstones, jewelry };
}
