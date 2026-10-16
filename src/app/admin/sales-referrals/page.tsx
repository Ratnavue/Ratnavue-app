import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/admin/BackLink";
import { SalesReferralManager, type PromoterSummary } from "@/components/admin/SalesReferralManager";
import { SalesReferralPayoutQueue, type PayoutRequestRow } from "@/components/admin/SalesReferralPayoutQueue";

export default async function AdminSalesReferralsPage() {
  const appUrl = process.env.AUTH_URL ?? "http://localhost:3000";

  const [promoterRows, payoutRows] = await Promise.all([
    prisma.salesReferralPromoter.findMany({
      include: {
        user: { select: { name: true, email: true } },
        commissions: { select: { currency: true, commissionAmount: true, payoutRequest: { select: { status: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.salesReferralPayoutRequest.findMany({
      where: { status: "REQUESTED" },
      include: { promoter: { include: { user: { select: { name: true, email: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const promoters: PromoterSummary[] = promoterRows.map((p) => {
    const totalsByCurrency = new Map<string, { currency: string; earned: number; pending: number; paid: number }>();
    for (const c of p.commissions) {
      const bucket = totalsByCurrency.get(c.currency) ?? { currency: c.currency, earned: 0, pending: 0, paid: 0 };
      bucket.earned += c.commissionAmount;
      if (c.payoutRequest?.status === "PAID") bucket.paid += c.commissionAmount;
      else bucket.pending += c.commissionAmount;
      totalsByCurrency.set(c.currency, bucket);
    }
    return {
      id: p.id,
      name: p.user.name,
      email: p.user.email,
      active: p.active,
      link: `${appUrl}/?ref=${p.token}`,
      salesCount: p.commissions.length,
      totals: [...totalsByCurrency.values()],
    };
  });

  const payoutRequests: PayoutRequestRow[] = payoutRows.map((r) => ({
    id: r.id,
    promoterName: r.promoter.user.name ?? r.promoter.user.email,
    currency: r.currency,
    amount: r.amount,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Sales Referrals</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        Designate existing admin/staff users as sales promoters — they earn 50% of the profit on any sale attributed
        to their link within 24 hours of a click, cashable out 30 days after the sale.
      </p>

      <div className="mt-6">
        <SalesReferralPayoutQueue requests={payoutRequests} />
      </div>
      <div className="mt-6">
        <SalesReferralManager promoters={promoters} />
      </div>
    </div>
  );
}
