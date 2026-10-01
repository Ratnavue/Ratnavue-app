import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { saveDesign, submitDesignStudioRequest } from "@/actions/design-studio";
import { requireUser, hasStaffArea } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { emptyStudioState } from "@/lib/design-studio/types";

vi.mock("@/lib/rbac", () => ({ requireUser: vi.fn(), hasStaffArea: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));

const CUSTOMER = { id: "user-1", role: "CUSTOMER" };
const ADMIN = { id: "admin-1", role: "ADMIN" };

describe("saveDesign", () => {
  beforeEach(() => {
    vi.mocked(hasStaffArea).mockReturnValue(false);
  });

  it("creates a new design tagged CUSTOMER for a signed-in customer", async () => {
    vi.mocked(requireUser).mockResolvedValue(CUSTOMER as never);
    prismaMock.jewelryDesign.create.mockResolvedValue({ id: "design-1" } as never);

    const result = await saveDesign(null, "My Ring", emptyStudioState());

    expect(result).toEqual({ ok: true, id: "design-1" });
    expect(prismaMock.jewelryDesign.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", source: "CUSTOMER" }) }),
    );
  });

  it("tags a new design ADMIN when the saver has the requests area", async () => {
    vi.mocked(requireUser).mockResolvedValue(ADMIN as never);
    vi.mocked(hasStaffArea).mockReturnValue(true);
    prismaMock.jewelryDesign.create.mockResolvedValue({ id: "design-2" } as never);

    await saveDesign(null, "Sketch", emptyStudioState());

    expect(prismaMock.jewelryDesign.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ source: "ADMIN" }) }));
  });

  it("updates an existing design the customer owns", async () => {
    vi.mocked(requireUser).mockResolvedValue(CUSTOMER as never);
    prismaMock.jewelryDesign.findUnique.mockResolvedValue({ userId: "user-1" } as never);
    prismaMock.jewelryDesign.update.mockResolvedValue({} as never);

    const result = await saveDesign("design-1", "Renamed", emptyStudioState());

    expect(result).toEqual({ ok: true, id: "design-1" });
    expect(prismaMock.jewelryDesign.update).toHaveBeenCalledTimes(1);
  });

  it("refuses to update a design owned by someone else", async () => {
    vi.mocked(requireUser).mockResolvedValue(CUSTOMER as never);
    prismaMock.jewelryDesign.findUnique.mockResolvedValue({ userId: "someone-else" } as never);

    const result = await saveDesign("design-1", "Renamed", emptyStudioState());

    expect(result).toEqual({ ok: false, error: "Please sign in to save a design." });
    expect(prismaMock.jewelryDesign.update).not.toHaveBeenCalled();
  });

  it("lets staff with the requests area edit any customer's design", async () => {
    vi.mocked(requireUser).mockResolvedValue(ADMIN as never);
    vi.mocked(hasStaffArea).mockReturnValue(true);
    prismaMock.jewelryDesign.findUnique.mockResolvedValue({ userId: "someone-else" } as never);
    prismaMock.jewelryDesign.update.mockResolvedValue({} as never);

    const result = await saveDesign("design-1", "Renamed", emptyStudioState());

    expect(result).toEqual({ ok: true, id: "design-1" });
  });

  it("surfaces a sign-in prompt when there's no session", async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error("UNAUTHENTICATED"));

    const result = await saveDesign(null, "My Ring", emptyStudioState());

    expect(result).toEqual({ ok: false, error: "Please sign in to save a design." });
  });
});

describe("submitDesignStudioRequest", () => {
  beforeEach(() => {
    vi.mocked(requireUser).mockResolvedValue(CUSTOMER as never);
  });

  it("refuses once the per-user submission limit is exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0 });

    const result = await submitDesignStudioRequest("design-1", "A sapphire halo ring");

    expect(result).toEqual({ ok: false, error: "You've submitted a lot of requests recently — please wait a while before submitting another." });
    expect(prismaMock.quoteRequest.create).not.toHaveBeenCalled();
  });

  it("refuses a design that hasn't been saved with a thumbnail yet", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 9 });
    prismaMock.jewelryDesign.findUnique.mockResolvedValue({ id: "design-1", userId: "user-1", thumbnailUrl: null, quoteRequestId: null } as never);

    const result = await submitDesignStudioRequest("design-1", "A sapphire halo ring");

    expect(result).toEqual({ ok: false, error: "Save the sketch before submitting it." });
    expect(prismaMock.quoteRequest.create).not.toHaveBeenCalled();
  });

  it("refuses a design that was already submitted", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 9 });
    prismaMock.jewelryDesign.findUnique.mockResolvedValue({ id: "design-1", userId: "user-1", thumbnailUrl: "/media/x.png", quoteRequestId: "quote-already" } as never);

    const result = await submitDesignStudioRequest("design-1", "A sapphire halo ring");

    expect(result).toEqual({ ok: false, error: "This design was already submitted." });
  });

  it("creates the quote request and links it back onto the design", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 9 });
    prismaMock.jewelryDesign.findUnique.mockResolvedValue({ id: "design-1", userId: "user-1", thumbnailUrl: "/media/x.png", quoteRequestId: null } as never);
    prismaMock.quoteRequest.create.mockResolvedValue({ id: "quote-1" } as never);
    prismaMock.jewelryDesign.update.mockResolvedValue({} as never);

    const result = await submitDesignStudioRequest("design-1", "A sapphire halo ring, oxidized silver");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.quoteRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", productType: "CUSTOM", referenceImages: ["/media/x.png"] }) }),
    );
    expect(prismaMock.jewelryDesign.update).toHaveBeenCalledWith({ where: { id: "design-1" }, data: { quoteRequestId: "quote-1" } });
  });

  it("rejects a description that's too short", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 9 });

    const result = await submitDesignStudioRequest("design-1", "too short");

    expect(result).toEqual({ ok: false, error: "Tell us a bit more about what you'd like made." });
    expect(prismaMock.jewelryDesign.findUnique).not.toHaveBeenCalled();
  });
});
