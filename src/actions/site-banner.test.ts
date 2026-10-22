import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { updateSiteBannerSettings, submitSiteFeedback } from "@/actions/site-banner";
import { checkRateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { getMarket } from "@/lib/market";

vi.mock("@/lib/rbac", () => ({ requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN" }) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(), getClientIp: vi.fn().mockResolvedValue("203.0.113.4") }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/market", () => ({ getMarket: vi.fn().mockResolvedValue("intl") }));

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 4 });
  vi.mocked(auth).mockResolvedValue(null as never);
  vi.mocked(getMarket).mockResolvedValue("intl");
  prismaMock.siteBannerSettings.findUnique.mockResolvedValue({
    id: "singleton", intlEnabled: false, intlMessage: null, lkEnabled: false, lkMessage: null, updatedAt: new Date(),
  } as never);
  prismaMock.siteBannerSettings.update.mockResolvedValue({} as never);
  prismaMock.siteFeedback.create.mockResolvedValue({} as never);
});

describe("updateSiteBannerSettings", () => {
  it("saves both markets' enabled flag and message", async () => {
    const result = await updateSiteBannerSettings(
      formData({ intlEnabled: "true", intlMessage: "We're updating payments.", lkEnabled: "false", lkMessage: "" }),
    );
    expect(result).toEqual({ ok: true });
    expect(prismaMock.siteBannerSettings.update).toHaveBeenCalledWith({
      where: { id: "singleton" },
      data: { intlEnabled: true, intlMessage: "We're updating payments.", lkEnabled: false, lkMessage: null },
    });
  });

  it("refuses to enable a market's banner with no message", async () => {
    const result = await updateSiteBannerSettings(formData({ intlEnabled: "true", intlMessage: "", lkEnabled: "false", lkMessage: "" }));
    expect(result.ok).toBe(false);
    expect(prismaMock.siteBannerSettings.update).not.toHaveBeenCalled();
  });
});

describe("submitSiteFeedback", () => {
  it("rejects an empty message without touching the database", async () => {
    const result = await submitSiteFeedback(formData({ message: "" }));
    expect(result.ok).toBe(false);
    expect(prismaMock.siteFeedback.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    const result = await submitSiteFeedback(formData({ message: "Great store!", email: "not-an-email" }));
    expect(result.ok).toBe(false);
    expect(prismaMock.siteFeedback.create).not.toHaveBeenCalled();
  });

  it("refuses once the per-IP limit is exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0 });
    const result = await submitSiteFeedback(formData({ message: "Great store!" }));
    expect(result.ok).toBe(false);
    expect(prismaMock.siteFeedback.create).not.toHaveBeenCalled();
  });

  it("records a signed-out visitor's feedback with no userId", async () => {
    const result = await submitSiteFeedback(formData({ message: "Great store!", email: "jane@example.com" }));
    expect(result).toEqual({ ok: true });
    expect(prismaMock.siteFeedback.create).toHaveBeenCalledWith({
      data: { market: "intl", message: "Great store!", email: "jane@example.com", userId: null },
    });
  });

  it("attaches the signed-in user's id when there is a session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    const result = await submitSiteFeedback(formData({ message: "Great store!" }));
    expect(result).toEqual({ ok: true });
    expect(prismaMock.siteFeedback.create).toHaveBeenCalledWith({
      data: { market: "intl", message: "Great store!", email: null, userId: "user-1" },
    });
  });
});
