import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Pagination } from "@/components/ui/Pagination";
import { BackLink } from "@/components/admin/BackLink";
import { AdminSearchBox } from "@/components/admin/AdminSearchBox";
import { CARD_TABLE, CARD_THEAD, CARD_TBODY, CARD_TR, CARD_TD, CARD_FIRST } from "@/components/admin/responsive-table";

const PAGE_SIZE = 20;

export default async function AdminBusinessAccountsPage({ searchParams }: PageProps<"/admin/business-accounts">) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const where = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { owner: { email: { contains: q, mode: "insensitive" as const } } }] }
    : {};

  const [accounts, total] = await Promise.all([
    prisma.businessAccount.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { owner: { select: { name: true, email: true } }, _count: { select: { members: true, orders: true } } },
    }),
    prisma.businessAccount.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Business Accounts</h1>
      <p className="mt-1 text-sm text-charcoal/60">One row per wholesale team — created automatically when a wholesale application is approved.</p>

      <div className="mt-4">
        <AdminSearchBox placeholder="Search by company or owner email..." />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className={CARD_TABLE}>
          <thead className={CARD_THEAD}>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-charcoal/65">
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Members</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className={CARD_TBODY}>
            {accounts.map((b) => (
              <tr key={b.id} className={CARD_TR}>
                <td className={`${CARD_FIRST} text-charcoal`}>{b.name}</td>
                <td data-label="Owner" className={CARD_TD}>
                  <Link href={`/admin/customers/${b.ownerId}`} className="text-charcoal hover:text-gold">{b.owner.name ?? b.owner.email}</Link>
                </td>
                <td data-label="Members" className={`${CARD_TD} text-charcoal/70`}>{b._count.members}</td>
                <td data-label="Orders" className={`${CARD_TD} text-charcoal/70`}>{b._count.orders}</td>
                <td data-label="Created" className={`${CARD_TD} text-charcoal/70`}>{b.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr className="max-lg:block"><td colSpan={5} className="px-4 py-8 text-center text-charcoal/65 max-lg:block">No business accounts yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={page} totalPages={totalPages} searchParams={sp} />
    </div>
  );
}
