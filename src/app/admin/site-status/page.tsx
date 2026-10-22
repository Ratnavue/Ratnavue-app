import { prisma } from "@/lib/prisma";
import { getSiteBannerSettings } from "@/lib/site-banner";
import { SiteStatusForm } from "@/components/admin/SiteStatusForm";
import { BackLink } from "@/components/admin/BackLink";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { CARD_TABLE, CARD_THEAD, CARD_TBODY, CARD_TR, CARD_TD, CARD_FIRST, CARD_SECOND } from "@/components/admin/responsive-table";

const PAGE_SIZE = 20;

export default async function AdminSiteStatusPage({ searchParams }: PageProps<"/admin/site-status">) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const [settings, feedback, total] = await Promise.all([
    getSiteBannerSettings(),
    prisma.siteFeedback.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.siteFeedback.count(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Site Status</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        A dismissible banner above the navigation on each storefront — browsing, search and checkout stay exactly as they are either way.
      </p>

      <div className="mt-6">
        <SiteStatusForm settings={settings} />
      </div>

      <h2 className="mt-10 font-serif text-2xl text-charcoal">Feedback received</h2>
      <p className="mt-1 text-sm text-charcoal/60">Submitted through the banner&apos;s &ldquo;Share feedback&rdquo; widget, on either storefront.</p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className={CARD_TABLE}>
          <thead className={CARD_THEAD}>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-charcoal/65">
              <th className="px-4 py-3">Market</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">Received</th>
            </tr>
          </thead>
          <tbody className={CARD_TBODY}>
            {feedback.map((f) => (
              <tr key={f.id} className={CARD_TR}>
                <td className={CARD_FIRST}><Badge>{f.market.toUpperCase()}</Badge></td>
                <td data-label="Message" className={`${CARD_TD} max-w-md whitespace-pre-wrap text-charcoal`}>{f.message}</td>
                <td data-label="From" className={`${CARD_TD} text-charcoal/70`}>{f.user?.name ?? f.user?.email ?? f.email ?? "Anonymous"}</td>
                <td data-label="Received" className={CARD_SECOND}>{f.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            {feedback.length === 0 && (
              <tr className="max-lg:block"><td colSpan={4} className="px-4 py-8 text-center text-charcoal/65 max-lg:block">No feedback yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={page} totalPages={totalPages} searchParams={sp} />
    </div>
  );
}
