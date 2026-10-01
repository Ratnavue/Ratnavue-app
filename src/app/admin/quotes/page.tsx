import Link from "next/link";
import { Printer, Receipt, MessageCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getUnreadCountsFor } from "@/lib/chat";
import { QuoteStatusBadge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { cn, formatPrice } from "@/lib/utils";
import { resolveGemColor } from "@/components/gem-visualizer/color";
import { getQuoteGemVisual } from "@/lib/quote-visual";
import { BackLink } from "@/components/admin/BackLink";
import { AdminSearchBox } from "@/components/admin/AdminSearchBox";
import { CARD_TABLE, CARD_THEAD, CARD_TBODY, CARD_TR, CARD_TD, CARD_FIRST, CARD_SECOND, CARD_TD_ACTIONS } from "@/components/admin/responsive-table";

const STATUSES = ["SUBMITTED", "UNDER_REVIEW", "QUOTED", "ACCEPTED", "DECLINED", "EXPIRED"];
const PAGE_SIZE = 20;

export default async function AdminQuotesPage({ searchParams }: PageProps<"/admin/quotes">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const where = {
    ...(status ? { status: status as never } : {}),
    ...(q
      ? {
          OR: [
            { user: { email: { contains: q, mode: "insensitive" as const } } },
            { gemstone: { name: { contains: q, mode: "insensitive" as const } } },
            { jewelry: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const [quotes, total] = await Promise.all([
    prisma.quoteRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: true,
        gemstone: { include: { cut: true, mineral: true, clarityGrade: true } },
        jewelry: true,
        invoice: true,
      },
    }),
    prisma.quoteRequest.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const unreadCounts = await getUnreadCountsFor(quotes.map((q) => ({ requestType: "quote" as const, requestId: q.id })), "ADMIN");

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Quote Requests</h1>

      <div className="mt-4">
        <AdminSearchBox placeholder="Search by customer email or item..." />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/admin/quotes${q ? `?q=${encodeURIComponent(q)}` : ""}`}
          className={cn("rounded-full border px-3 py-1 text-xs", !status ? "border-charcoal bg-charcoal text-ivory" : "border-border-subtle text-charcoal/70")}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/quotes?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
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
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Flagged</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Documents</th>
            </tr>
          </thead>
          <tbody className={CARD_TBODY}>
            {quotes.map((q, i) => {
              const visual = getQuoteGemVisual(q);
              const unread = unreadCounts[i];
              return (
              <tr key={q.id} className={CARD_TR}>
                <td className={CARD_FIRST}>
                  <Link href={`/admin/quotes/${q.id}`} className="flex items-center gap-2 text-charcoal hover:text-gold">
                    {visual && (
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full border border-border-subtle"
                        style={{ backgroundColor: resolveGemColor(visual.hue, visual.darkness, visual.saturation ?? 72).base }}
                        title={`${visual.mineralName} · ${visual.cutName}`}
                        aria-hidden
                      />
                    )}
                    {q.gemstone?.name ?? q.jewelry?.name ?? (q.productType === "CUSTOM" ? "Custom Design" : "Configured gem")}
                    {unread > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-medium text-charcoal">
                        <MessageCircle size={10} /> {unread}
                      </span>
                    )}
                  </Link>
                </td>
                <td data-label="Customer" className={`${CARD_TD} text-charcoal/70 max-lg:flex-col max-lg:items-start max-lg:gap-0 max-lg:text-left max-lg:[overflow-wrap:anywhere]`}>{q.user.email}</td>
                <td data-label="Qty" className={`${CARD_TD} text-charcoal/70`}>{q.quantity}</td>
                <td data-label="Price" className={`${CARD_TD} text-charcoal/70`}>{q.quotedPrice != null ? formatPrice(q.quotedPrice) : "—"}</td>
                <td data-label="Submitted" className={`${CARD_TD} text-charcoal/70`}>{q.createdAt.toLocaleDateString()}</td>
                <td data-label="Flagged" className={CARD_TD}>{q.noteFlaggedForPrice ? <span className="text-amber-700">⚠ Price?</span> : "—"}</td>
                <td data-label="Status" className={CARD_SECOND}><QuoteStatusBadge status={q.status} /></td>
                <td className={CARD_TD_ACTIONS}>
                  {q.quotedPrice != null ? (
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/quotes/${q.id}/print`}
                        title="Print quote"
                        className="flex items-center gap-1 text-xs text-charcoal/60 hover:text-gold"
                      >
                        <Printer size={14} /> Quote
                      </Link>
                      {q.invoice && (
                        <Link
                          href={`/admin/invoices/${q.invoice.id}`}
                          title="Print invoice"
                          className="flex items-center gap-1 text-xs text-charcoal/60 hover:text-gold"
                        >
                          <Receipt size={14} /> Invoice
                        </Link>
                      )}
                    </div>
                  ) : (
                    <span className="text-charcoal/30">—</span>
                  )}
                </td>
              </tr>
              );
            })}
            {quotes.length === 0 && (
              <tr className="max-lg:block"><td colSpan={8} className="px-4 py-8 text-center text-charcoal/65 max-lg:block">No quote requests found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={page} totalPages={totalPages} searchParams={sp} />
    </div>
  );
}
