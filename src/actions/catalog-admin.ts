"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStaffArea, requireMarketAccess } from "@/lib/rbac";
import { slugify } from "@/lib/utils";
import { saveCertificateFile, deleteUploadedFile } from "@/lib/media";
import { gemstoneSchema, jewelrySchema, jewelryVariantSchema } from "@/lib/validation/catalog";
import { recomputeJewelryAvailability } from "@/lib/orders";
import { parseDraftMedia, attachDraftMedia } from "@/lib/media-gallery";
import type { ActionResult } from "./auth";

function formToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

async function uniqueSlug(base: string, check: (slug: string) => Promise<boolean>) {
  const root = slugify(base) || "item";
  let slug = root;
  let n = 1;
  while (await check(slug)) {
    n += 1;
    slug = `${root}-${n}`;
  }
  return slug;
}

// Everything below that a STAFF member with the "catalog" area may do goes
// through requireStaffArea("catalog") plus a market check against the item's
// own store. What STAFF may never do, on top of the ADMIN-only actions left
// untouched (delete, feature on the homepage, remove media/certificate):
//  - see or set a cost price;
//  - change any price of an item that already exists (a new listing needs a
//    price to be valid, so they may set one when creating it).
type CatalogUser = { role: string; staffMarketScope: string | null };
const isStaffUser = (user: CatalogUser) => user.role === "STAFF";

// The listing's existing money/feature fields, as the strings a form would
// have submitted, for overwriting whatever a STAFF request sent.
function lockedFormFields(existing: {
  price: number | null;
  showPrice: boolean;
  retailPrice: number | null;
  costPrice: number | null;
  lkrRetailPrice: number | null;
  lkrPrice: number | null;
  isFeatured: boolean;
}): Record<string, string> {
  const out: Record<string, string> = { showPrice: String(existing.showPrice), isFeatured: String(existing.isFeatured) };
  for (const key of ["price", "retailPrice", "costPrice", "lkrRetailPrice", "lkrPrice"] as const) {
    const value = existing[key];
    if (value != null) out[key] = String(value);
  }
  return out;
}

const LOCKED_KEYS = ["price", "showPrice", "retailPrice", "costPrice", "lkrRetailPrice", "lkrPrice", "isFeatured"];

export async function createGemstone(formData: FormData): Promise<ActionResult> {
  const user = await requireStaffArea("catalog");
  const staff = isStaffUser(user);

  const input = formToObject(formData);
  if (staff) {
    delete input.costPrice;
    input.isFeatured = "false";
  }
  const parsed = gemstoneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid gemstone data." };

  const data = parsed.data;
  await requireMarketAccess(user, data.market);
  const lk = data.market === "lk";
  const slug = await uniqueSlug(data.name, async (s) => !!(await prisma.gemstone.findUnique({ where: { slug: s } })));

  const gem = await prisma.gemstone.create({
    data: {
      slug,
      name: data.name,
      description: data.description || undefined,
      mineralId: data.mineralId,
      variety: data.variety || undefined,
      cutId: data.cutId,
      caratWeight: data.caratWeight,
      lengthMm: data.lengthMm,
      widthMm: data.widthMm,
      depthMm: data.depthMm,
      colorHue: data.colorHue,
      colorSaturation: data.colorSaturation,
      colorLightness: data.colorLightness,
      colorLabel: data.colorLabel || undefined,
      clarityGradeId: data.clarityGradeId,
      treatmentId: data.treatmentId,
      originId: data.originId,
      symmetryNotes: data.symmetryNotes || undefined,
      polishNotes: data.polishNotes || undefined,
      certLabId: data.certLabId || undefined,
      certReportNumber: data.certReportNumber || undefined,
      certFileUrl: data.certFileUrl || undefined,
      market: data.market,
      // A listing is priced in its own store's currency only: a Sri Lanka
      // listing carries rupee prices (retail mandatory) and no dollar ones, an
      // international listing the reverse. costPrice is in that same currency.
      price: lk ? undefined : data.price,
      showPrice: lk ? false : data.showPrice,
      retailPrice: lk ? undefined : data.retailPrice,
      costPrice: data.costPrice,
      lkrRetailPrice: lk ? data.lkrRetailPrice : undefined,
      lkrPrice: lk ? data.lkrPrice : undefined,
      stockStatus: data.stockStatus,
      isPublished: data.isPublished,
      isFeatured: data.isFeatured,
      shippingWeightTierId: data.shippingWeightTierId || undefined,
      quoteShipping: data.quoteShipping,
    },
  });

  // Photos and videos added on the create form were uploaded straight to
  // storage first; attach them now, in the order the admin arranged them.
  await attachDraftMedia({ gemstoneId: gem.id }, parseDraftMedia(formData.get("mediaKeys")), data.name);

  revalidatePath("/admin/gems");
  redirect(`/admin/gems/${gem.id}`);
}

export async function updateGemstone(id: string, formData: FormData): Promise<ActionResult> {
  const user = await requireStaffArea("catalog");

  const existing = await prisma.gemstone.findUnique({
    where: { id },
    select: { market: true, price: true, showPrice: true, retailPrice: true, costPrice: true, lkrRetailPrice: true, lkrPrice: true, isFeatured: true },
  });
  if (!existing) return { ok: false, error: "Gemstone not found." };
  await requireMarketAccess(user, existing.market);
  const input = formToObject(formData);
  if (isStaffUser(user)) {
    for (const key of LOCKED_KEYS) delete input[key];
    Object.assign(input, lockedFormFields(existing));
  }
  // The store is fixed when the listing is created, so it comes from the saved
  // row — never from the form (see StoreField).
  const parsed = gemstoneSchema.safeParse({ ...input, market: existing.market });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid gemstone data." };

  const data = parsed.data;
  const lk = data.market === "lk";
  await prisma.gemstone.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || undefined,
      mineralId: data.mineralId,
      variety: data.variety || undefined,
      cutId: data.cutId,
      caratWeight: data.caratWeight,
      // Same undefined-vs-null reasoning as the price fields below — a
      // blanked dimension has to actually clear the saved value.
      lengthMm: data.lengthMm ?? null,
      widthMm: data.widthMm ?? null,
      depthMm: data.depthMm ?? null,
      colorHue: data.colorHue,
      colorSaturation: data.colorSaturation,
      colorLightness: data.colorLightness,
      colorLabel: data.colorLabel || undefined,
      clarityGradeId: data.clarityGradeId,
      treatmentId: data.treatmentId,
      originId: data.originId,
      symmetryNotes: data.symmetryNotes || undefined,
      polishNotes: data.polishNotes || undefined,
      // Unlike the other optional fields above, an empty selection here has
      // to actually clear a previously-set lab (picking "None" after having
      // picked a lab), so this uses `null` rather than `undefined` — Prisma
      // treats `undefined` as "leave the existing value alone".
      certLabId: data.certLabId || null,
      certReportNumber: data.certReportNumber || undefined,
      certFileUrl: data.certFileUrl || undefined,
      // Only the price fields of the listing's own store are used; the other
      // store's are cleared. On an update, a blank field parses to
      // `undefined` (see optionalMoney), and Prisma treats `undefined` as
      // "leave the existing value alone" — so these all coalesce to `null`
      // to make clearing the field on an existing row actually clear it.
      price: lk ? null : (data.price ?? null),
      showPrice: lk ? false : data.showPrice,
      retailPrice: lk ? null : (data.retailPrice ?? null),
      costPrice: data.costPrice ?? null,
      lkrRetailPrice: lk ? (data.lkrRetailPrice ?? null) : null,
      lkrPrice: lk ? (data.lkrPrice ?? null) : null,
      stockStatus: data.stockStatus,
      isPublished: data.isPublished,
      isFeatured: data.isFeatured,
      // Same "empty selection actually clears it" reasoning as certLabId above.
      shippingWeightTierId: data.shippingWeightTierId || null,
      quoteShipping: data.quoteShipping,
    },
  });

  revalidatePath("/admin/gems");
  revalidatePath(`/admin/gems/${id}`);
  revalidatePath("/");
  revalidatePath("/lk");
  // Covers editing an already-featured item's name/price/photo/etc, or its
  // isFeatured flag directly via this form — not just the dedicated toggle.
  revalidateTag("home-featured", { expire: 0 });
  return { ok: true };
}

export async function deleteGemstone(id: string): Promise<ActionResult> {
  await requireAdmin();
  const gemstone = await prisma.gemstone.findUnique({
    where: { id },
    include: { _count: { select: { orderItems: true, quoteRequests: true, auctions: true } } },
  });
  if (!gemstone) return { ok: false, error: "Gemstone not found." };
  const { orderItems, quoteRequests, auctions } = gemstone._count;
  if (orderItems > 0 || quoteRequests > 0 || auctions > 0) {
    return { ok: false, error: "This gemstone has order, quote, or auction history and can't be deleted — unpublish it instead." };
  }

  await prisma.gemstone.delete({ where: { id } });
  revalidatePath("/admin/gems");
  revalidatePath("/");
  revalidatePath("/lk");
  revalidateTag("home-featured", { expire: 0 });
  return { ok: true };
}

// Quick per-row toggle on the admin gems list, so curating the homepage's
// Featured Gemstones section doesn't require opening the full edit form.
export async function toggleGemstoneFeatured(id: string, featured: boolean): Promise<ActionResult> {
  await requireAdmin();
  await prisma.gemstone.update({ where: { id }, data: { isFeatured: featured } });
  revalidatePath("/admin/gems");
  revalidatePath("/");
  revalidatePath("/lk");
  // The home page's own featured-items query is cached separately (see
  // app/page.tsx) — revalidatePath alone doesn't reach into that.
  // { expire: 0 }: this Next version's revalidateTag defaults to
  // stale-while-revalidate otherwise, and an admin toggling "featured"
  // expects to see it reflected immediately, not eventually.
  revalidateTag("home-featured", { expire: 0 });
  return { ok: true };
}

export async function uploadCertificateFile(gemstoneId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireStaffArea("catalog");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "No file provided." };

  const gem = await prisma.gemstone.findUnique({ where: { id: gemstoneId }, select: { certFileUrl: true, market: true } });
  if (!gem) return { ok: false, error: "Gemstone not found." };
  await requireMarketAccess(user, gem.market);

  try {
    const saved = await saveCertificateFile(file);
    await prisma.gemstone.update({ where: { id: gemstoneId }, data: { certFileUrl: saved.url } });

    // Replacing an existing attachment — clean up the old file in storage.
    if (gem.certFileUrl) await deleteUploadedFile(gem.certFileUrl).catch(() => {});

    revalidatePath(`/admin/gems/${gemstoneId}`);
    revalidatePath("/admin/gems");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Upload failed." };
  }
}

export async function removeCertificateFile(gemstoneId: string): Promise<ActionResult> {
  await requireAdmin();

  const gem = await prisma.gemstone.findUnique({ where: { id: gemstoneId }, select: { certFileUrl: true } });
  if (!gem) return { ok: false, error: "Gemstone not found." };

  await prisma.gemstone.update({ where: { id: gemstoneId }, data: { certFileUrl: null } });

  if (gem.certFileUrl) await deleteUploadedFile(gem.certFileUrl).catch(() => {});

  revalidatePath(`/admin/gems/${gemstoneId}`);
  revalidatePath("/admin/gems");
  return { ok: true };
}

export async function createJewelry(formData: FormData): Promise<ActionResult> {
  const user = await requireStaffArea("catalog");
  const staff = isStaffUser(user);

  const input = formToObject(formData);
  if (staff) {
    delete input.costPrice;
    input.isFeatured = "false";
  }
  const parsed = jewelrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid jewelry data." };

  const data = parsed.data;
  await requireMarketAccess(user, data.market);
  const lk = data.market === "lk";
  const slug = await uniqueSlug(data.name, async (s) => !!(await prisma.jewelryPiece.findUnique({ where: { slug: s } })));

  const piece = await prisma.jewelryPiece.create({
    data: {
      slug,
      name: data.name,
      description: data.description || undefined,
      pieceType: data.pieceType,
      audience: data.audience,
      metalType: data.metalType,
      metalPurity: data.metalPurity || undefined,
      metalWeightG: data.metalWeightG,
      ringSize: data.ringSize || undefined,
      styleTags: data.styleTags ? data.styleTags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      market: data.market,
      // A listing is priced in its own store's currency only: a Sri Lanka
      // listing carries rupee prices (retail mandatory) and no dollar ones, an
      // international listing the reverse. costPrice is in that same currency.
      price: lk ? undefined : data.price,
      showPrice: lk ? false : data.showPrice,
      retailPrice: lk ? undefined : data.retailPrice,
      costPrice: data.costPrice,
      lkrRetailPrice: lk ? data.lkrRetailPrice : undefined,
      lkrPrice: lk ? data.lkrPrice : undefined,
      stockStatus: data.stockStatus,
      isPublished: data.isPublished,
      isFeatured: data.isFeatured,
      shippingWeightTierId: data.shippingWeightTierId || undefined,
      quoteShipping: data.quoteShipping,
    },
  });

  await attachDraftMedia({ jewelryId: piece.id }, parseDraftMedia(formData.get("mediaKeys")), data.name);

  revalidatePath("/admin/jewelry");
  redirect(`/admin/jewelry/${piece.id}`);
}

export async function updateJewelry(id: string, formData: FormData): Promise<ActionResult> {
  const user = await requireStaffArea("catalog");

  const existing = await prisma.jewelryPiece.findUnique({
    where: { id },
    select: { market: true, price: true, showPrice: true, retailPrice: true, costPrice: true, lkrRetailPrice: true, lkrPrice: true, isFeatured: true },
  });
  if (!existing) return { ok: false, error: "Jewelry piece not found." };
  await requireMarketAccess(user, existing.market);
  const input = formToObject(formData);
  if (isStaffUser(user)) {
    for (const key of LOCKED_KEYS) delete input[key];
    Object.assign(input, lockedFormFields(existing));
  }
  const parsed = jewelrySchema.safeParse({ ...input, market: existing.market });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid jewelry data." };

  const data = parsed.data;
  const lk = data.market === "lk";
  await prisma.jewelryPiece.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || undefined,
      pieceType: data.pieceType,
      audience: data.audience,
      metalType: data.metalType,
      metalPurity: data.metalPurity || undefined,
      // Same undefined-vs-null reasoning as the price fields below — a
      // blanked weight has to actually clear the saved value.
      metalWeightG: data.metalWeightG ?? null,
      ringSize: data.ringSize || undefined,
      styleTags: data.styleTags ? data.styleTags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      // See updateGemstone's matching comment: a blank price field parses to
      // `undefined`, which Prisma treats as "leave the existing value alone",
      // so these coalesce to `null` to make clearing the field actually clear it.
      price: lk ? null : (data.price ?? null),
      showPrice: lk ? false : data.showPrice,
      retailPrice: lk ? null : (data.retailPrice ?? null),
      costPrice: data.costPrice ?? null,
      lkrRetailPrice: lk ? (data.lkrRetailPrice ?? null) : null,
      lkrPrice: lk ? (data.lkrPrice ?? null) : null,
      stockStatus: data.stockStatus,
      isPublished: data.isPublished,
      isFeatured: data.isFeatured,
      shippingWeightTierId: data.shippingWeightTierId || null,
      quoteShipping: data.quoteShipping,
    },
  });

  revalidatePath("/admin/jewelry");
  revalidatePath(`/admin/jewelry/${id}`);
  revalidatePath("/");
  revalidatePath("/lk");
  revalidateTag("home-featured", { expire: 0 });
  return { ok: true };
}

export async function deleteJewelry(id: string): Promise<ActionResult> {
  await requireAdmin();
  const jewelry = await prisma.jewelryPiece.findUnique({
    where: { id },
    include: { _count: { select: { orderItems: true, quoteRequests: true, auctions: true } } },
  });
  if (!jewelry) return { ok: false, error: "Jewelry piece not found." };
  const { orderItems, quoteRequests, auctions } = jewelry._count;
  if (orderItems > 0 || quoteRequests > 0 || auctions > 0) {
    return { ok: false, error: "This piece has order, quote, or auction history and can't be deleted — unpublish it instead." };
  }

  await prisma.jewelryPiece.delete({ where: { id } });
  revalidatePath("/admin/jewelry");
  revalidatePath("/");
  revalidatePath("/lk");
  revalidateTag("home-featured", { expire: 0 });
  return { ok: true };
}

// Quick per-row toggle on the admin jewelry list, mirroring
// toggleGemstoneFeatured above.
export async function toggleJewelryFeatured(id: string, featured: boolean): Promise<ActionResult> {
  await requireAdmin();
  await prisma.jewelryPiece.update({ where: { id }, data: { isFeatured: featured } });
  revalidatePath("/admin/jewelry");
  revalidatePath("/");
  revalidatePath("/lk");
  revalidateTag("home-featured", { expire: 0 });
  return { ok: true };
}

export async function linkGemstoneToJewelry(jewelryId: string, gemstoneId: string | null, freeformDesc: string | null): Promise<ActionResult> {
  const user = await requireStaffArea("catalog");
  if (!gemstoneId && !freeformDesc) return { ok: false, error: "Provide a gemstone or a description." };
  const piece = await prisma.jewelryPiece.findUnique({ where: { id: jewelryId }, select: { market: true } });
  if (!piece) return { ok: false, error: "Jewelry piece not found." };
  await requireMarketAccess(user, piece.market);

  await prisma.jewelryGemstoneLink.create({
    data: { jewelryId, gemstoneId: gemstoneId || undefined, freeformDesc: freeformDesc || undefined },
  });

  revalidatePath(`/admin/jewelry/${jewelryId}`);
  return { ok: true };
}

export async function unlinkGemstoneFromJewelry(linkId: string, jewelryId: string): Promise<ActionResult> {
  const user = await requireStaffArea("catalog");
  // The piece is looked up through the link itself, not trusted from the
  // jewelryId the client sent alongside it.
  const link = await prisma.jewelryGemstoneLink.findUnique({ where: { id: linkId }, select: { jewelry: { select: { market: true } } } });
  if (!link) return { ok: false, error: "Link not found." };
  await requireMarketAccess(user, link.jewelry.market);
  await prisma.jewelryGemstoneLink.delete({ where: { id: linkId } });
  revalidatePath(`/admin/jewelry/${jewelryId}`);
  return { ok: true };
}

// ---------- Jewelry style/size variants ----------
//
// Opt-in per piece (see the schema comment on JewelryPiece.variants) —
// only reachable from an already-saved piece's own edit page, same as
// MediaManager/GemstoneLinkManager above.

export async function createJewelryVariant(jewelryId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireStaffArea("catalog");
  const piece = await prisma.jewelryPiece.findUnique({ where: { id: jewelryId }, select: { market: true } });
  if (!piece) return { ok: false, error: "Jewelry piece not found." };
  await requireMarketAccess(user, piece.market);

  const input = formToObject(formData);
  // STAFF never sets prices on a variant: it just inherits the piece's own.
  if (isStaffUser(user)) {
    delete input.retailPrice;
    delete input.lkrRetailPrice;
    delete input.costPrice;
  }
  const parsed = jewelryVariantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid variant data." };

  const data = parsed.data;
  const lk = piece.market === "lk";
  const sortOrder = await prisma.jewelryVariant.count({ where: { jewelryId } });
  await prisma.jewelryVariant.create({
    data: {
      jewelryId,
      label: data.label,
      retailPrice: lk ? undefined : data.retailPrice,
      lkrRetailPrice: lk ? data.lkrRetailPrice : undefined,
      costPrice: data.costPrice,
      stockStatus: data.stockStatus,
      sortOrder,
    },
  });
  await recomputeJewelryAvailability(prisma, [jewelryId]);

  revalidatePath(`/admin/jewelry/${jewelryId}`);
  revalidatePath("/admin/jewelry");
  return { ok: true };
}

export async function updateJewelryVariant(variantId: string, jewelryId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireStaffArea("catalog");
  // The piece is taken from the variant itself, not the client-sent
  // jewelryId, so a variant can't be edited through a piece in a store the
  // caller is allowed to touch.
  const variant = await prisma.jewelryVariant.findUnique({ where: { id: variantId }, select: { jewelry: { select: { id: true, market: true } } } });
  if (!variant) return { ok: false, error: "Variant not found." };
  const piece = variant.jewelry;
  await requireMarketAccess(user, piece.market);

  const parsed = jewelryVariantSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid variant data." };

  const data = parsed.data;
  const lk = piece.market === "lk";
  await prisma.jewelryVariant.update({
    where: { id: variantId },
    data: {
      label: data.label,
      // STAFF can rename a variant and change its stock, never its prices
      // (undefined leaves the saved value alone).
      ...(isStaffUser(user)
        ? {}
        : {
            // Same "empty selection actually clears it" reasoning as
            // updateGemstone's certLabId — a blank override here has to fall
            // back to the piece's own price, not silently keep a stale one.
            retailPrice: lk ? null : (data.retailPrice ?? null),
            lkrRetailPrice: lk ? (data.lkrRetailPrice ?? null) : null,
            costPrice: data.costPrice ?? null,
          }),
      stockStatus: data.stockStatus,
    },
  });
  await recomputeJewelryAvailability(prisma, [jewelryId]);

  revalidatePath(`/admin/jewelry/${jewelryId}`);
  revalidatePath("/admin/jewelry");
  return { ok: true };
}

export async function deleteJewelryVariant(variantId: string, jewelryId: string): Promise<ActionResult> {
  await requireAdmin();
  const variant = await prisma.jewelryVariant.findUnique({ where: { id: variantId }, include: { _count: { select: { orderItems: true } } } });
  if (!variant) return { ok: false, error: "Variant not found." };
  if (variant._count.orderItems > 0) {
    return { ok: false, error: "This variant has order history and can't be deleted — mark it Sold instead." };
  }

  await prisma.jewelryVariant.delete({ where: { id: variantId } });
  await recomputeJewelryAvailability(prisma, [jewelryId]);

  revalidatePath(`/admin/jewelry/${jewelryId}`);
  revalidatePath("/admin/jewelry");
  return { ok: true };
}

export type CatalogKind = "gemstone" | "jewelry";

/**
 * Bulk-publish or bulk-hide a batch of catalog items at once — e.g.
 * clearing a run of newly-sold items off the storefront without opening
 * each one's edit form. Never touches stockStatus/isFeatured; those keep
 * their own dedicated per-item controls (StockBadge, ToggleFeaturedButton
 * respectively), this is purely about storefront visibility.
 */
export async function bulkSetCatalogPublished(kind: CatalogKind, ids: string[], isPublished: boolean): Promise<ActionResult> {
  const user = await requireStaffArea("catalog");
  if (ids.length === 0) return { ok: false, error: "Nothing selected." };

  // Every selected item must be in a store the caller may touch — checked
  // per item, never assumed from the list they were looking at.
  const rows = kind === "gemstone"
    ? await prisma.gemstone.findMany({ where: { id: { in: ids } }, select: { market: true } })
    : await prisma.jewelryPiece.findMany({ where: { id: { in: ids } }, select: { market: true } });
  for (const row of rows) await requireMarketAccess(user, row.market);

  if (kind === "gemstone") {
    await prisma.gemstone.updateMany({ where: { id: { in: ids } }, data: { isPublished } });
    revalidatePath("/admin/gems");
  } else {
    await prisma.jewelryPiece.updateMany({ where: { id: { in: ids } }, data: { isPublished } });
    revalidatePath("/admin/jewelry");
  }
  revalidatePath("/");
  revalidatePath("/lk");
  revalidateTag("home-featured", { expire: 0 });
  return { ok: true };
}
