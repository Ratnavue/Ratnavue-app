import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Pagination } from "@/components/ui/Pagination";
import { BackLink } from "@/components/admin/BackLink";
import { Badge } from "@/components/ui/Badge";
import { AdminSearchBox } from "@/components/admin/AdminSearchBox";
import { CARD_TABLE, CARD_THEAD, CARD_TBODY, CARD_TR, CARD_TD, CARD_FIRST, CARD_SECOND } from "@/components/admin/responsive-table";

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  QUALIFIED: "bg-sapphire-soft/15 text-sapphire border-sapphire-soft/30",
  REWARDED: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

export default async function AdminReferralsPage({ searchParams }: PageProps<"/admin/referrals">) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const where = q
    ? { OR: [{ referrer: { email: { contains: q, mode: "insensitive" as const } } }, { referee: { email: { contains: q, mode: "insensitive" as const } } }] }
    : {};

  const [referrals, total] = await Promise.all([
    prisma.referral.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        referrer: { select: { id: true, name: true, email: true } },
        referee: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.referral.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Referrals</h1>

      <div className="mt-4">
        <AdminSearchBox placeholder="Search by referrer or referee email..." />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className={CARD_TABLE}>
          <thead className={CARD_THEAD}>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-charcoal/65">
              <th className="px-4 py-3">Referrer</th>
              <th className="px-4 py-3">Referred</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Signed up</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className={CARD_TBODY}>
            {referrals.map((r) => (
              <tr key={r.id} className={CARD_TR}>
                <td className={CARD_FIRST}>
                  <Link href={`/admin/customers/${r.referrer.id}`} className="text-charcoal hover:text-gold">{r.referrer.name ?? r.referrer.email}</Link>
                </td>
                <td data-label="Referred" className={CARD_TD}>
                  <Link href={`/admin/customers/${r.referee.id}`} className="text-charcoal hover:text-gold">{r.referee.name ?? r.referee.email}</Link>
                </td>
                <td data-label="Code" className={`${CARD_TD} font-mono text-xs text-charcoal/70`}>{r.code}</td>
                <td data-label="Signed up" className={`${CARD_TD} text-charcoal/70`}>{r.createdAt.toLocaleDateString()}</td>
                <td data-label="Status" className={CARD_SECOND}><Badge className={STATUS_STYLES[r.status] ?? ""}>{r.status}</Badge></td>
              </tr>
            ))}
            {referrals.length === 0 && (
              <tr className="max-lg:block"><td colSpan={5} className="px-4 py-8 text-center text-charcoal/65 max-lg:block">No referrals yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={page} totalPages={totalPages} searchParams={sp} />
    </div>
  );
}
