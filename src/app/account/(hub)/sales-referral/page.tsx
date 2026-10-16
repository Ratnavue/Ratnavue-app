import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CopyLinkButton } from "@/components/account/CopyLinkButton";
import { RequestPayoutButton } from "@/components/account/RequestPayoutButton";

export const metadata: Metadata = { title: "Sales Referral" };

export default async function SalesReferralPage() {
  const session = await auth();
  if (!session?.user) return null; // the hub layout already guards this

  const promoter = await prisma.salesReferralPromoter.findUnique({
    where: { userId: session.user.id },
    include: {
      commissions: {
        include: { order: { select: { orderNumber: true, paidAt: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  // No nav link points here unless this exists (AccountSidebar's
  // showSalesReferral), but a direct visit otherwise has nothing to show.
  if (!promoter) notFound();

  const appUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const link = `${appUrl}/?ref=${promoter.token}`;
  const now = new Date();

  const totalsByCurrency = new Map<string, { currency: string; earned: number; eligible: number; pending: number; paid: number }>();
  for (const c of promoter.commissions) {
    const bucket = totalsByCurrency.get(c.currency) ?? { currency: c.currency, earned: 0, eligible: 0, pending: 0, paid: 0 };
    bucket.earned += c.commissionAmount;
    if (c.payoutRequestId == null) {
      if (c.eligibleAt <= now) bucket.eligible += c.commissionAmount;
      else bucket.pending += c.commissionAmount;
    }
    totalsByCurrency.set(c.currency, bucket);
  }
  const totals = [...totalsByCurrency.values()];

  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-gold-deep">Rewards</p>
      <h1 className="mt-2 font-serif text-3xl text-charcoal">Sales Referral</h1>
      <p className="mt-2 text-sm text-charcoal/70">
        Share your link anywhere — it attaches to any page and attributes whatever someone buys within 24 hours of
        clicking it to you. You earn 50% of that order&apos;s profit (after cost, VAT, and handling), cashable out
        once a sale is 30 days old.
      </p>

      <div className="mt-6">
        <CopyLinkButton value={link} />
        {!promoter.active && <p className="mt-2 text-sm text-red-700">Your promoter access is currently deactivated by an admin.</p>}
      </div>

      {totals.length > 0 && (
        <div className="mt-6 space-y-3">
          {totals.map((t) => (
            <div key={t.currency} className="rounded-xl border border-border-subtle bg-surface p-4">
              <p className="text-sm text-charcoal">
                <span className="font-medium">{t.currency}</span> — {t.earned.toFixed(2)} earned total, {t.pending.toFixed(2)} not yet 30 days old, {t.paid.toFixed(2)} already paid out
              </p>
              <div className="mt-3">
                {t.eligible > 0 ? (
                  <RequestPayoutButton currency={t.currency} amount={t.eligible} />
                ) : (
                  <p className="text-xs text-charcoal/55">Nothing eligible for payout yet.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-border-subtle bg-surface p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">Attributed Sales</p>
        {promoter.commissions.length === 0 ? (
          <p className="mt-2 text-sm text-charcoal/55">No attributed sales yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-charcoal/75">
            {promoter.commissions.map((c) => (
              <li key={c.id}>
                {c.order.orderNumber} — {c.order.paidAt ? new Date(c.order.paidAt).toLocaleDateString() : "—"} — <span className="font-medium text-charcoal">{c.currency} {c.commissionAmount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
