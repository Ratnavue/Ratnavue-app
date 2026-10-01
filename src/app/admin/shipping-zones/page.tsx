import { getShippingZones, getShippingWeightTiers } from "@/lib/shipping";
import { ShippingZoneRow } from "@/components/admin/ShippingZoneRow";
import { CreateShippingZoneForm } from "@/components/admin/CreateShippingZoneForm";
import { ShippingWeightTierRow } from "@/components/admin/ShippingWeightTierRow";
import { CreateShippingWeightTierForm } from "@/components/admin/CreateShippingWeightTierForm";
import { BackLink } from "@/components/admin/BackLink";
import { CARD_TABLE, CARD_THEAD, CARD_TBODY } from "@/components/admin/responsive-table";

export default async function AdminShippingZonesPage() {
  const [zones, weightTiers] = await Promise.all([getShippingZones(), getShippingWeightTiers()]);

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Shipping Zones</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        Flat EMS rate per order by destination — there&apos;s no public EMS rate API, so these are seeded with
        placeholder figures. Update them with your real rate card. Exactly one zone should be the fallback, matched
        when a shipping country isn&apos;t listed anywhere else.
      </p>

      <div className="mt-6">
        <CreateShippingZoneForm />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className={CARD_TABLE}>
          <thead className={CARD_THEAD}>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-charcoal/65">
              <th className="px-4 py-3">Zone</th>
              <th className="px-4 py-3">Countries</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className={CARD_TBODY}>
            {zones.map((z) => <ShippingZoneRow key={z.id} zone={z} />)}
            {zones.length === 0 && (
              <tr className="max-lg:block"><td colSpan={5} className="px-4 py-8 text-center text-charcoal/65 max-lg:block">No shipping zones yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-12 font-serif text-2xl text-charcoal">Weight Tiers</h2>
      <p className="mt-1 text-sm text-charcoal/60">
        A flat rate for a specific item, by weight rather than destination — assign one from a gem or jewelry piece&apos;s
        edit form and it replaces the zone rate above for that item at checkout. Leave an item without one and it keeps
        using the zone rate as before.
      </p>

      <div className="mt-6">
        <CreateShippingWeightTierForm />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className={CARD_TABLE}>
          <thead className={CARD_THEAD}>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-charcoal/65">
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className={CARD_TBODY}>
            {weightTiers.map((t) => <ShippingWeightTierRow key={t.id} tier={t} />)}
            {weightTiers.length === 0 && (
              <tr className="max-lg:block"><td colSpan={4} className="px-4 py-8 text-center text-charcoal/65 max-lg:block">No weight tiers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
