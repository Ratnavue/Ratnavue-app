import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { WholesaleStatusBadge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { BackLink } from "@/components/admin/BackLink";
import { WholesaleApplicationActions } from "@/components/admin/WholesaleApplicationActions";
import { CreateWholesaleAccountForm } from "@/components/admin/CreateWholesaleAccountForm";
import { AdminSearchBox } from "@/components/admin/AdminSearchBox";
import { cn } from "@/lib/utils";
import { CARD_TABLE, CARD_THEAD, CARD_TBODY, CARD_TR, CARD_TD, CARD_FIRST, CARD_SECOND, CARD_TD_ACTIONS } from "@/components/admin/responsive-table";

const STATUSES = ["PENDING", "APPROVED", "REJECTED"];
const PAGE_SIZE = 20;

export default async function AdminWholesaleApplicationsPage({ searchParams }: PageProps<"/admin/wholesale-applications">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const where = {
    customerType: "WHOLESALE" as const,
    ...(status ? { wholesaleStatus: status as never } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] } : {}),
  };
  const [applications, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl text-charcoal">Wholesale Applications</h1>
        <CreateWholesaleAccountForm />
      </div>
      <p className="mt-1 text-sm text-charcoal/60">
        Approval doesn&apos;t gate anything else in the app today — an applicant can already browse, request quotes,
        and buy retail while pending. This is purely the review record.
      </p>

      <div className="mt-4">
        <AdminSearchBox placeholder="Search by name or email..." />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/admin/wholesale-applications${q ? `?q=${encodeURIComponent(q)}` : ""}`}
          className={cn("rounded-full border px-3 py-1 text-xs", !status ? "border-charcoal bg-night text-cream" : "border-border-subtle text-charcoal/70")}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/wholesale-applications?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={cn("rounded-full border px-3 py-1 text-xs", status === s ? "border-charcoal bg-night text-cream" : "border-border-subtle text-charcoal/70")}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className={CARD_TABLE}>
          <thead className={CARD_THEAD}>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-charcoal/65">
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Reg. #</th>
              <th className="px-4 py-3">Applied</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className={CARD_TBODY}>
            {applications.map((a) => (
              <tr key={a.id} className={CARD_TR}>
                <td className={`${CARD_FIRST}`}>
                  <Link href={`/admin/customers/${a.id}`} className="text-charcoal hover:text-gold hover:underline">
                    {a.businessName ?? "—"}
                  </Link>
                </td>
                <td data-label="Contact" className={`${CARD_TD} text-charcoal/70`}>
                  {a.name} · {a.email}
                  {a.phone && <span> · {a.phone}</span>}
                </td>
                <td data-label="Reg. #" className={`${CARD_TD} text-charcoal/70`}>{a.businessRegNo ?? "—"}</td>
                <td data-label="Applied" className={`${CARD_TD} text-charcoal/70`}>{a.createdAt.toLocaleDateString()}</td>
                <td data-label="Status" className={`${CARD_SECOND}`}><WholesaleStatusBadge status={a.wholesaleStatus ?? "PENDING"} /></td>
                <td className={`${CARD_TD_ACTIONS}`}>
                  {a.wholesaleStatus === "PENDING" && <WholesaleApplicationActions userId={a.id} />}
                </td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr className="max-lg:block"><td colSpan={6} className="px-4 py-8 text-center text-charcoal/65 max-lg:block">No wholesale applications found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={page} totalPages={totalPages} searchParams={sp} />
    </div>
  );
}
