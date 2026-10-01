import { prisma } from "@/lib/prisma";
import { createTreatment, toggleTreatmentActive } from "@/actions/master-data";
import { CreateSimpleForm } from "@/components/admin/CreateSimpleForm";
import { ToggleActiveButton } from "@/components/admin/ToggleActiveButton";
import { BackLink } from "@/components/admin/BackLink";
import { CARD_TABLE, CARD_THEAD, CARD_TBODY, CARD_TR, CARD_FIRST, CARD_SECOND, CARD_TD_ACTIONS } from "@/components/admin/responsive-table";

export default async function AdminTreatmentsPage() {
  const treatments = await prisma.treatment.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Treatments</h1>
      <p className="mt-1 text-sm text-charcoal/60">Disclosed prominently on every gemstone — treatment transparency matters to buyers.</p>

      <div className="mt-6">
        <CreateSimpleForm action={createTreatment} label="Add Treatment" placeholder="E.g. Diffusion" />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className={CARD_TABLE}>
          <thead className={CARD_THEAD}>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-charcoal/65">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className={CARD_TBODY}>
            {treatments.map((t) => (
              <tr key={t.id} className={CARD_TR}>
                <td className={`${CARD_FIRST} text-charcoal`}>{t.name}</td>
                <td data-label="Status" className={`${CARD_SECOND} text-charcoal/70`}>{t.active ? "Active" : "Inactive"}</td>
                <td className={CARD_TD_ACTIONS}>
                  <ToggleActiveButton active={t.active} onToggle={toggleTreatmentActive.bind(null, t.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
