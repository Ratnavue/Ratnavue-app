import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { LISTING_STATUSES, LISTING_STATUS_LABELS, type ListingStatus } from "@/lib/item-number";

/** The Draft / Finished / Live picker on the gemstone and jewelry forms.
 * Submits "listingStatus"; only Live puts the item on the storefront. */
export function ListingStatusField({ defaultValue = "DRAFT" }: { defaultValue?: ListingStatus | string }) {
  const initial = (LISTING_STATUSES as readonly string[]).includes(defaultValue) ? defaultValue : "DRAFT";
  return (
    <fieldset>
      <legend className="text-sm font-medium text-charcoal">Listing status</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {LISTING_STATUSES.map((status) => (
          <label
            key={status}
            className={cn(
              "flex cursor-pointer items-start gap-2 rounded-lg border border-border-subtle bg-surface p-3 text-sm transition-colors",
              "has-[:checked]:border-gold has-[:checked]:bg-gold/10",
            )}
          >
            <input type="radio" name="listingStatus" value={status} defaultChecked={initial === status} className="mt-0.5 accent-gold" />
            <span>
              <span className="block font-medium text-charcoal">{LISTING_STATUS_LABELS[status].label}</span>
              <span className="mt-0.5 block text-xs text-charcoal/55">{LISTING_STATUS_LABELS[status].description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const BADGE_STYLES: Record<ListingStatus, string> = {
  DRAFT: "bg-charcoal/5 text-charcoal/65 border-charcoal/15",
  FINISHED: "bg-sapphire-soft/15 text-sapphire border-sapphire-soft/30",
  LIVE: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return <Badge className={BADGE_STYLES[status]}>{LISTING_STATUS_LABELS[status].label}</Badge>;
}
