import { prisma } from "@/lib/prisma";
import { SpecialtyRow } from "@/components/admin/SpecialtyRow";
import { CreateSpecialtyForm } from "@/components/admin/CreateSpecialtyForm";
import { BackLink } from "@/components/admin/BackLink";
import { CARD_TABLE, CARD_THEAD, CARD_TBODY } from "@/components/admin/responsive-table";

export default async function AdminSpecialtiesPage() {
  const specialties = await prisma.specialty.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { gemstones: true } } },
  });

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Specialities</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        Optical phenomena and other speciality tags — colour change, star, cat&apos;s eye and the like. Tick them on a
        gemstone&apos;s form; they show as gold tags on its card and product page. Hide one to stop offering it without
        removing it from the gems that already have it.
      </p>

      <div className="mt-6">
        <CreateSpecialtyForm />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className={CARD_TABLE}>
          <thead className={CARD_THEAD}>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-charcoal/65">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Gems</th>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className={CARD_TBODY}>
            {specialties.map((s) => (
              <SpecialtyRow key={s.id} specialty={{ ...s, gemCount: s._count.gemstones }} />
            ))}
            {specialties.length === 0 && (
              <tr className="max-lg:block">
                <td colSpan={6} className="px-4 py-8 text-center text-charcoal/65 max-lg:block">No specialities yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
