import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/admin/BackLink";

export default async function AdminSalesReferralDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const promoter = await prisma.salesReferralPromoter.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      commissions: {
        include: { order: { select: { orderNumber: true, createdAt: true, paidAt: true } }, payoutRequest: { select: { status: true, createdAt: true } } },
        orderBy: { createdAt: "desc" },
      },
      payoutRequests: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!promoter) notFound();

  return (
    <div>
      <BackLink href="/admin/sales-referrals" label="Back to Sales Referrals" />
      <h1 className="font-serif text-3xl text-charcoal">{promoter.user.name ?? promoter.user.email}</h1>
      <p className="mt-1 text-sm text-charcoal/60">{promoter.user.email} · {promoter.active ? "Active" : "Inactive"}</p>

      <div className="mt-6 rounded-xl border border-border-subtle bg-surface p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">Attributed Sales</p>
        {promoter.commissions.length === 0 ? (
          <p className="mt-2 text-sm text-charcoal/55">No attributed sales yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-charcoal/55">
                <th className="py-2 pr-3">Order</th>
                <th className="py-2 pr-3">Paid</th>
                <th className="py-2 pr-3">Order Total</th>
                <th className="py-2 pr-3">Commission</th>
                <th className="py-2 pr-3">Eligible</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {promoter.commissions.map((c) => (
                <tr key={c.id} className="border-b border-border-subtle/60">
                  <td className="py-2 pr-3 text-charcoal">{c.order.orderNumber}</td>
                  <td className="py-2 pr-3 text-charcoal/70">{c.order.paidAt ? new Date(c.order.paidAt).toLocaleDateString() : "—"}</td>
                  <td className="py-2 pr-3 text-charcoal/70">{c.currency} {c.orderTotal.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-charcoal">{c.currency} {c.commissionAmount.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-charcoal/70">{new Date(c.eligibleAt).toLocaleDateString()}</td>
                  <td className="py-2 text-charcoal/70">{c.payoutRequest?.status ?? (c.eligibleAt <= new Date() ? "Eligible" : "Pending")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-border-subtle bg-surface p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">Payout History</p>
        {promoter.payoutRequests.length === 0 ? (
          <p className="mt-2 text-sm text-charcoal/55">No payout requests yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-charcoal/75">
            {promoter.payoutRequests.map((r) => (
              <li key={r.id}>
                {new Date(r.createdAt).toLocaleDateString()} — {r.currency} {r.amount.toFixed(2)} — <span className="font-medium text-charcoal">{r.status}</span>
                {r.paymentReference && <span className="text-charcoal/55"> ({r.paymentReference})</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
