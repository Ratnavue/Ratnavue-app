import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CatalogView } from "@/lib/useCatalogView";

export function ViewToggle({ view, onChange }: { view: CatalogView; onChange: (view: CatalogView) => void }) {
  return (
    <div className="inline-flex items-center rounded-full border border-border-subtle bg-surface p-1">
      {(
        [
          { value: "grid" as const, label: "Grid view", Icon: LayoutGrid },
          { value: "list" as const, label: "List view", Icon: List },
        ]
      ).map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={cn(
            "flex items-center justify-center rounded-full p-2 transition-colors",
            view === value ? "bg-action text-action-ink" : "text-charcoal/65 hover:text-charcoal"
          )}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}
