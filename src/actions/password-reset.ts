"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getMarket, withMarket } from "@/lib/market";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createPasswordResetToken, verifyPasswordResetToken, consumePasswordResetToken, RESET_TOKEN_TTL_MINUTES } from "@/lib/password-reset";
import { requestPasswordResetSchema, resetPasswordSchema } from "@/lib/validation/auth";
import { sendEmail, SUPPORT_EMAIL } from "@/lib/email";
import { passwordResetEmail } from "@/lib/email-templates";
import type { ActionResult } from "./auth";

/**
 * Always returns { ok: true } for any syntactically valid email, whether
 * or not it belongs to an account — the alternative (revealing "no
 * account with that email") is a classic user-enumeration leak. The
 * client always renders the same generic "check your email" copy
 * regardless (see ForgotPasswordForm), not something read off the result.
 */
export async function requestPasswordReset(formData: FormData): Promise<ActionResult> {
  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  const email = parsed.data.email.toLowerCase();

  // Two independent limits, same shape as authenticateWithCredentials':
  // email-keyed stops someone spamming reset emails at one target account,
  // IP-keyed stops one source enumerating many addresses. Checked before
  // the user lookup, so the rate-limit response itself never depends on
  // whether the account exists.
  const ip = await getClientIp();
  const [emailLimit, ipLimit] = await Promise.all([
    checkRateLimit(`reset-request-email:${email}`, { limit: 3, windowSeconds: 60 * 60 }),
    checkRateLimit(`reset-request-ip:${ip}`, { limit: 10, windowSeconds: 60 * 60 }),
  ]);
  if (!emailLimit.allowed || !ipLimit.allowed) {
    return { ok: false, error: "Too many attempts — please wait a while and try again." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const { rawToken } = await createPasswordResetToken(user.id);
    const market = await getMarket();
    const resetUrl = `${process.env.AUTH_URL ?? "http://localhost:3000"}${withMarket(`/account/reset-password?token=${rawToken}`, market)}`;
    const { subject, html, text } = passwordResetEmail({ resetUrl, expiresInMinutes: RESET_TOKEN_TTL_MINUTES });

    const result = await sendEmail({ to: user.email, subject, html, text, replyTo: SUPPORT_EMAIL });
    if (!result.ok) {
      // Best-effort, like every other email send in this app — but a
      // reset request has nothing else to fall back on, so at minimum log
      // the link server-side. Doubles as a local-dev convenience (no
      // RESEND_API_KEY configured yet) and a clear signal in prod logs
      // that email delivery needs attention.
      console.warn(`Password reset email not sent for ${user.email}: ${result.error}. Reset URL: ${resetUrl}`);
    }
  }

  return { ok: true };
}

export async function resetPassword(formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({ token: formData.get("token"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const ip = await getClientIp();
  const limit = await checkRateLimit(`reset-confirm-ip:${ip}`, { limit: 10, windowSeconds: 60 * 60 });
  if (!limit.allowed) return { ok: false, error: "Too many attempts — please wait a while and try again." };

  const verified = await verifyPasswordResetToken(parsed.data.token);
  if (!verified) return { ok: false, error: "This reset link is invalid or has expired — please request a new one." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const consumed = await consumePasswordResetToken(verified.id, verified.userId, passwordHash);
  if (!consumed) return { ok: false, error: "This reset link has already been used — please request a new one." };

  return { ok: true };
}
