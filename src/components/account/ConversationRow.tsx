import Link from "@/components/ui/MarketLink";
import { Headset, PenTool, Search, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatWhen, type ConversationKind, type ConversationRowData } from "@/lib/account-hub";

const KIND_META: Record<ConversationKind, { label: string; icon: typeof Headset }> = {
  support: { label: "Support", icon: Headset },
  quote: { label: "Quote", icon: FileText },
  design: { label: "Custom design", icon: PenTool },
  sourcing: { label: "Sourcing", icon: Search },
};

/** One line of the conversation list — used on the messages page and, trimmed
 * down, in the overview's "Messages" panel. */
export function ConversationRow({ item, active }: { item: ConversationRowData; active?: boolean }) {
  const { label, icon: Icon } = KIND_META[item.kind];
  return (
    <Link
      href={item.href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex items-start gap-3 border-b border-border-subtle px-4 py-3 transition-colors last:border-0 hover:bg-ivory-soft",
        active && "bg-gold/10",
        !active && item.unread > 0 && "bg-gold/5",
      )}
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-charcoal/5 text-charcoal/60">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-sm text-charcoal", item.unread > 0 ? "font-semibold" : "font-medium")}>{item.title}</span>
          {item.when && <span className="shrink-0 text-[11px] text-charcoal/65">{formatWhen(item.when)}</span>}
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-xs text-charcoal/60">{item.preview ?? `${label} · no messages yet`}</span>
          {item.unread > 0 && (
            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-medium text-night">
              {item.unread > 9 ? "9+" : item.unread}
            </span>
          )}
        </span>
        <span className="mt-1 inline-block rounded-full bg-charcoal/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-charcoal/65">{label}</span>
      </span>
    </Link>
  );
}
