"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateShippingZone, deleteShippingZone } from "@/actions/shipping-zones";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { Input, Label } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CARD_TR, CARD_TD, CARD_FIRST, CARD_SECOND, CARD_TD_ACTIONS } from "@/components/admin/responsive-table";

interface ShippingZone {
  id: string;
  label: string;
  countries: string[];
  isFallback: boolean;
  ratePerOrderLKR: number;
  active: boolean;
}

export function ShippingZoneRow({ zone }: { zone: ShippingZone }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isFallback, setIsFallback] = useState(zone.isFallback);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  async function handleSave(formData: FormData) {
    await updateShippingZone(zone.id, formData);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <tr className={CARD_TR}>
        <td className={`${CARD_FIRST} text-charcoal`}>
          {zone.label}
          {zone.isFallback && <span className="ml-2 rounded-full bg-charcoal/5 px-2 py-0.5 text-[11px] text-charcoal/50">Fallback</span>}
        </td>
        <td data-label="Countries" className={`${CARD_TD} text-charcoal/70`}>{zone.isFallback ? "Any unlisted country" : zone.countries.join(", ") || "—"}</td>
        <td data-label="Rate" className={`${CARD_TD} text-charcoal/70`}>Rs. {zone.ratePerOrderLKR.toLocaleString()}</td>
        <td data-label="Status" className={`${CARD_SECOND} text-charcoal/70`}>{zone.active ? "Active" : "Inactive"}</td>
        <td className={`${CARD_TD_ACTIONS} space-x-3`}>
          <button className="text-xs text-gold underline" onClick={() => setEditing(true)}>Edit</button>
          <button
            className="text-xs text-red-700 underline"
            disabled={pending}
            onClick={async () => {
              if (await confirm(`Delete "${zone.label}"?`, { confirmLabel: "Delete", danger: true })) startTransition(async () => { await deleteShippingZone(zone.id); router.refresh(); });
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
      <td colSpan={5} className="px-4 py-4 max-lg:block">
        <form action={handleSave} className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <div>
            <Label htmlFor={`label-${zone.id}`}>Label</Label>
            <Input id={`label-${zone.id}`} name="label" defaultValue={zone.label} required />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor={`countries-${zone.id}`}>Countries (comma-separated)</Label>
            <Input
              id={`countries-${zone.id}`}
              name="countries"
              defaultValue={zone.countries.join(", ")}
              disabled={isFallback}
              placeholder={isFallback ? "Matches any unlisted country" : "e.g. India, Pakistan"}
            />
          </div>
          <div>
            <Label htmlFor={`rate-${zone.id}`}>Rate (LKR)</Label>
            <Input id={`rate-${zone.id}`} name="ratePerOrderLKR" type="number" step="0.01" min="0" defaultValue={zone.ratePerOrderLKR} required />
          </div>
          <label className="flex items-center gap-2 text-sm text-charcoal/75">
            <input
              type="checkbox"
              checked={isFallback}
              onChange={(e) => setIsFallback(e.target.checked)}
              className="accent-gold"
            />
            Fallback zone (matches any country not listed elsewhere)
          </label>
          <label className="flex items-center gap-2 text-sm text-charcoal/75">
            <input type="checkbox" name="active" defaultChecked={zone.active} className="accent-gold" />
            Active
          </label>
          <input type="hidden" name="isFallback" value={isFallback ? "true" : "false"} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="gold">Save</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      </td>
    </tr>
  );
}
