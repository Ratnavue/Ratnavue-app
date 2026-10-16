import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export { SALES_REF_COOKIE, SALES_REF_COOKIE_MAX_AGE_SECONDS } from "@/lib/sales-referrals-shared";

const PAYOUT_ELIGIBLE_AFTER_DAYS = 30;

export async function getActivePromoterIdByToken(token: string): Promise<string | null> {
  const promoter = await prisma.salesReferralPromoter.findUnique({ where: { token }, select: { id: true, active: true } });
  return promoter?.active ? promoter.id : null;
}

interface CommissionOrderItem {
  quantity: number;
  lineTotal: number;
  gemstone: { costPrice: number | null } | null;
  jewelry: { costPrice: number | null } | null;
  jewelryVariant: { costPrice: number | null } | null;
}

// Same per-item cost fallback chain (variant override, else the piece's
// own costPrice) as gem-dig.ts's orderProfit — an item with no recorded
// cost contributes $0 cost here too, never a free pass to inflate the
// promoter's commission.
function totalItemCost(items: CommissionOrderItem[]): number {
  let cost = 0;
  for (const item of items) {
    const unitCost = item.jewelryVariant?.costPrice ?? item.gemstone?.costPrice ?? item.jewelry?.costPrice ?? null;
    if (unitCost != null) cost += unitCost * item.quantity;
  }
  return cost;
}

/** profit = total - item cost - the order's own real VAT - the order's
 * own real handling fee (never a fixed/guessed rate), floored at 0.
 * Commission is 50% of that. */
export function computeSalesReferralCommission(
  order: { total: number; taxAmount: number; handlingFeeAmount: number },
  items: CommissionOrderItem[],
): { profit: number; commissionAmount: number } {
  const cost = totalItemCost(items);
  const profit = Math.max(0, order.total - cost - order.taxAmount - order.handlingFeeAmount);
  return { profit, commissionAmount: profit * 0.5 };
}

/** Called once from finalizePaidOrder (lib/orders.ts), after the order's
 * own PAID-guard already ensures this runs at most once per order — no
 * extra idempotency check needed here beyond that. Silently does
 * nothing for an order with no attribution, a since-deactivated
 * promoter, or zero profit (no commission row is worth tracking for a
 * $0 payout, same "skip rather than show a hollow reward" reasoning as
 * isGemDigEligible). */
export async function settleSalesReferralCommission(order: {
  id: string;
  referredByPromoterId: string | null;
  currency: string;
  total: number;
  taxAmount: number;
  handlingFeeAmount: number;
  paidAt: Date | null;
}): Promise<void> {
  if (!order.referredByPromoterId) return;
  const promoter = await prisma.salesReferralPromoter.findUnique({ where: { id: order.referredByPromoterId }, select: { active: true } });
  if (!promoter?.active) return;

  const full = await prisma.order.findUnique({
    where: { id: order.id },
    select: {
      items: {
        select: {
          quantity: true,
          lineTotal: true,
          gemstone: { select: { costPrice: true } },
          jewelry: { select: { costPrice: true } },
          jewelryVariant: { select: { costPrice: true } },
        },
      },
    },
  });
  if (!full) return;

  const { profit, commissionAmount } = computeSalesReferralCommission(order, full.items);
  if (commissionAmount <= 0) return;

  const eligibleAt = new Date((order.paidAt ?? new Date()).getTime() + PAYOUT_ELIGIBLE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  await prisma.salesReferralCommission.create({
    data: { promoterId: order.referredByPromoterId, orderId: order.id, currency: order.currency, orderTotal: order.total, profit, commissionAmount, eligibleAt },
  });
}

// ---------- Promoter management (admin) ----------

export async function designatePromoter(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await prisma.salesReferralPromoter.create({ data: { userId } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "This user is already a sales referral promoter." };
    }
    throw err;
  }
  return { ok: true };
}

// Never a hard delete: SalesReferralCommission/SalesReferralPayoutRequest
// both reference a promoter with ON DELETE RESTRICT, so a promoter with
// any real history can't be deleted out from under it anyway —
// deactivating keeps their link dead (checkout attribution stops
// resolving) without losing that history, same "flag don't destroy"
// reasoning as every other active/inactive toggle in this app.
export async function setPromoterActive(promoterId: string, active: boolean): Promise<void> {
  await prisma.salesReferralPromoter.update({ where: { id: promoterId }, data: { active } });
}

// ---------- Payout requests ----------

export interface EligibleCommissionsSummary {
  currency: string;
  amount: number;
  count: number;
}

export async function getEligibleUnpaidCommissions(promoterId: string): Promise<EligibleCommissionsSummary[]> {
  const rows = await prisma.salesReferralCommission.groupBy({
    by: ["currency"],
    where: { promoterId, payoutRequestId: null, eligibleAt: { lte: new Date() } },
    _sum: { commissionAmount: true },
    _count: { _all: true },
  });
  return rows.map((r) => ({ currency: r.currency, amount: r._sum.commissionAmount ?? 0, count: r._count._all }));
}

/** Bundles every currently-eligible, not-yet-requested commission in one
 * currency into a new payout request — the whole select+link happens in
 * one transaction so two concurrent requests can't double-claim the same
 * commission, same conditional-claim discipline checkout.ts/
 * discount-codes.ts already use for their own races. */
export async function requestSalesReferralPayout(promoterId: string, currency: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.salesReferralCommission.findMany({
      where: { promoterId, currency, payoutRequestId: null, eligibleAt: { lte: new Date() } },
      select: { id: true, commissionAmount: true },
    });
    if (rows.length === 0) return { ok: false, error: "Nothing is eligible for payout yet." };
    const amount = rows.reduce((sum, r) => sum + r.commissionAmount, 0);
    const payout = await tx.salesReferralPayoutRequest.create({ data: { promoterId, currency, amount } });
    await tx.salesReferralCommission.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { payoutRequestId: payout.id } });
    return { ok: true };
  });
}

/** Denying unlinks the commissions (not deleted) rather than destroying
 * them, so they're simply eligible for a future payout request again. */
export async function resolveSalesReferralPayout(
  payoutId: string,
  resolution: "PAID" | "DENIED",
  opts: { paymentReference?: string; adminNotes?: string } = {},
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.salesReferralPayoutRequest.update({
      where: { id: payoutId },
      data: { status: resolution, paymentReference: opts.paymentReference, adminNotes: opts.adminNotes, resolvedAt: new Date() },
    });
    if (resolution === "DENIED") {
      await tx.salesReferralCommission.updateMany({ where: { payoutRequestId: payoutId }, data: { payoutRequestId: null } });
    }
  });
}
