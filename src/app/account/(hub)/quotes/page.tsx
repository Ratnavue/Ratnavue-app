import type { Metadata } from "next";
import Link from "@/components/ui/MarketLink";
import { MessageCircle } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUnreadCountsFor } from "@/lib/chat";
import { CATALOG_QUOTE_WHERE } from "@/lib/account-hub";
import { QuoteStatusBadge } from "@/components/ui/Badge";
import { formatPrice } from "@/lib/utils";
import type { ConfiguredSpec } from "@/lib/validation/quote";

export const metadata: Metadata = { title: "My Quote Requests" };

export default async function AccountQuotesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const quotes = await prisma.quoteRequest.findMany({
    // Quotes on catalog items only — custom designs (a commissioned piece, a
    // gem you configured) are listed under Custom Designs.
    where: { userId: session.user.id, ...CATALOG_QUOTE_WHERE },
    orderBy: { createdAt: "desc" },
    include: { gemstone: true, jewelry: true },
  });
  const unreadCounts = await getUnreadCountsFor(quotes.map((q) => ({ requestType: "quote" as const, requestId: q.id })), "CUSTOMER");

  return (
    <div className="w-full">
      <p className="text-xs uppercase tracking-widest text-gold-deep">Account</p>
      <h1 className="mt-2 font-serif text-4xl text-charcoal">My Quote Requests</h1>

      {quotes.length === 0 ? (
        <p className="mt-10 text-charcoal/60">
          No quote requests yet. Browse our{" "}
          <Link href="/gems" className="underline">gemstones</Link> or{" "}
          <Link href="/jewelry" className="underline">jewelry</Link> to request one.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {quotes.map((q, i) => {
            const spec = q.configuredSpec as ConfiguredSpec | null;
            const label =
              q.gemstone?.name ??
              q.jewelry?.name ??
              (spec ? `Configured ${spec.mineralName} (${spec.cutName})` : q.productType === "CUSTOM" ? "Custom Design" : "Item");
            const unread = unreadCounts[i];
            return (
              <Link
                key={q.id}
                href={`/account/quotes/${q.id}`}
                className="block rounded-xl border border-border-subtle bg-surface p-5 transition-colors hover:border-gold/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-serif text-lg text-charcoal">{label}</p>
                    <p className="mt-1 text-xs text-charcoal/65">
                      Submitted {q.createdAt.toLocaleDateString()} · Qty {q.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {unread > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[11px] font-medium text-night">
                        <MessageCircle size={11} /> {unread}
                      </span>
                    )}
                    <QuoteStatusBadge status={q.status} />
                  </div>
                </div>
                {q.quotedPrice != null && (
                  <div className="mt-3 flex items-baseline justify-between border-t border-border-subtle pt-3">
                    <p className="font-serif text-xl text-charcoal">{formatPrice(q.quotedPrice)}</p>
                    {q.quoteValidUntil && (
                      <p className="text-xs text-charcoal/65">Valid until {q.quoteValidUntil.toLocaleDateString()}</p>
                    )}
                  </div>
                )}
                {q.note && <p className="mt-3 whitespace-pre-line text-sm text-charcoal/70">&ldquo;{q.note}&rdquo;</p>}
                {q.adminNotes && (
                  <div className="mt-3 rounded-lg bg-ivory-soft p-3 text-sm text-charcoal/75">
                    <p className="text-xs uppercase tracking-wide text-charcoal/65">From Ratnavue</p>
                    <p className="mt-1">{q.adminNotes}</p>
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
