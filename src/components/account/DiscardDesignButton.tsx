"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { discardMyDesign } from "@/actions/design-studio";
import { useConfirm } from "@/components/providers/ConfirmProvider";

export function DiscardDesignButton({ designId, designName }: { designId: string; designName: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    startTransition(async () => {
      if (!(await confirm(`Discard "${designName}"? This can't be undone.`))) return;
      const result = await discardMyDesign(designId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        title="Discard this sketch"
        className="rounded p-1.5 text-charcoal/40 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
      >
        <Trash2 size={14} />
      </button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
