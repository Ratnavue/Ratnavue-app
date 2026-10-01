import { prisma } from "@/lib/prisma";
import { toggleCutActive } from "@/actions/master-data";
import { ToggleActiveButton } from "@/components/admin/ToggleActiveButton";
import { BackLink } from "@/components/admin/BackLink";
import { CARD_TABLE, CARD_THEAD, CARD_TBODY, CARD_TR, CARD_TD, CARD_FIRST, CARD_SECOND, CARD_TD_ACTIONS } from "@/components/admin/responsive-table";

export default async function AdminCutsPage() {
  const cuts = await prisma.cut.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Cuts</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        This is the fixed set of 18 standard gem cuts. You can enable or disable which ones are selectable, but new
        cuts aren&apos;t added here — the list is intentionally closed to keep the configurator and catalog consistent.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className={CARD_TABLE}>
          <thead className={CARD_THEAD}>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-charcoal/65">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className={CARD_TBODY}>
            {cuts.map((cut) => (
              <tr key={cut.id} className={CARD_TR}>
                <td className={`${CARD_FIRST} text-charcoal`}>{cut.name}</td>
                <td data-label="Category" className={`${CARD_TD} text-charcoal/70`}>{cut.category === "FACETED" ? "Faceted" : "Cabochon"}</td>
                <td data-label="Status" className={`${CARD_SECOND} text-charcoal/70`}>{cut.active ? "Active" : "Inactive"}</td>
                <td className={CARD_TD_ACTIONS}>
                  <ToggleActiveButton active={cut.active} onToggle={toggleCutActive.bind(null, cut.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
