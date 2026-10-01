"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateShippingWeightTier, deleteShippingWeightTier } from "@/actions/shipping-weight-tiers";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { Input, Label } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CARD_TR, CARD_TD, CARD_FIRST, CARD_SECOND, CARD_TD_ACTIONS } from "@/components/admin/responsive-table";

interface WeightTier {
  id: string;
  label: string;
  ratePerOrderLKR: number;
  active: boolean;
}

export function ShippingWeightTierRow({ tier }: { tier: WeightTier }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  async function handleSave(formData: FormData) {
    await updateShippingWeightTier(tier.id, formData);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <tr className={CARD_TR}>
        <td className={`${CARD_FIRST} text-charcoal`}>{tier.label}</td>
        <td data-label="Rate" className={`${CARD_TD} text-charcoal/70`}>Rs. {tier.ratePerOrderLKR.toLocaleString()}</td>
        <td data-label="Status" className={`${CARD_SECOND} text-charcoal/70`}>{tier.active ? "Active" : "Inactive"}</td>
        <td className={`${CARD_TD_ACTIONS} space-x-3`}>
          <button className="text-xs text-gold underline" onClick={() => setEditing(true)}>Edit</button>
          <button
            className="text-xs text-red-700 underline"
            disabled={pending}
            onClick={async () => {
              if (
                await confirm(`Delete "${tier.label}"? Any item using it falls back to the normal destination-based rate.`, {
                  confirmLabel: "Delete",
                  danger: true,
                })
              ) {
                startTransition(async () => {
                  await deleteShippingWeightTier(tier.id);
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
      <td colSpan={4} className="px-4 py-4 max-lg:block">
        <form action={handleSave} className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <div>
            <Label htmlFor={`wt-label-${tier.id}`}>Label</Label>
            <Input id={`wt-label-${tier.id}`} name="label" defaultValue={tier.label} required />
          </div>
          <div>
            <Label htmlFor={`wt-rate-${tier.id}`}>Rate (LKR)</Label>
            <Input id={`wt-rate-${tier.id}`} name="ratePerOrderLKR" type="number" step="0.01" min="0" defaultValue={tier.ratePerOrderLKR} required />
          </div>
          <label className="flex items-center gap-2 text-sm text-charcoal/75">
            <input type="checkbox" name="active" defaultChecked={tier.active} className="accent-gold" />
            Active
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="gold">Save</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      </td>
    </tr>
  );
}
