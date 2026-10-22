import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { sendChatMessage, markChatRead } from "@/actions/chat";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn() }));
vi.mock("@/lib/chat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chat")>();
  return {
    ...actual,
    getChatContext: vi.fn(),
    getOrCreateChatThread: vi.fn(),
    snapshotOpenCart: vi.fn(),
  };
});

import { auth } from "@/lib/auth";
import { getChatContext, getOrCreateChatThread } from "@/lib/chat";

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue({ user: { id: "customer-1", role: "CUSTOMER" } } as never);
  vi.mocked(getChatContext).mockResolvedValue({ threadId: "thread-1", customerId: "customer-1" } as never);
  vi.mocked(getOrCreateChatThread).mockResolvedValue("thread-1");
  prismaMock.chatMessage.create.mockResolvedValue({} as never);
});

describe("sendChatMessage — video call request tag", () => {
  it("stamps isVideoCallRequest on the created message when tagged", async () => {
    const result = await sendChatMessage({ requestType: "quote", requestId: "quote-1", body: "", tag: { type: "videoCallRequest" } });
    expect(result).toEqual({ ok: true });
    expect(prismaMock.chatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isVideoCallRequest: true }),
    });
  });

  it("leaves isVideoCallRequest false for a plain text message", async () => {
    await sendChatMessage({ requestType: "quote", requestId: "quote-1", body: "Hello" });
    expect(prismaMock.chatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isVideoCallRequest: false }),
    });
  });

  it("allows sending the video-call tag with no body text, same as the cart tag", async () => {
    const result = await sendChatMessage({ requestType: "sourcing", requestId: "sourcing-1", body: "", tag: { type: "videoCallRequest" } });
    expect(result).toEqual({ ok: true });
  });
});

describe("sendChatMessage — STAFF market scoping", () => {
  beforeEach(() => {
    // A different customer than the staff member sending — makes sure a
    // pass here is really coming from the admin-side branch, not the
    // "you own this request" one.
    vi.mocked(getChatContext).mockResolvedValue({ threadId: "thread-1", customerId: "some-customer" } as never);
  });

  it("lets a STAFF member message an order within their own market scope", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "staff-1", role: "STAFF", staffMarketScope: "intl", staffPermissions: ["orders"] } } as never);
    prismaMock.order.findUnique.mockResolvedValue({ market: "intl" } as never);

    const result = await sendChatMessage({ requestType: "order", requestId: "order-1", body: "On its way!" });

    expect(result).toEqual({ ok: true });
    expect(prismaMock.chatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ senderId: "staff-1", senderRole: "STAFF" }),
    });
  });

  it("lets a STAFF member scoped to 'both' message any market's order", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "staff-1", role: "STAFF", staffMarketScope: "both", staffPermissions: ["orders"] } } as never);
    prismaMock.order.findUnique.mockResolvedValue({ market: "lk" } as never);

    const result = await sendChatMessage({ requestType: "order", requestId: "order-1", body: "On its way!" });

    expect(result).toEqual({ ok: true });
  });

  it("refuses a STAFF member messaging an order outside their scope", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "staff-1", role: "STAFF", staffMarketScope: "intl", staffPermissions: ["orders"] } } as never);
    prismaMock.order.findUnique.mockResolvedValue({ market: "lk" } as never);

    const result = await sendChatMessage({ requestType: "order", requestId: "order-1", body: "On its way!" });

    expect(result).toEqual({ ok: false, error: "Request not found." });
    expect(prismaMock.chatMessage.create).not.toHaveBeenCalled();
  });

  it("refuses a STAFF member without the orders area, even inside their market", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "staff-1", role: "STAFF", staffMarketScope: "both", staffPermissions: ["catalog"] } } as never);
    prismaMock.order.findUnique.mockResolvedValue({ market: "intl" } as never);

    const result = await sendChatMessage({ requestType: "order", requestId: "order-1", body: "Hi" });

    expect(result).toEqual({ ok: false, error: "Request not found." });
    expect(prismaMock.chatMessage.create).not.toHaveBeenCalled();
  });

  it("lets a STAFF member with the requests area reply on a quote thread", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "staff-1", role: "STAFF", staffMarketScope: "intl", staffPermissions: ["requests"] } } as never);

    const result = await sendChatMessage({ requestType: "quote", requestId: "quote-1", body: "Hello" });

    expect(result).toEqual({ ok: true });
    expect(prismaMock.chatMessage.create).toHaveBeenCalledWith({ data: expect.objectContaining({ senderId: "staff-1", senderRole: "STAFF" }) });
  });

  it("refuses a STAFF member with only the orders area on a quote thread", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "staff-1", role: "STAFF", staffMarketScope: "both", staffPermissions: ["orders"] } } as never);

    const result = await sendChatMessage({ requestType: "quote", requestId: "quote-1", body: "Hello" });

    expect(result).toEqual({ ok: false, error: "Request not found." });
    expect(prismaMock.order.findUnique).not.toHaveBeenCalled();
  });

  it("sends the customer a CHAT_REPLY notification the same as an admin reply would", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "staff-1", role: "STAFF", staffMarketScope: "both", staffPermissions: ["orders"] } } as never);
    prismaMock.order.findUnique.mockResolvedValue({ market: "intl" } as never);
    const { createNotification } = await import("@/lib/notifications");

    await sendChatMessage({ requestType: "order", requestId: "order-1", body: "On its way!" });

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "some-customer", type: "CHAT_REPLY", requestType: "order", requestId: "order-1" }),
    );
  });
});

// Regression coverage for a real bug: a "general" thread's requestId IS
// the customer's own userId (see getChatContext), so an ADMIN/STAFF
// account viewing *their own* /account/messages support thread must
// still be treated as the customer side of that conversation, never the
// admin side — otherwise their own read receipts and messages land on
// the wrong side of the thread and their own unread count can never
// clear.
describe("isChatAdminSide — an admin/staff account's own general support thread", () => {
  it("markChatRead writes lastReadByCustomerAt, not lastReadByAdminAt, for an ADMIN reading their own general thread", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as never);
    vi.mocked(getChatContext).mockResolvedValue({ threadId: "thread-1", customerId: "admin-1" } as never);
    prismaMock.chatThread.update.mockResolvedValue({} as never);

    const result = await markChatRead("general", "admin-1");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.chatThread.update).toHaveBeenCalledWith({ where: { id: "thread-1" }, data: { lastReadByCustomerAt: expect.any(Date) } });
  });

  it("markChatRead still writes lastReadByAdminAt when an ADMIN reads someone else's general thread (/admin/support/<other user>)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as never);
    vi.mocked(getChatContext).mockResolvedValue({ threadId: "thread-2", customerId: "some-customer" } as never);
    prismaMock.chatThread.update.mockResolvedValue({} as never);

    const result = await markChatRead("general", "some-customer");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.chatThread.update).toHaveBeenCalledWith({ where: { id: "thread-2" }, data: { lastReadByAdminAt: expect.any(Date) } });
  });

  it("sendChatMessage tags an ADMIN's own message in their own general thread senderRole CUSTOMER, not ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as never);
    vi.mocked(getChatContext).mockResolvedValue({ threadId: "thread-1", customerId: "admin-1" } as never);

    await sendChatMessage({ requestType: "general", requestId: "admin-1", body: "Hi, I have a question about my own order" });

    expect(prismaMock.chatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ senderId: "admin-1", senderRole: "CUSTOMER" }),
    });
  });

  it("sendChatMessage still tags an ADMIN replying on someone else's general thread senderRole ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as never);
    vi.mocked(getChatContext).mockResolvedValue({ threadId: "thread-2", customerId: "some-customer" } as never);

    await sendChatMessage({ requestType: "general", requestId: "some-customer", body: "How can we help?" });

    expect(prismaMock.chatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ senderId: "admin-1", senderRole: "ADMIN" }),
    });
  });

  it("a STAFF member with the requests area gets the same own-thread-is-customer-side treatment", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "staff-1", role: "STAFF", staffMarketScope: "both", staffPermissions: ["requests"] } } as never);
    vi.mocked(getChatContext).mockResolvedValue({ threadId: "thread-3", customerId: "staff-1" } as never);
    prismaMock.chatThread.update.mockResolvedValue({} as never);

    const result = await markChatRead("general", "staff-1");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.chatThread.update).toHaveBeenCalledWith({ where: { id: "thread-3" }, data: { lastReadByCustomerAt: expect.any(Date) } });
  });

  it("does not apply the own-thread exception to a quote/sourcing/order thread (requestId is never a userId there)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as never);
    vi.mocked(getChatContext).mockResolvedValue({ threadId: "thread-4", customerId: "some-customer" } as never);
    prismaMock.chatThread.update.mockResolvedValue({} as never);

    const result = await markChatRead("quote", "admin-1"); // a coincidental id match, wrong requestType

    expect(result).toEqual({ ok: true });
    expect(prismaMock.chatThread.update).toHaveBeenCalledWith({ where: { id: "thread-4" }, data: { lastReadByAdminAt: expect.any(Date) } });
  });
});
