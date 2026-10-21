import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/ui/MarketLink";
import { MessageCircle, PenTool } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUnreadCountsFor } from "@/lib/chat";
import { DESIGN_QUOTE_WHERE, designKind, designLabel } from "@/lib/account-hub";
import { listMyInProgressDesigns } from "@/actions/design-studio";
import { DiscardDesignButton } from "@/components/account/DiscardDesignButton";
import { QuoteStatusBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";
import type { ConfiguredSpec } from "@/lib/validation/quote";

export const metadata: Metadata = { title: "Custom Designs" };

// Everything a customer has designed themselves: a gem configured in the
// "Design Your Gem" configurator, or a free-form custom jewelry piece commissioned
// from a collection page. They're quote requests underneath (the same detail
// page, chat and pricing), just filed apart from quotes on catalog items.
export default async function AccountCustomDesignsPage() {
  const session = await auth();
  if (!session?.user) return null; // proxy.ts guards this route

  const [designs, sketches] = await Promise.all([
    prisma.quoteRequest.findMany({
      where: { userId: session.user.id, ...DESIGN_QUOTE_WHERE },
      orderBy: { createdAt: "desc" },
    }),
    listMyInProgressDesigns(),
  ]);
  const unreadCounts = await getUnreadCountsFor(designs.map((d) => ({ requestType: "quote" as const, requestId: d.id })), "CUSTOMER");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold-deep">Account</p>
          <h1 className="mt-2 font-serif text-3xl text-charcoal sm:text-4xl">Custom Designs</h1>
          <p className="mt-1 text-sm text-charcoal/60">Gems you&apos;ve configured and custom pieces you&apos;ve commissioned.</p>
        </div>
        <LinkButton href="/configurator" variant="gold" size="sm">
          <PenTool size={14} /> Design a gem
        </LinkButton>
      </div>

      {sketches.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs uppercase tracking-wide text-charcoal/50">Continue a sketch</p>
          <div className="flex flex-wrap gap-3">
            {sketches.map((s) => (
              <div key={s.id} className="w-32 rounded-lg border border-border-subtle bg-surface p-1.5">
                <Link href={`/design-studio?design=${s.id}`} className="block">
                  <span className="flex h-24 w-full items-center justify-center overflow-hidden rounded bg-[#faf7f2]">
                    {s.thumbnailUrl ? (
                      <Image src={s.thumbnailUrl} alt="" width={128} height={96} className="h-full w-full object-cover" />
                    ) : (
                      <PenTool size={20} strokeWidth={1.2} className="text-charcoal/30" />
                    )}
                  </span>
                </Link>
                <div className="mt-1 flex items-start justify-between gap-1">
                  <Link href={`/design-studio?design=${s.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-charcoal/70">{s.name}</span>
                    <span className="block text-[10px] text-charcoal/45">{s.updatedAt.toLocaleDateString()}</span>
                  </Link>
                  <DiscardDesignButton designId={s.id} designName={s.name} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {designs.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center">
          <PenTool size={30} strokeWidth={1.2} className="mx-auto text-charcoal/30" />
          <p className="mt-3 font-serif text-xl text-charcoal">No custom designs yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-charcoal/60">
            Choose a mineral, cut, colour and clarity in the configurator and request a private quote — it will show up here.
          </p>
          <LinkButton href="/configurator" variant="primary" size="sm" className="mt-5">Open the configurator</LinkButton>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {designs.map((d, i) => {
            const spec = d.configuredSpec as ConfiguredSpec | null;
            const images = (d.referenceImages as string[] | null) ?? [];
            const unread = unreadCounts[i];
            return (
              <Link
                key={d.id}
                href={`/account/quotes/${d.id}`}
                className="flex gap-4 rounded-xl border border-border-subtle bg-surface p-4 transition-colors hover:border-gold/40 sm:p-5"
              >
                <span
                  className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ivory-soft sm:h-24 sm:w-24"
                  style={spec ? { background: `hsl(${spec.hue} 62% ${Math.max(28, 66 - spec.darkness * 0.4)}%)` } : undefined}
                >
                  {images[0] ? (
                    <Image src={images[0]} alt="" fill sizes="96px" className="object-cover" />
                  ) : spec ? null : (
                    <PenTool size={22} strokeWidth={1.2} className="text-charcoal/30" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-serif text-lg text-charcoal">{designLabel(d)}</span>
                      <span className="mt-0.5 block text-xs text-charcoal/60">
                        {designKind(d)} · Submitted {d.createdAt.toLocaleDateString()}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {unread > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[11px] font-medium text-charcoal">
                          <MessageCircle size={11} /> {unread}
                        </span>
                      )}
                      <QuoteStatusBadge status={d.status} />
                    </span>
                  </span>
                  {spec && (
                    <span className="mt-2 block text-sm text-charcoal/65">
                      {spec.caratWeight} ct · {spec.clarityName}
                      {d.quantity > 1 ? ` · Qty ${d.quantity}` : ""}
                    </span>
                  )}
                  {d.note && <span className="mt-2 line-clamp-2 block whitespace-pre-line text-sm text-charcoal/70">&ldquo;{d.note}&rdquo;</span>}
                  {d.quotedPrice != null && (
                    <span className="mt-3 flex items-baseline justify-between border-t border-border-subtle pt-3">
                      <span className="font-serif text-xl text-charcoal">{formatPrice(d.quotedPrice)}</span>
                      {d.quoteValidUntil && <span className="text-xs text-charcoal/60">Valid until {d.quoteValidUntil.toLocaleDateString()}</span>}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
