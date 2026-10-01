import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { pollChatMessages } from "@/actions/chat";
import { QuoteStatusBadge } from "@/components/ui/Badge";
import { QuoteStatusForm } from "@/components/admin/QuoteStatusForm";
import { QuoteGemPreview } from "@/components/admin/QuoteGemPreview";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { getQuoteGemVisual } from "@/lib/quote-visual";
import { formatPrice } from "@/lib/utils";
import { BackLink } from "@/components/admin/BackLink";
import type { ConfiguredSpec } from "@/lib/validation/quote";

export default async function AdminQuoteDetailPage({ params }: PageProps<"/admin/quotes/[id]">) {
  const { id } = await params;
  const [quote, session] = await Promise.all([
    prisma.quoteRequest.findUnique({
      where: { id },
      include: {
        user: true,
        gemstone: { include: { cut: true, mineral: true, clarityGrade: true } },
        jewelry: true,
        invoice: true,
        jewelryDesign: { select: { id: true } },
      },
    }),
    auth(),
  ]);

  if (!quote) notFound();

  const [openCart, initialMessages] = await Promise.all([
    prisma.cart.findFirst({ where: { userId: quote.userId, status: "OPEN" }, include: { items: true } }),
    pollChatMessages("quote", id),
  ]);

  const spec = quote.configuredSpec as ConfiguredSpec | null;
  const gemVisual = getQuoteGemVisual(quote);
  const referenceImages = (quote.referenceImages as string[] | null) ?? [];

  return (
    <div className="max-w-6xl">
      <BackLink href="/admin/quotes" label="Back to Quote Requests" />
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-charcoal">Quote Request</h1>
        <QuoteStatusBadge status={quote.status} />
      </div>

      {/* Wide screens have plenty of room to spare — a fixed-width side
          panel for customer info + the status-management action, and a
          wider main column for the item/gem/note detail, instead of both
          squeezed into a max-w-3xl centre column with the rest of the
          page left bare. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="rounded-xl border border-border-subtle bg-surface p-5">
            <p className="text-xs uppercase tracking-wide text-charcoal/45">Item</p>
            {quote.gemstone && (
              <Link href={`/admin/gems/${quote.gemstone.id}`} className="mt-1 block text-charcoal hover:text-gold">{quote.gemstone.name}</Link>
            )}
            {quote.jewelry && (
              <Link href={`/admin/jewelry/${quote.jewelry.id}`} className="mt-1 block text-charcoal hover:text-gold">{quote.jewelry.name}</Link>
            )}
            {!quote.gemstone && !quote.jewelry && spec && (
              <p className="mt-1 text-charcoal">Configured gem</p>
            )}
            {!quote.gemstone && !quote.jewelry && !spec && (
              <p className="mt-1 text-charcoal">Custom Design</p>
            )}
            <p className="mt-2 text-sm text-charcoal/60">Quantity: {quote.quantity}</p>
            <p className="text-xs text-charcoal/45">Submitted {quote.createdAt.toLocaleString()}</p>
            {quote.quotedPrice != null && (
              <div className="mt-3 border-t border-border-subtle pt-3">
                <p className="font-serif text-xl text-charcoal">{formatPrice(quote.quotedPrice)}</p>
                {quote.quoteValidUntil && (
                  <p className="text-xs text-charcoal/45">Valid until {quote.quoteValidUntil.toLocaleDateString()}</p>
                )}
              </div>
            )}
          </div>

          {gemVisual && (
            <div className="rounded-xl border border-border-subtle bg-surface p-5">
              <p className="text-xs uppercase tracking-wide text-charcoal/45">Colour &amp; Cut</p>
              <div className="mt-3">
                <QuoteGemPreview visual={gemVisual} seedKey={quote.id} />
              </div>
            </div>
          )}

          {quote.note && (
            <div className="rounded-xl border border-border-subtle bg-surface p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-charcoal/45">Customer Note</p>
                {quote.noteFlaggedForPrice && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800">⚠ May contain a price offer — review</span>
                )}
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-charcoal">{quote.note}</p>
            </div>
          )}

          {referenceImages.length > 0 && (
            <div className="rounded-xl border border-border-subtle bg-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-wide text-charcoal/45">Reference Images</p>
                {quote.jewelryDesign && (
                  <Link href={`/admin/design-studio?design=${quote.jewelryDesign.id}`} className="text-xs text-gold-deep underline hover:text-charcoal">
                    View/edit design
                  </Link>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {referenceImages.map((src) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer" className="relative block aspect-square overflow-hidden rounded-lg border border-border-subtle">
                    <Image src={src} alt="Customer reference image" fill sizes="150px" className="object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {session?.user && (
            <ChatPanel
              requestType="quote"
              requestId={quote.id}
              currentUserId={session.user.id}
              initialMessages={initialMessages}
              hasOpenCart={!!openCart && openCart.items.length > 0}
              allowVideoCallRequest
            />
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border-subtle bg-surface p-5">
            <p className="text-xs uppercase tracking-wide text-charcoal/45">Customer</p>
            <p className="mt-1 text-charcoal">{quote.user.name}</p>
            <p className="text-sm text-charcoal/60">{quote.user.email}</p>
            {quote.user.phone && <p className="text-sm text-charcoal/60">{quote.user.phone}</p>}
            <Link href={`/admin/customers/${quote.user.id}`} className="mt-2 inline-block text-xs text-gold underline">
              View customer history
            </Link>
          </div>

          {quote.quotedPrice != null && (
            <div className="rounded-xl border border-border-subtle bg-surface p-5">
              <p className="text-xs uppercase tracking-wide text-charcoal/45">Documents</p>
              <div className="mt-3 flex flex-col gap-2">
                <Link href={`/admin/quotes/${quote.id}/print`} className="text-sm text-gold underline decoration-gold/40 underline-offset-2 hover:text-charcoal">
                  View printable quote →
                </Link>
                {quote.invoice && (
                  <Link href={`/admin/invoices/${quote.invoice.id}`} className="text-sm text-gold underline decoration-gold/40 underline-offset-2 hover:text-charcoal">
                    View invoice {quote.invoice.invoiceNumber} →
                  </Link>
                )}
              </div>
            </div>
          )}

          <QuoteStatusForm
            id={quote.id}
            kind="quote"
            currentStatus={quote.status}
            currentAdminNotes={quote.adminNotes ?? ""}
            currentQuotedPrice={quote.quotedPrice}
            currentQuoteValidUntil={quote.quoteValidUntil?.toISOString() ?? null}
          />
        </div>
      </div>
    </div>
  );
}
