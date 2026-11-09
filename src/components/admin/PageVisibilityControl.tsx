"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPageVisibility } from "@/actions/page-visibility";
import type { PageVisibilityKey, PageVisibilityState } from "@/lib/page-visibility";
import { Label, FieldError } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

const OPTIONS: { value: PageVisibilityState; label: string; description: string }[] = [
  { value: "HIDDEN", label: "Hidden", description: "The page doesn't exist publicly — visiting it 404s." },
  { value: "COMING_SOON", label: "Coming Soon", description: "A themed teaser shows, without the real content yet." },
  { value: "LIVE", label: "Live", description: "The real page, fully visible." },
];

// Reusable across every page gated by PageVisibility — the seasonal
// promotions page today, the auction page next — so each one doesn't
// need its own copy of this control.
export function PageVisibilityControl({ pageKey, currentState }: { pageKey: PageVisibilityKey; currentState: PageVisibilityState }) {
  const router = useRouter();
  const [state, setState] = useState(currentState);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleChange(next: PageVisibilityState) {
    setError(null);
    startTransition(async () => {
      const result = await setPageVisibility(pageKey, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setState(next);
      router.refresh();
    });
  }

  return (
    <div>
      <Label>Page Visibility</Label>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={pending}
            onClick={() => handleChange(opt.value)}
            title={opt.description}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition-colors disabled:opacity-50",
              state === opt.value ? "border-charcoal bg-night text-cream" : "border-border-subtle text-charcoal/70 hover:border-charcoal/40",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-charcoal/50">{OPTIONS.find((o) => o.value === state)?.description}</p>
      <FieldError>{error ?? undefined}</FieldError>
    </div>
  );
}
