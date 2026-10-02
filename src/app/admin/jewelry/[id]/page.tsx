import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasStaffArea, hasMarketAccess } from "@/lib/rbac";
import { JewelryForm } from "@/components/admin/JewelryForm";
import { MediaManager } from "@/components/admin/MediaManager";
import { ArModelUploader } from "@/components/admin/ArModelUploader";
import { GemstoneLinkManager } from "@/components/admin/GemstoneLinkManager";
import { VariantManager } from "@/components/admin/VariantManager";
import { getActiveShippingWeightTiers } from "@/lib/shipping";
import { BackLink } from "@/components/admin/BackLink";

export default async function EditJewelryPage({ params }: PageProps<"/admin/jewelry/[id]">) {
  const { id } = await params;
  const [piece, gemstones, shippingWeightTiers] = await Promise.all([
    prisma.jewelryPiece.findUnique({
      where: { id },
      include: {
        media: { orderBy: { sortOrder: "asc" } },
        gemstones: { include: { gemstone: true } },
        variants: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.gemstone.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getActiveShippingWeightTiers(),
  ]);

  const user = (await auth())?.user;
  if (!piece || !user || !hasStaffArea(user, "catalog") || !hasMarketAccess(user, piece.market)) notFound();
  const staff = user.role === "STAFF";
  // Cost prices (the piece's, its variants', and any linked gemstone's)
  // never reach a STAFF member's browser, not even hidden.
  const initial = staff ? { ...piece, costPrice: null } : piece;
  const variants = staff ? piece.variants.map((v) => ({ ...v, costPrice: null })) : piece.variants;
  const links = staff ? piece.gemstones.map((l) => ({ ...l, gemstone: l.gemstone && { ...l.gemstone, costPrice: null } })) : piece.gemstones;

  return (
    <div>
      <BackLink href="/admin/jewelry" label="Back to Jewelry" />
      <h1 className="font-serif text-3xl text-charcoal">{piece.name}</h1>

      <div className="mt-6">
        <JewelryForm initial={initial} shippingWeightTiers={shippingWeightTiers} staff={staff} />
      </div>

      <div className="mt-10 max-w-2xl border-t border-border-subtle pt-8">
        <p className="font-serif text-xl text-charcoal">Media</p>
        <div className="mt-4">
          <MediaManager media={piece.media} jewelryId={piece.id} canDelete={!staff} />
        </div>
      </div>

      {(piece.pieceType === "NECKLACE" || piece.pieceType === "PENDANT") && (
        <div className="mt-10 max-w-2xl border-t border-border-subtle pt-8">
          <p className="font-serif text-xl text-charcoal">Mobile AR Try-On</p>
          <p className="mt-1 text-sm text-charcoal/60">
            Upload a 3D model to let shoppers see this piece on their own neck via their phone&apos;s camera. Pilot
            feature — only necklaces and pendants get this section.
          </p>
          <div className="mt-4">
            <ArModelUploader jewelryId={piece.id} modelUrl={piece.arModelUrl} pieceName={piece.name} />
          </div>
        </div>
      )}

      <div className="mt-10 max-w-2xl border-t border-border-subtle pt-8">
        <p className="font-serif text-xl text-charcoal">Gemstones Set In This Piece</p>
        <div className="mt-4">
          <GemstoneLinkManager jewelryId={piece.id} links={links} gemstones={gemstones} />
        </div>
      </div>

      <div className="mt-10 max-w-3xl border-t border-border-subtle pt-8">
        <p className="font-serif text-xl text-charcoal">Style / Size Variants</p>
        <p className="mt-1 text-sm text-charcoal/60">
          Optional — add one per size/style this piece comes in (e.g. &ldquo;Size 7&rdquo;, &ldquo;18-inch chain&rdquo;), each
          with its own stock. Leave empty and this piece keeps selling as a single item with the Stock Status above.
        </p>
        <div className="mt-4">
          <VariantManager jewelryId={piece.id} variants={variants} lk={piece.market === "lk"} staff={staff} />
        </div>
      </div>
    </div>
  );
}
