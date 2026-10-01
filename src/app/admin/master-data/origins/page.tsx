import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createOrigin, toggleOriginActive } from "@/actions/master-data";
import { CreateSimpleForm } from "@/components/admin/CreateSimpleForm";
import { ToggleActiveButton } from "@/components/admin/ToggleActiveButton";
import { BackLink } from "@/components/admin/BackLink";
import { CARD_TABLE, CARD_THEAD, CARD_TBODY, CARD_TR, CARD_TD, CARD_FIRST, CARD_SECOND, CARD_TD_ACTIONS } from "@/components/admin/responsive-table";

export default async function AdminOriginsPage() {
  const origins = await prisma.origin.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Origins</h1>
      <p className="mt-1 text-sm text-charcoal/60">Ceylon origin is called out prominently across the storefront.</p>

      <div className="mt-6">
        <CreateSimpleForm
          action={createOrigin}
          label="Add Origin"
          placeholder="E.g. Madagascar"
          extraField={{ name: "isCeylon", label: "Is Ceylon origin" }}
        />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className={CARD_TABLE}>
          <thead className={CARD_THEAD}>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-charcoal/65">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Ceylon</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className={CARD_TBODY}>
            {origins.map((o) => (
              <tr key={o.id} className={CARD_TR}>
                <td className={`${CARD_FIRST} text-charcoal`}>{o.name}</td>
                <td data-label="Ceylon" className={`${CARD_TD} text-charcoal/70`}>{o.isCeylon ? "Yes" : "No"}</td>
                <td data-label="Status" className={`${CARD_SECOND} text-charcoal/70`}>{o.active ? "Active" : "Inactive"}</td>
                <td className={CARD_TD_ACTIONS}>
                  <div className="flex flex-wrap items-center gap-3">
                    <ToggleActiveButton active={o.active} onToggle={toggleOriginActive.bind(null, o.id)} />
                    <Link href={`/admin/master-data/origins/${o.id}`} className="text-xs text-charcoal/60 underline-offset-2 hover:text-charcoal hover:underline">
                      Edit content
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
