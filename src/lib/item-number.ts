// Item numbers and listing statuses for gemstones and jewelry. Pure and
// client-safe — the numbers themselves are assigned by the database (see the
// itemNumber column default in prisma/schema.prisma), never here.

export type ItemKind = "gemstone" | "jewelry";

export const LISTING_STATUSES = ["DRAFT", "FINISHED", "LIVE"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_STATUS_LABELS: Record<ListingStatus, { label: string; description: string }> = {
  DRAFT: { label: "Draft", description: "Still being entered. Not on the storefront." },
  FINISHED: { label: "Finished", description: "Complete and checked, but not on the storefront yet." },
  LIVE: { label: "Live", description: "On the storefront for customers to see." },
};

/** isPublished is derived from the status — only a live listing is public. */
export function isLiveStatus(status: ListingStatus): boolean {
  return status === "LIVE";
}

const PREFIX_KIND: Record<string, ItemKind> = { G: "gemstone", J: "jewelry" };

/**
 * Reads an item number the way people (and scanners) actually type it:
 * "G-000123", "g000123", "G 123" and "G-123" all mean the same item. Returns
 * the canonical "G-000123" form and which catalog it belongs to, or null if
 * it isn't an item number at all.
 */
export function parseItemNumber(raw: string): { kind: ItemKind; itemNumber: string } | null {
  const match = /^([GJ])[\s-]*0*(\d{1,9})$/.exec(decodeURIComponentSafe(raw).trim().toUpperCase());
  if (!match) return null;
  const digits = match[2];
  if (Number(digits) === 0) return null;
  return { kind: PREFIX_KIND[match[1]], itemNumber: `${match[1]}-${digits.padStart(6, "0")}` };
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** The path a printed QR label points at (see app/i/[itemNumber]). */
export function itemScanPath(itemNumber: string): string {
  return `/i/${itemNumber}`;
}
