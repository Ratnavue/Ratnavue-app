"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateClarityGrade, deleteClarityGrade } from "@/actions/master-data";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { Input, Textarea, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CARD_TR, CARD_TD, CARD_FIRST, CARD_TD_ACTIONS } from "@/components/admin/responsive-table";

interface Grade {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  active: boolean;
}

export function ClarityRow({ grade }: { grade: Grade }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  async function handleSave(formData: FormData) {
    setError(null);
    setSaving(true);
    const result = await updateClarityGrade(grade.id, formData);
    setSaving(false);
    if (result && !result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <tr className={CARD_TR}>
        <td className={`${CARD_FIRST} text-charcoal`}>{grade.name}</td>
        <td data-label="Description" className={`${CARD_TD} text-charcoal/70`}>{grade.description}</td>
        <td data-label="Order" className={`${CARD_TD} text-charcoal/70`}>{grade.sortOrder}</td>
        <td className={`${CARD_TD_ACTIONS} space-x-3`}>
          <button className="text-xs text-gold underline" onClick={() => setEditing(true)}>Edit</button>
          <button
            className="text-xs text-red-700 underline"
            disabled={pending}
            onClick={async () => {
              if (await confirm(`Delete "${grade.name}"?`, { confirmLabel: "Delete", danger: true })) startTransition(async () => { await deleteClarityGrade(grade.id); router.refresh(); });
            }}
          >
            Delete
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border-subtle bg-ivory-soft last:border-0 max-lg:block">
      <td colSpan={4} className="px-4 py-4 max-lg:block">
        {/* No sm:items-end — see CreateClarityForm for why: it bottom-aligns
            grid items, and the Description textarea's extra height drags
            the shorter Name/Sort Order inputs down out of line with it. */}
        <form action={handleSave} className="grid gap-3 sm:grid-cols-4">
          <div>
            <Input name="name" defaultValue={grade.name} required />
          </div>
          <div className="sm:col-span-2">
            <Textarea name="description" defaultValue={grade.description} required />
          </div>
          <div>
            <Input name="sortOrder" type="number" defaultValue={grade.sortOrder} />
          </div>
          <div className="flex gap-2 sm:col-span-4">
            <Button type="submit" size="sm" variant="gold" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
          <input type="hidden" name="active" value={grade.active ? "true" : "false"} />
          <FieldError className="sm:col-span-4">{error ?? undefined}</FieldError>
        </form>
      </td>
    </tr>
  );
}
