import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { BackLink } from "@/components/admin/BackLink";
import { AdminSearchBox } from "@/components/admin/AdminSearchBox";
import { cn } from "@/lib/utils";
import { CARD_TABLE, CARD_THEAD, CARD_TBODY, CARD_TR, CARD_TD, CARD_FIRST, CARD_SECOND } from "@/components/admin/responsive-table";

const PAGE_SIZE = 20;

export default async function AdminCustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const type = sp.type === "WHOLESALE" ? ("WHOLESALE" as const) : sp.type === "RETAIL" ? ("RETAIL" as const) : undefined;

  const where = {
    role: "CUSTOMER" as const,
    ...(type ? { customerType: type } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] } : {}),
  };
  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { quoteRequests: true, sourcingRequest: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Customers</h1>

      <div className="mt-4">
        <AdminSearchBox placeholder="Search by name or email..." />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {([["All", undefined], ["Retail", "RETAIL"], ["Wholesale", "WHOLESALE"]] as const).map(([label, value]) => (
          <Link
            key={label}
            href={`/admin/customers?${new URLSearchParams({ ...(value ? { type: value } : {}), ...(q ? { q } : {}) }).toString()}`}
            className={cn("rounded-full border px-3 py-1 text-xs", type === value ? "border-charcoal bg-charcoal text-ivory" : "border-border-subtle text-charcoal/70")}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className={CARD_TABLE}>
          <thead className={CARD_THEAD}>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-charcoal/65">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Quotes</th>
              <th className="px-4 py-3">Sourcing</th>
            </tr>
          </thead>
          <tbody className={CARD_TBODY}>
            {customers.map((c) => (
              <tr key={c.id} className={CARD_TR}>
                <td className={CARD_FIRST}>
                  <Link href={`/admin/customers/${c.id}`} className="text-charcoal hover:text-gold">{c.name ?? "—"}</Link>
                </td>
                <td data-label="Email" className={`${CARD_TD} text-charcoal/70 max-lg:flex-col max-lg:items-start max-lg:gap-0 max-lg:text-left max-lg:[overflow-wrap:anywhere]`}>{c.email}</td>
                <td data-label="Type" className={CARD_SECOND}>
                  <Badge className={c.customerType === "WHOLESALE" ? "border-gold/40 bg-gold/15 text-charcoal" : "border-border-subtle bg-charcoal/5 text-charcoal/70"}>
                    {c.customerType === "WHOLESALE" ? "Wholesale" : "Retail"}
                  </Badge>
                </td>
                <td data-label="Joined" className={`${CARD_TD} text-charcoal/70`}>{c.createdAt.toLocaleDateString()}</td>
                <td data-label="Quotes" className={`${CARD_TD} text-charcoal/70`}>{c._count.quoteRequests}</td>
                <td data-label="Sourcing" className={`${CARD_TD} text-charcoal/70`}>{c._count.sourcingRequest}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr className="max-lg:block"><td colSpan={6} className="px-4 py-8 text-center text-charcoal/65 max-lg:block">No registered customers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={page} totalPages={totalPages} searchParams={sp} />
    </div>
  );
}
