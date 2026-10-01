import { prisma } from "@/lib/prisma";
import { MineralRow } from "@/components/admin/MineralRow";
import { CreateMineralForm } from "@/components/admin/CreateMineralForm";
import { BackLink } from "@/components/admin/BackLink";
import { CARD_TABLE, CARD_THEAD, CARD_TBODY } from "@/components/admin/responsive-table";

export default async function AdminMineralsPage() {
  const minerals = await prisma.mineral.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Minerals</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        Hue ranges constrain the colour picker in the gem configurator and admin gemstone form.
      </p>

      <div className="mt-6">
        <CreateMineralForm />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className={CARD_TABLE}>
          <thead className={CARD_THEAD}>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-charcoal/65">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Hue Range</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className={CARD_TBODY}>
            {minerals.map((m) => <MineralRow key={m.id} mineral={m} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
