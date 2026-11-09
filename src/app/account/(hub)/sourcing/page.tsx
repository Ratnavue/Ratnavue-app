import type { Metadata } from "next";
import Link from "@/components/ui/MarketLink";
import { MessageCircle } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUnreadCountsFor } from "@/lib/chat";
import { QuoteStatusBadge } from "@/components/ui/Badge";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "My Sourcing Requests" };

export default async function AccountSourcingPage() {
  const session = await auth();
  if (!session?.user) return null;

  const requests = await prisma.sourcingRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  const unreadCounts = await getUnreadCountsFor(requests.map((r) => ({ requestType: "sourcing" as const, requestId: r.id })), "CUSTOMER");

  return (
    <div className="w-full">
      <p className="text-xs uppercase tracking-widest text-gold-deep">Account</p>
      <h1 className="mt-2 font-serif text-4xl text-charcoal">My Sourcing Requests</h1>

      {requests.length === 0 ? (
        <p className="mt-10 text-charcoal/60">
          No sourcing requests yet. <Link href="/sourcing" className="underline">Submit one</Link> if you&apos;re after something specific.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {requests.map((r, i) => {
            const unread = unreadCounts[i];
            return (
              <Link
                key={r.id}
                href={`/account/sourcing/${r.id}`}
                className="block rounded-xl border border-border-subtle bg-surface p-5 transition-colors hover:border-gold/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-serif text-lg text-charcoal">{r.mineralDescription}</p>
                    <p className="mt-1 text-xs text-charcoal/65">Submitted {r.createdAt.toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {unread > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[11px] font-medium text-night">
                        <MessageCircle size={11} /> {unread}
                      </span>
                    )}
                    <QuoteStatusBadge status={r.status} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-charcoal/65">
                  {r.approxSize && <span>Size: {r.approxSize}</span>}
                  {r.approxCut && <span>Cut: {r.approxCut}</span>}
                  {r.approxColor && <span>Colour: {r.approxColor}</span>}
                </div>
                {r.quotedPrice != null && (
                  <div className="mt-3 flex items-baseline justify-between border-t border-border-subtle pt-3">
                    <p className="font-serif text-xl text-charcoal">{formatPrice(r.quotedPrice)}</p>
                    {r.quoteValidUntil && (
                      <p className="text-xs text-charcoal/65">Valid until {r.quoteValidUntil.toLocaleDateString()}</p>
                    )}
                  </div>
                )}
                {r.notes && <p className="mt-3 text-sm text-charcoal/70">&ldquo;{r.notes}&rdquo;</p>}
                {r.adminNotes && (
                  <div className="mt-3 rounded-lg bg-ivory-soft p-3 text-sm text-charcoal/75">
                    <p className="text-xs uppercase tracking-wide text-charcoal/65">From Ratnavue</p>
                    <p className="mt-1">{r.adminNotes}</p>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
