import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { requestPasswordReset, resetPassword } from "@/actions/password-reset";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { verifyPasswordResetToken, consumePasswordResetToken } from "@/lib/password-reset";

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(), getClientIp: vi.fn().mockResolvedValue("203.0.113.4") }));
vi.mock("@/lib/market", () => ({ getMarket: vi.fn().mockResolvedValue("intl"), withMarket: (path: string) => path }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(), SUPPORT_EMAIL: "support@ratnavue.com", SALES_EMAIL: "sales@ratnavue.com" }));
vi.mock("@/lib/password-reset", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/password-reset")>();
  return { ...actual, verifyPasswordResetToken: vi.fn(), consumePasswordResetToken: vi.fn() };
});

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("requestPasswordReset", () => {
  it("rejects an invalid email without touching the database", async () => {
    const result = await requestPasswordReset(formData({ email: "not-an-email" }));
    expect(result.ok).toBe(false);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("refuses once the per-email or per-IP limit is exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0 });
    const result = await requestPasswordReset(formData({ email: "jane@example.com" }));
    expect(result).toEqual({ ok: false, error: "Too many attempts — please wait a while and try again." });
  });

  it("returns { ok: true } for a real account and sends the reset email", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 2 });
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1", email: "jane@example.com" } as never);
    prismaMock.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.passwordResetToken.create.mockResolvedValue({} as never);
    vi.mocked(sendEmail).mockResolvedValue({ ok: true });

    const result = await requestPasswordReset(formData({ email: "jane@example.com" }));

    expect(result).toEqual({ ok: true });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "jane@example.com" }));
  });

  it("returns exactly the same { ok: true } for an email with no matching account — never reveals account existence", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 2 });
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await requestPasswordReset(formData({ email: "nobody@example.com" }));

    expect(result).toEqual({ ok: true });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("still returns { ok: true } even if the email fails to send (logged, not surfaced)", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 2 });
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1", email: "jane@example.com" } as never);
    prismaMock.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.passwordResetToken.create.mockResolvedValue({} as never);
    vi.mocked(sendEmail).mockResolvedValue({ ok: false, error: "not configured" });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await requestPasswordReset(formData({ email: "jane@example.com" }));

    expect(result).toEqual({ ok: true });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("resetPassword", () => {
  it("rejects a password under 8 characters", async () => {
    const result = await resetPassword(formData({ token: "abc", password: "short" }));
    expect(result.ok).toBe(false);
  });

  it("refuses once the per-IP limit is exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0 });
    const result = await resetPassword(formData({ token: "abc", password: "longenoughpassword" }));
    expect(result).toEqual({ ok: false, error: "Too many attempts — please wait a while and try again." });
  });

  it("rejects an invalid or expired token", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 5 });
    vi.mocked(verifyPasswordResetToken).mockResolvedValue(null);

    const result = await resetPassword(formData({ token: "bad-token", password: "longenoughpassword" }));

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: expect.stringMatching(/invalid or has expired/i) });
  });

  it("rejects a token that's already been consumed by a concurrent request", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 5 });
    vi.mocked(verifyPasswordResetToken).mockResolvedValue({ id: "token-1", userId: "user-1" });
    vi.mocked(consumePasswordResetToken).mockResolvedValue(false);

    const result = await resetPassword(formData({ token: "good-token", password: "longenoughpassword" }));

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: expect.stringMatching(/already been used/i) });
  });

  it("succeeds for a valid token, consuming it with a freshly hashed password", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 5 });
    vi.mocked(verifyPasswordResetToken).mockResolvedValue({ id: "token-1", userId: "user-1" });
    vi.mocked(consumePasswordResetToken).mockResolvedValue(true);

    const result = await resetPassword(formData({ token: "good-token", password: "longenoughpassword" }));

    expect(result).toEqual({ ok: true });
    expect(consumePasswordResetToken).toHaveBeenCalledWith("token-1", "user-1", expect.any(String));
    const passwordHash = vi.mocked(consumePasswordResetToken).mock.calls[0][2];
    expect(passwordHash).not.toBe("longenoughpassword"); // never stores the plaintext
  });
});
