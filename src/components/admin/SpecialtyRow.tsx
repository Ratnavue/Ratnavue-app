"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSpecialty, deleteSpecialty } from "@/actions/master-data";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { Input, Textarea, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CARD_TR, CARD_TD, CARD_FIRST, CARD_TD_ACTIONS } from "@/components/admin/responsive-table";

interface Specialty {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
  gemCount: number;
}

export function SpecialtyRow({ specialty }: { specialty: Specialty }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  async function handleSave(formData: FormData) {
    setError(null);
    setSaving(true);
    const result = await updateSpecialty(specialty.id, formData);
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
        <td className={`${CARD_FIRST} text-charcoal`}>{specialty.name}</td>
        <td data-label="Description" className={`${CARD_TD} text-charcoal/70`}>{specialty.description || "—"}</td>
        <td data-label="Gems" className={`${CARD_TD} text-charcoal/70`}>{specialty.gemCount}</td>
        <td data-label="Order" className={`${CARD_TD} text-charcoal/70`}>{specialty.sortOrder}</td>
        <td data-label="Status" className={CARD_TD}>
          {specialty.active ? (
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Active</Badge>
          ) : (
            <Badge className="border-charcoal/15 bg-charcoal/5 text-charcoal/65">Hidden</Badge>
          )}
        </td>
        <td className={`${CARD_TD_ACTIONS} space-x-3`}>
          <button className="text-xs text-gold underline" onClick={() => setEditing(true)}>Edit</button>
          {/* A plain onClick, not inside a <form action> — the confirm dialog
              never opens from within a form action. */}
          <button
            className="text-xs text-red-700 underline"
            disabled={pending}
            onClick={async () => {
              const used = specialty.gemCount > 0 ? ` It will be removed from ${specialty.gemCount} gem${specialty.gemCount === 1 ? "" : "s"}.` : "";
              if (await confirm(`Delete "${specialty.name}"?${used}`, { confirmLabel: "Delete", danger: true })) {
                startTransition(async () => {
                  await deleteSpecialty(specialty.id);
                  router.refresh();
                });
              }
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
      <td colSpan={6} className="px-4 py-4 max-lg:block">
        <form action={handleSave} className="grid gap-3 sm:grid-cols-4">
          <div>
            <Input name="name" defaultValue={specialty.name} required aria-label="Name" />
          </div>
          <div className="sm:col-span-2">
            <Textarea name="description" defaultValue={specialty.description ?? ""} aria-label="Description" placeholder="Shown beside its checkbox on the gem form" />
          </div>
          <div>
            <Input name="sortOrder" type="number" defaultValue={specialty.sortOrder} aria-label="Sort order" />
          </div>
          <label className="flex items-center gap-2 text-sm text-charcoal/75 sm:col-span-4">
            <input type="hidden" name="active" value="false" />
            <input type="checkbox" name="active" value="true" defaultChecked={specialty.active} className="accent-gold" />
            Active (offered on the gem form and shown on the storefront)
          </label>
          <div className="flex gap-2 sm:col-span-4">
            <Button type="submit" size="sm" variant="gold" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
          <FieldError className="sm:col-span-4">{error ?? undefined}</FieldError>
        </form>
      </td>
    </tr>
  );
}
