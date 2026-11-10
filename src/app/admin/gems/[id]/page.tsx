import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasStaffArea, hasMarketAccess } from "@/lib/rbac";
import { getMasterData } from "@/lib/catalog";
import { getActiveShippingWeightTiers } from "@/lib/shipping";
import { GemstoneForm } from "@/components/admin/GemstoneForm";
import { MediaManager } from "@/components/admin/MediaManager";
import { CertificateManager } from "@/components/admin/CertificateManager";
import { BackLink } from "@/components/admin/BackLink";
import { ItemQrPanel } from "@/components/admin/ItemQrPanel";
import { ListingStatusBadge } from "@/components/admin/ListingStatusField";

export default async function EditGemstonePage({ params }: PageProps<"/admin/gems/[id]">) {
  const { id } = await params;
  const [gem, masterData, shippingWeightTiers] = await Promise.all([
    prisma.gemstone.findUnique({ where: { id }, include: { media: { orderBy: { sortOrder: "asc" } }, specialtyTags: { select: { id: true } } } }),
    getMasterData(),
    getActiveShippingWeightTiers(),
  ]);

  const user = (await auth())?.user;
  if (!gem || !user || !hasStaffArea(user, "catalog") || !hasMarketAccess(user, gem.market)) notFound();
  const staff = user.role === "STAFF";
  // Cost price never reaches a STAFF member's browser, not even hidden.
  const initial = staff ? { ...gem, costPrice: null } : gem;

  return (
    <div>
      <BackLink href="/admin/gems" label="Back to Gemstones" />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl text-charcoal">{gem.name}</h1>
        <ListingStatusBadge status={gem.listingStatus} />
      </div>

      <section className="mt-6 max-w-3xl rounded-xl border border-border-subtle bg-surface p-5">
        <p className="font-serif text-xl text-charcoal">Item Number &amp; QR Code</p>
        <div className="mt-4">
          <ItemQrPanel kind="gemstone" id={gem.id} itemNumber={gem.itemNumber} live={gem.listingStatus === "LIVE"} />
        </div>
      </section>

      <div className="mt-6">
        <GemstoneForm
          minerals={masterData.minerals}
          cuts={masterData.cuts}
          clarityGrades={masterData.clarityGrades}
          treatments={masterData.treatments}
          origins={masterData.origins}
          certificationLabs={masterData.certificationLabs}
          specialties={masterData.specialties}
          shippingWeightTiers={shippingWeightTiers}
          initial={initial}
          staff={staff}
        />
      </div>

      <div className="mt-10 border-t border-border-subtle pt-8">
        <p className="font-serif text-xl text-charcoal">Media</p>
        <div className="mt-4">
          <MediaManager media={gem.media} gemstoneId={gem.id} canDelete={!staff} />
        </div>
      </div>

      <div className="mt-10 border-t border-border-subtle pt-8">
        <p className="font-serif text-xl text-charcoal">Certificate File</p>
        <p className="mt-1 text-sm text-charcoal/60">
          Attach a scan or photo of the lab report itself, separate from the online verification link above.
        </p>
        <div className="mt-4">
          <CertificateManager gemstoneId={gem.id} certFileUrl={gem.certFileUrl} canRemove={!staff} />
        </div>
      </div>
    </div>
  );
}
