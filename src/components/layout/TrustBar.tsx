import { ShieldCheck, Gem, Truck, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrustBarMessages } from "@/lib/i18n-messages";

// Icons + which message keys they pair with — the claims themselves are
// operational facts about how the business actually runs (grading,
// shipping, returns), not seasonal marketing copy an admin would want to
// rewrite, so only their *icon* lives in code; the text comes from
// messages/*.json via TrustBarMessages (see src/lib/i18n-messages.ts for
// why this takes translated strings as a prop instead of translating
// itself).
const TRUST_ITEMS = [
  { icon: ShieldCheck, titleKey: "certifiedTitle", detailKey: "certifiedDetail" },
  // Genuinely true rather than manufactured urgency: Gemstone/JewelryPiece
  // rows have no quantity field (see schema) — each listing really is the
  // one and only physical piece, so "won't be restocked" is a fact, not a
  // sales tactic.
  { icon: Gem, titleKey: "uniqueTitle", detailKey: "uniqueDetail" },
  { icon: Truck, titleKey: "shippingTitle", detailKey: "shippingDetail" },
  { icon: RotateCcw, titleKey: "returnsTitle", detailKey: "returnsDetail" },
] as const satisfies { icon: typeof ShieldCheck; titleKey: keyof TrustBarMessages; detailKey: keyof TrustBarMessages }[];

/**
 * The site's trust/authenticity signals — the row of claims that answer a
 * first-time buyer's real hesitation ("is this genuine, and what if it
 * isn't right for me?") before they reach checkout. `variant="full"` is the
 * icon-plus-caption grid; `variant="cards"` the numbered cards on the home page; `variant="compact"` is a
 * single-line icon-plus-label list for tight spots like a product page's
 * buy box, right where that hesitation is highest.
 */
export function TrustBar({
  messages,
  variant = "full",
  className,
}: {
  messages: TrustBarMessages;
  variant?: "full" | "compact" | "cards";
  className?: string;
}) {
  // Numbered cards — the home page's "Ratnavue Promise" section.
  if (variant === "cards") {
    return (
      <ol className={cn("grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4", className)}>
        {TRUST_ITEMS.map((item, i) => (
          <li key={item.titleKey} className="rounded-2xl border border-border-subtle bg-surface p-6 sm:p-7">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-raised text-sm font-semibold text-gold-deep">
              {i + 1}
            </span>
            <p className="mt-6 font-serif text-2xl leading-snug text-charcoal">{messages[item.titleKey]}</p>
            <p className="mt-2 leading-relaxed text-charcoal/70">{messages[item.detailKey]}</p>
          </li>
        ))}
      </ol>
    );
  }

  if (variant === "compact") {
    return (
      <ul className={cn("flex flex-wrap gap-x-5 gap-y-2", className)}>
        {TRUST_ITEMS.map((item) => (
          <li key={item.titleKey} className="flex items-center gap-1.5 text-xs text-charcoal/65">
            <item.icon size={14} className="shrink-0 text-gold-deep" aria-hidden />
            {messages[item.titleKey]}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn("grid gap-8 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {TRUST_ITEMS.map((item) => (
        <div key={item.titleKey} className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold-deep">
            <item.icon size={17} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-charcoal">{messages[item.titleKey]}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-charcoal/65">{messages[item.detailKey]}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
