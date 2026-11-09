"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/lib/auth";
import { registerSchema } from "@/lib/validation/auth";
import { safeCallbackPath } from "@/lib/utils";
import { getMarket, withMarket } from "@/lib/market";
import { captureReferral, REF_COOKIE } from "@/lib/rewards";
import { captureBusinessInvite, BIZ_INVITE_COOKIE } from "@/lib/business";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// redirectTo: where the calling form should navigate next. Create actions
// return it instead of calling redirect(): redirect() works by throwing, and
// the admin forms call their action inside try/catch, so the throw was caught
// as a failure — "Something went wrong" shown for a save that had succeeded.
export type ActionResult = { ok: true; redirectTo?: string } | { ok: false; error: string };

export async function registerCustomer(formData: FormData): Promise<ActionResult> {
  // Bulk fake-account creation is otherwise cheap (bcrypt's ~100ms cost is
  // the only friction) — a per-IP cap, not per-email, since the point is
  // slowing down a scripted flood, not any one address in particular.
  const ip = await getClientIp();
  const ipLimit = await checkRateLimit(`register:${ip}`, { limit: 5, windowSeconds: 60 * 60 });
  if (!ipLimit.allowed) return { ok: false, error: "Too many accounts created recently — please try again later." };

  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone") ?? "",
    customerType: formData.get("customerType") || "RETAIL",
    businessName: formData.get("businessName") ?? "",
    businessRegNo: formData.get("businessRegNo") ?? "",
    dateOfBirth: formData.get("dateOfBirth") ?? "",
    agreedToTerms: formData.get("agreedToTerms"),
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, email, password, phone, customerType, businessName, businessRegNo, dateOfBirth } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with this email already exists. Try signing in instead." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const isWholesale = customerType === "WHOLESALE";

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      phone: phone || undefined,
      role: "CUSTOMER",
      customerType,
      // Retail accounts are active immediately (today's behavior,
      // unchanged) — a wholesale registration instead sits PENDING until
      // an admin reviews it (see actions/wholesale.ts). Approval gates
      // nothing else in the app: a pending account can browse, quote, and
      // buy retail exactly like any other customer in the meantime.
      wholesaleStatus: isWholesale ? "PENDING" : undefined,
      businessName: isWholesale ? businessName || undefined : undefined,
      businessRegNo: isWholesale ? businessRegNo || undefined : undefined,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      termsAcceptedAt: new Date(),
    },
  });

  // Best-effort — a missing/stale/garbled cookie should never block
  // account creation. See captureReferral/captureBusinessInvite's own
  // comments for why each is silent on any invalid value.
  const cookieStore = await cookies();
  const refCode = cookieStore.get(REF_COOKIE)?.value;
  if (refCode) await captureReferral(user.id, refCode);
  const bizInvite = cookieStore.get(BIZ_INVITE_COOKIE)?.value;
  if (bizInvite) await captureBusinessInvite(user.id, bizInvite);

  return { ok: true };
}

export async function authenticateWithCredentials(formData: FormData): Promise<ActionResult> {
  // Two independent limits, since credential attacks come in two shapes:
  // many guesses against one account (email-keyed catches this even from
  // a botnet spread across many IPs) and one source spraying guesses
  // across many accounts (IP-keyed catches this even against a fresh
  // email each time). Checked before touching NextAuth at all.
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const ip = await getClientIp();
  const [emailLimit, ipLimit] = await Promise.all([
    email ? checkRateLimit(`login-email:${email}`, { limit: 5, windowSeconds: 15 * 60 }) : Promise.resolve({ allowed: true, remaining: 0 }),
    checkRateLimit(`login-ip:${ip}`, { limit: 20, windowSeconds: 15 * 60 }),
  ]);
  if (!emailLimit.allowed || !ipLimit.allowed) {
    return { ok: false, error: "Too many sign-in attempts — please wait a few minutes and try again." };
  }

  // callbackUrl always comes from a URL query param (see login/register
  // page.tsx) — never trust it as-is. This redirect() call is Next's own,
  // not NextAuth's (redirect: false below opts out of NextAuth's built-in
  // same-origin redirect sanitization on purpose, since sign-in itself
  // reports success/failure back to the form instead of redirecting), so
  // nothing upstream is sanitizing this value unless it happens here.
  // withMarket: with no callback the fallback is "/account", which must
  // still land inside the visitor's own storefront (/lk/account on the
  // Sri Lanka store) — idempotent on an already-prefixed callback.
  const callbackUrl = withMarket(safeCallbackPath(formData.get("callbackUrl")), await getMarket());

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if ((error as { code?: string }).code === "account_disabled") {
        return { ok: false, error: "This account has been disabled. Please contact support." };
      }
      return { ok: false, error: "Incorrect email or password." };
    }
    throw error;
  }

  redirect(callbackUrl);
}

export async function signInWithGoogle(formData: FormData) {
  // NextAuth's own redirectTo already gets same-origin-checked by its
  // default redirect callback, but sanitizing here too means that
  // protection isn't the only thing standing between this value and a
  // redirect — consistent with authenticateWithCredentials above rather
  // than relying on two different code paths staying safe for two
  // different reasons.
  const callbackUrl = withMarket(safeCallbackPath(formData.get("callbackUrl")), await getMarket());
  await signIn("google", { redirectTo: callbackUrl });
}

export async function signOutAction() {
  await signOut({ redirectTo: withMarket("/", await getMarket()) });
}
