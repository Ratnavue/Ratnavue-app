import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function MockResend() {
    return { emails: { send: sendMock } };
  }),
}));

describe("sendEmail", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    sendMock.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("no-ops without throwing when RESEND_API_KEY isn't configured", async () => {
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_FROM = "Ratnavue <no-reply@example.com>";
    const { sendEmail } = await import("@/lib/email");

    const result = await sendEmail({ to: "customer@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi" });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/configured/i) });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("no-ops without throwing when EMAIL_FROM isn't configured", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    delete process.env.EMAIL_FROM;
    const { sendEmail } = await import("@/lib/email");

    const result = await sendEmail({ to: "customer@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi" });

    expect(result.ok).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends through Resend and reports success when both are configured", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "Ratnavue <no-reply@example.com>";
    sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });
    const { sendEmail } = await import("@/lib/email");

    const result = await sendEmail({ to: "customer@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi" });

    expect(result).toEqual({ ok: true });
    expect(sendMock).toHaveBeenCalledWith({
      from: "Ratnavue <no-reply@example.com>",
      to: "customer@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
    });
  });

  it("forwards replyTo through to Resend when given", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "Ratnavue <no-reply@example.com>";
    sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });
    const { sendEmail } = await import("@/lib/email");

    await sendEmail({ to: "customer@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi", replyTo: "support@ratnavue.com" });

    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ replyTo: "support@ratnavue.com" }));
  });

  it("reports failure when Resend's API itself returns an error", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "Ratnavue <no-reply@example.com>";
    sendMock.mockResolvedValue({ data: null, error: { message: "Domain not verified" } });
    const { sendEmail } = await import("@/lib/email");

    const result = await sendEmail({ to: "customer@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi" });

    expect(result).toEqual({ ok: false, error: "Domain not verified" });
  });

  it("catches a thrown exception (e.g. a network failure) rather than propagating it", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "Ratnavue <no-reply@example.com>";
    sendMock.mockRejectedValue(new Error("fetch failed"));
    const { sendEmail } = await import("@/lib/email");

    const result = await sendEmail({ to: "customer@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi" });

    expect(result).toEqual({ ok: false, error: "fetch failed" });
  });
});
