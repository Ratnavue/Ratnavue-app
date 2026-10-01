import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getUnreadCountsFor } from "@/lib/chat";
import { QuoteStatusBadge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { cn } from "@/lib/utils";
import { BackLink } from "@/components/admin/BackLink";
import { AdminSearchBox } from "@/components/admin/AdminSearchBox";
import { CARD_TABLE, CARD_THEAD, CARD_TBODY, CARD_TR, CARD_TD, CARD_FIRST, CARD_SECOND } from "@/components/admin/responsive-table";

const STATUSES = ["SUBMITTED", "UNDER_REVIEW", "QUOTED", "ACCEPTED", "DECLINED", "EXPIRED"];
const PAGE_SIZE = 20;

export default async function AdminSourcingPage({ searchParams }: PageProps<"/admin/sourcing">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const where = {
    ...(status ? { status: status as never } : {}),
    ...(q ? { OR: [{ user: { email: { contains: q, mode: "insensitive" as const } } }, { mineralDescription: { contains: q, mode: "insensitive" as const } }] } : {}),
  };
  const [requests, total] = await Promise.all([
    prisma.sourcingRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: true },
    }),
    prisma.sourcingRequest.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const unreadCounts = await getUnreadCountsFor(requests.map((r) => ({ requestType: "sourcing" as const, requestId: r.id })), "ADMIN");

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Sourcing Requests</h1>

      <div className="mt-4">
        <AdminSearchBox placeholder="Search by customer email or description..." />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/admin/sourcing${q ? `?q=${encodeURIComponent(q)}` : ""}`}
          className={cn("rounded-full border px-3 py-1 text-xs", !status ? "border-charcoal bg-charcoal text-ivory" : "border-border-subtle text-charcoal/70")}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/sourcing?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={cn("rounded-full border px-3 py-1 text-xs", status === s ? "border-charcoal bg-charcoal text-ivory" : "border-border-subtle text-charcoal/70")}
          >
            {s.replaceAll("_", " ")}
          </Link>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className={CARD_TABLE}>
          <thead className={CARD_THEAD}>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-charcoal/65">
              <th className="px-4 py-3">Request</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Flagged</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className={CARD_TBODY}>
            {requests.map((r, i) => {
              const unread = unreadCounts[i];
              return (
              <tr key={r.id} className={CARD_TR}>
                <td className={CARD_FIRST}>
                  <Link href={`/admin/sourcing/${r.id}`} className="flex items-center gap-2 text-charcoal hover:text-gold">
                    {r.mineralDescription}
                    {unread > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-medium text-charcoal">
                        <MessageCircle size={10} /> {unread}
                      </span>
                    )}
                  </Link>
                </td>
                <td data-label="Customer" className={`${CARD_TD} text-charcoal/70 max-lg:flex-col max-lg:items-start max-lg:gap-0 max-lg:text-left max-lg:[overflow-wrap:anywhere]`}>{r.user.email}</td>
                <td data-label="Submitted" className={`${CARD_TD} text-charcoal/70`}>{r.createdAt.toLocaleDateString()}</td>
                <td data-label="Flagged" className={CARD_TD}>{r.noteFlaggedForPrice ? <span className="text-amber-700">⚠ Price?</span> : "—"}</td>
                <td data-label="Status" className={CARD_SECOND}><QuoteStatusBadge status={r.status} /></td>
              </tr>
              );
            })}
            {requests.length === 0 && (
              <tr className="max-lg:block"><td colSpan={5} className="px-4 py-8 text-center text-charcoal/65 max-lg:block">No sourcing requests found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={page} totalPages={totalPages} searchParams={sp} />
    </div>
  );
}
