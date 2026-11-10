import { Download, ExternalLink } from "lucide-react";
import { itemScanUrl } from "@/lib/item-qr";
import type { ItemKind } from "@/lib/item-number";

/** The edit page's "Item number & QR code" section: a preview of the label's
 * QR code plus PNG / SVG / printable-label downloads. The code encodes the
 * item number's scan link, not the product URL, so it survives renames. */
export function ItemQrPanel({ kind, id, itemNumber, live }: { kind: ItemKind; id: string; itemNumber: string; live: boolean }) {
  const base = `/admin/${kind === "gemstone" ? "gems" : "jewelry"}/${id}/qr`;
  const scanUrl = itemScanUrl(itemNumber);
  const downloads = [
    { format: "png", label: "PNG" },
    { format: "svg", label: "SVG" },
    { format: "label", label: "Label (with number)" },
  ];

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      {/* eslint-disable-next-line @next/next/no-img-element -- an authenticated admin route, not a static asset */}
      <img
        src={`${base}?format=svg`}
        alt={`QR code for item ${itemNumber}`}
        width={160}
        height={160}
        className="h-40 w-40 shrink-0 rounded-lg border border-border-subtle bg-white p-1"
      />
      <div className="min-w-0 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-charcoal/55">Item number</p>
          <p className="font-mono text-2xl tracking-wider text-charcoal">{itemNumber}</p>
        </div>
        <p className="text-sm text-charcoal/65">
          Scanning opens this item&apos;s product page. The code points at the item number, so it keeps working if
          the item is renamed.
          {!live && " Until the item is Live, customers who scan it get a not-found page; staff are brought here."}
        </p>
        <a href={scanUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-sm text-charcoal/70 underline decoration-charcoal/30 underline-offset-2 hover:text-gold">
          {scanUrl}
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </a>
        <div className="flex flex-wrap gap-2">
          {downloads.map((d) => (
            <a
              key={d.format}
              href={`${base}?format=${d.format}&download=1`}
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-sm text-charcoal transition-colors hover:border-gold hover:text-gold"
            >
              <Download className="h-4 w-4" aria-hidden />
              {d.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
