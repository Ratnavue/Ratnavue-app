import { cn } from "@/lib/utils";
import { AUCTION_STATE_LABELS, type AuctionDisplayState } from "@/lib/auctions";

export const STOCK_STYLES: Record<string, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-800 border-emerald-200",
  RESERVED: "bg-amber-50 text-amber-800 border-amber-200",
  // Unlike the two above, this used to be bg-charcoal/5 — a 5%-opacity
  // tint, not a solid fill like emerald-50/amber-50 are. Fine against a
  // plain page background, but this badge is also rendered as a photo
  // overlay on catalog cards (GemCard/JewelryCard), where a near-
  // transparent fill just lets whatever's behind it (often a light/white
  // product photo) show straight through — unreadable. A solid dark pill
  // reads clearly against any photo, same family as those cards' own
  // "Ceylon" origin badge (bg-charcoal/85 + text-ivory).
  SOLD: "bg-charcoal/90 text-ivory border-charcoal/90",
};

const QUOTE_STATUS_STYLES: Record<string, string> = {
  SUBMITTED: "bg-sapphire-soft/15 text-sapphire border-sapphire-soft/30",
  UNDER_REVIEW: "bg-amber-50 text-amber-800 border-amber-200",
  QUOTED: "bg-gold-soft/25 text-charcoal border-gold/40",
  ACCEPTED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  DECLINED: "bg-red-50 text-red-700 border-red-200",
  EXPIRED: "bg-charcoal/5 text-charcoal/65 border-charcoal/15",
};

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide", className)}>
      {children}
    </span>
  );
}

export function StockBadge({ status }: { status: string }) {
  return <Badge className={STOCK_STYLES[status] ?? ""}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}

export function QuoteStatusBadge({ status }: { status: string }) {
  return <Badge className={QUOTE_STATUS_STYLES[status] ?? ""}>{status.replaceAll("_", " ")}</Badge>;
}

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  AWAITING_PAYMENT: "bg-amber-50 text-amber-800 border-amber-200",
  PAID: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: "Awaiting Payment",
  PAID: "Paid",
};

export function PaymentStatusBadge({ status }: { status: string }) {
  return <Badge className={PAYMENT_STATUS_STYLES[status] ?? ""}>{PAYMENT_STATUS_LABELS[status] ?? status}</Badge>;
}

const AUCTION_STATE_STYLES: Record<AuctionDisplayState, string> = {
  DRAFT: "bg-charcoal/5 text-charcoal/60 border-charcoal/15",
  SCHEDULED: "bg-sapphire-soft/15 text-sapphire border-sapphire-soft/30",
  OPEN: "bg-emerald-50 text-emerald-800 border-emerald-200",
  RESERVE_NOT_MET: "bg-charcoal/5 text-charcoal/65 border-charcoal/15",
  AWAITING_CONFIRMATION: "bg-amber-50 text-amber-800 border-amber-200",
  WON: "bg-gold-soft/25 text-charcoal border-gold/40",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  EXPIRED: "bg-red-50 text-red-700 border-red-200",
};

export function AuctionStateBadge({ state }: { state: AuctionDisplayState }) {
  return <Badge className={AUCTION_STATE_STYLES[state]}>{AUCTION_STATE_LABELS[state]}</Badge>;
}

const WHOLESALE_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

export function WholesaleStatusBadge({ status }: { status: string }) {
  return <Badge className={WHOLESALE_STATUS_STYLES[status] ?? ""}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}
