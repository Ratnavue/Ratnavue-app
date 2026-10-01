import { prisma } from "@/lib/prisma";
import { CreateCertLabForm } from "@/components/admin/CreateCertLabForm";
import { CertLabRow } from "@/components/admin/CertLabRow";
import { BackLink } from "@/components/admin/BackLink";
import { CARD_TABLE, CARD_THEAD, CARD_TBODY } from "@/components/admin/responsive-table";

export default async function AdminCertificationLabsPage() {
  const labs = await prisma.certificationLab.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Certification Labs</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        Gemological labs available on the gemstone form. A lab with a logo shows a &ldquo;Certified&rdquo; badge on
        that gem&apos;s public page; add a verification URL for any lab with a public report-lookup tool and a
        &ldquo;Verify Certificate&rdquo; link appears there automatically too.
      </p>

      <div className="mt-6">
        <CreateCertLabForm />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className={CARD_TABLE}>
          <thead className={CARD_THEAD}>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-charcoal/65">
              <th className="px-4 py-3">Logo</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Verification URL</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className={CARD_TBODY}>
            {labs.map((lab) => <CertLabRow key={lab.id} lab={lab} />)}
          </tbody>
        </table>
        {labs.length === 0 && <p className="px-4 py-8 text-center text-sm text-charcoal/50">No labs added yet.</p>}
      </div>
    </div>
  );
}
