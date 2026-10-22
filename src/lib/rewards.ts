import { randomBytes } from "crypto";
import type { CommerceSettings, LoyaltySettings, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLoyaltySettings } from "@/lib/loyalty-settings";

type Tx = Prisma.TransactionClient | PrismaClient;

// The referral-capture cookie set by /r/[code] (src/app/r/[code]/route.ts)
// and read back by both sign-up paths — colocated here (not in the route
// file, which Next.js's route-handler convention restricts to exporting
// only HTTP method handlers) so it's one shared constant either side can
// import.
export const REF_COOKIE = "ref_code";

// Same alphabet/shape as discount-codes.ts's CODE_ALPHABET (no 0/O/1/I —
// easy to misread aloud or by hand) — referral codes are shared out loud
// and by link just as often as a discount code is typed in.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 7): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

/** Mints a fresh, guaranteed-unique referral code for a user who doesn't
 * have one yet — called lazily the first time they open /account/rewards
 * or /account/business, not at registration (most users never engage). */
export async function ensureReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
  if (user.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    try {
      const updated = await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return updated.referralCode!;
    } catch {
      // Unique constraint collision — astronomically unlikely at this
      // alphabet/length, but retried rather than assumed away.
    }
  }
  throw new Error("Could not generate a referral code — try again.");
}

/** Converts a currency amount into whole points at the current rate — the
 * Sri Lanka store uses its own native LKR rate (LoyaltySettings.
 * pointsPerCurrencyUnitLkr), not a USD-equivalent converted through
 * CommerceSettings.usdToLkrRate, so a customer's earn rate never
 * silently drifts when that exchange rate is updated. */
export async function pointsForAmount(amount: number, currency: "USD" | "LKR"): Promise<number> {
  const loyalty = await getLoyaltySettings();
  if (!loyalty.pointsEnabled) return 0;
  const rate = currency === "LKR" ? loyalty.pointsPerCurrencyUnitLkr : loyalty.pointsPerCurrencyUnit;
  return Math.floor(amount * rate);
}

/** The currency value redeeming `points` is worth, in the order's own
 * currency — same native-rate reasoning as pointsForAmount above. */
export async function pointsValue(points: number, currency: "USD" | "LKR"): Promise<number> {
  const loyalty = await getLoyaltySettings();
  const rate = currency === "LKR" ? loyalty.pointsRedemptionValueLkr : loyalty.pointsRedemptionValue;
  return points * rate;
}

/** The single place "how many of the requested points can actually be
 * redeemed, and what are they worth" is decided — used by
 * buildCheckoutBreakdown so the cart's staged pointsToRedeem is always
 * clamped against the live balance and the order's own cap, never trusted
 * as-is. Below minRedeemPoints redeems nothing at all (an all-or-partial
 * request that rounds under the floor isn't worth a partial discount). */
export async function resolvePointsRedemption(input: {
  requestedPoints: number;
  availableBalance: number;
  orderableAmount: number;
  currency: "USD" | "LKR";
}): Promise<{ points: number; discount: number }> {
  if (input.requestedPoints <= 0) return { points: 0, discount: 0 };

  const loyalty = await getLoyaltySettings();
  if (!loyalty.pointsEnabled) return { points: 0, discount: 0 };
  const redemptionValue = input.currency === "LKR" ? loyalty.pointsRedemptionValueLkr : loyalty.pointsRedemptionValue;
  const capAmount = input.orderableAmount * (loyalty.maxRedeemPercentOfOrder / 100);
  const capPoints = Math.floor(capAmount / redemptionValue);

  let points = Math.min(input.requestedPoints, input.availableBalance, capPoints);
  if (points < loyalty.minRedeemPoints) points = 0;
  if (points <= 0) return { points: 0, discount: 0 };

  return { points, discount: await pointsValue(points, input.currency) };
}

/** Writes one signed PointsTransaction and keeps User.pointsBalance in
 * sync with it — a single nested-write query (not a create then a
 * separate update) so it's one round trip, not two, since every extra
 * round trip is extra time this app's remote-pooler connection sits
 * open mid-transaction. */
export async function recordPointsTransaction(
  tx: Tx,
  input: { userId: string; amount: number; reason: "EARNED_PURCHASE" | "REDEEMED_CHECKOUT" | "REFERRAL_BONUS_REFERRER" | "REFERRAL_BONUS_REFEREE" | "ADMIN_ADJUSTMENT" | "GEM_DIG_BONUS"; orderId?: string },
): Promise<void> {
  await tx.user.update({
    where: { id: input.userId },
    data: {
      pointsBalance: { increment: input.amount },
      pointsTransactions: { create: { amount: input.amount, reason: input.reason, orderId: input.orderId } },
    },
  });
}

/** Called once, at the exact moment an order actually completes
 * (finalizePaidOrder) — same "preview only, finalize is what actually
 * redeems" split discount codes use. Hard-rechecks the live balance
 * (never trusts the order's snapshotted pointsRedeemed as still
 * affordable) and claims it via a conditional updateMany so two orders
 * racing to spend the same points can't both succeed. Best-effort: if the
 * balance has moved since checkout (spent elsewhere, or another pending
 * order got there first), the redemption just silently isn't honored —
 * same accepted risk as finalizeDiscountRedemption, logged rather than
 * blocking an already-taken payment.
 *
 * Earning happens unconditionally alongside it, on the order's own
 * subtotal — every paid order earns, whether or not it also redeemed.
 *
 * Takes the settings pre-fetched (not read internally) — this runs inside
 * finalizePaidOrder's interactive transaction, and every extra query in
 * there is extra time the DB connection is held open; reading settings
 * before the transaction starts keeps it to just the writes it needs. */
export async function settlePointsForPaidOrder(
  tx: Tx,
  order: { id: string; userId: string; currency: string; subtotal: number; pointsRedeemed: number },
  settings: { loyalty: LoyaltySettings; commerce: CommerceSettings },
): Promise<void> {
  const earnRate = order.currency === "LKR" ? settings.loyalty.pointsPerCurrencyUnitLkr : settings.loyalty.pointsPerCurrencyUnit;
  const earned = settings.loyalty.pointsEnabled ? Math.floor(order.subtotal * earnRate) : 0;
  if (earned > 0) {
    await recordPointsTransaction(tx, { userId: order.userId, amount: earned, reason: "EARNED_PURCHASE", orderId: order.id });
  }

  if (order.pointsRedeemed > 0) {
    const claim = await tx.user.updateMany({
      where: { id: order.userId, pointsBalance: { gte: order.pointsRedeemed } },
      data: { pointsBalance: { decrement: order.pointsRedeemed } },
    });
    if (claim.count > 0) {
      await tx.pointsTransaction.create({
        data: { userId: order.userId, amount: -order.pointsRedeemed, reason: "REDEEMED_CHECKOUT", orderId: order.id },
      });
    } else {
      console.warn(`Order ${order.id}: ${order.pointsRedeemed} redeemed points could not be honored — balance moved since checkout.`);
    }
  }
}

/** Stamps a new user's referredByCode and opens a PENDING Referral, if the
 * code is valid and isn't a self-referral. Shared by both signup paths —
 * registerCustomer (email/password) and the events.createUser hook in
 * lib/auth.ts (Google). Silent no-op on any invalid code: a stale/garbled
 * cookie should never block account creation. */
export async function captureReferral(newUserId: string, rawCode: string): Promise<void> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return;
  const loyalty = await getLoyaltySettings();
  if (!loyalty.referralsEnabled) return;

  const referrer = await prisma.user.findUnique({ where: { referralCode: code } });
  if (!referrer || referrer.id === newUserId) return;

  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: newUserId }, data: { referredByCode: code } }),
      prisma.referral.create({ data: { referrerId: referrer.id, refereeId: newUserId, code } }),
    ]);
  } catch {
    // Referral.refereeId is unique — a retry or a race that already wrote
    // one for this user is a silent no-op, not an error worth surfacing.
  }
}

export interface SettledReferral {
  referralId: string;
  referrerId: string;
  refereeId: string;
  referrerBonus: number;
  refereeBonus: number;
}

/** Called from finalizePaidOrder for every order that reaches PAID —
 * checks whether this order is the referee's first paid order and
 * whether it clears the qualifying minimum; if so, pays both sides their
 * bonus and returns who to notify (notifying is the caller's job, done
 * after the transaction commits — see the settings-prefetch comment on
 * settlePointsForPaidOrder for why nothing extra runs inside it). A no-op
 * (returns null) for the vast majority of orders — no PENDING referral
 * exists for the user at all — so this is cheap to call unconditionally. */
export async function settleReferralForPaidOrder(
  tx: Tx,
  order: { id: string; userId: string; currency: string; subtotal: number },
  settings: { loyalty: LoyaltySettings; commerce: CommerceSettings },
): Promise<SettledReferral | null> {
  if (!settings.loyalty.referralsEnabled) return null;
  const referral = await tx.referral.findUnique({ where: { refereeId: order.userId } });
  if (!referral || referral.status !== "PENDING") return null;

  const priorPaidOrders = await tx.order.count({ where: { userId: order.userId, status: "PAID", id: { not: order.id } } });
  if (priorPaidOrders > 0) return null; // only a first order can qualify a referral

  const usdSubtotal = order.currency === "LKR" ? order.subtotal / settings.commerce.usdToLkrRate : order.subtotal;
  if (usdSubtotal < settings.loyalty.referralMinOrderValue) return null;

  await tx.referral.update({ where: { id: referral.id }, data: { status: "REWARDED", qualifyingOrderId: order.id, qualifiedAt: new Date() } });
  await recordPointsTransaction(tx, { userId: referral.referrerId, amount: settings.loyalty.referralReferrerBonusPoints, reason: "REFERRAL_BONUS_REFERRER", orderId: order.id });
  await recordPointsTransaction(tx, { userId: referral.refereeId, amount: settings.loyalty.referralRefereeBonusPoints, reason: "REFERRAL_BONUS_REFEREE", orderId: order.id });

  return {
    referralId: referral.id,
    referrerId: referral.referrerId,
    refereeId: referral.refereeId,
    referrerBonus: settings.loyalty.referralReferrerBonusPoints,
    refereeBonus: settings.loyalty.referralRefereeBonusPoints,
  };
}
