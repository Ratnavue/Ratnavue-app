"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { createOrderFromSourcing } from "@/lib/orders";
import { slugify } from "@/lib/utils";
import { quickCreateGemstoneSchema, quickCreateJewelrySchema } from "@/lib/validation/catalog";
import { sourcingOrderSchema } from "@/lib/validation/orders";
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

export interface QuickCreatedItem {
  kind: "gemstone" | "jewelry";
  id: string;
  name: string;
}

export type QuickCreateResult = { ok: true; item: QuickCreatedItem } | { ok: false; error: string };

// A private, one-off catalog record for something being sourced that
// isn't in the catalog yet — isPublished: false so it never shows up in
// normal browsing/search; the customer only ever reaches it through the
// order this sourcing request produces (see createOrderFromSourcing),
// never a public product-page URL. Priced only through that order's own
// OrderItem.unitPrice, not through retailPrice/lkrRetailPrice.
export async function quickCreateGemstoneForSourcing(formData: FormData): Promise<QuickCreateResult> {
  await requireAdmin();
  const parsed = quickCreateGemstoneSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the item details." };
  const data = parsed.data;

  const mineral = await prisma.mineral.findUnique({ where: { id: data.mineralId } });
  if (!mineral) return { ok: false, error: "Select a mineral." };

  const slug = await uniqueSlug(data.name, async (s) => !!(await prisma.gemstone.findUnique({ where: { slug: s } })));
  const gem = await prisma.gemstone.create({
    data: {
      slug,
      name: data.name,
      description: data.description || undefined,
      mineralId: data.mineralId,
      cutId: data.cutId,
      caratWeight: data.caratWeight,
      // The midpoint of the mineral's own hue range — good enough for a
      // private one-off record that's never browsed/filtered by colour;
      // an admin can always refine it later from the full edit form.
      colorHue: Math.round(((mineral.hueMin ?? 0) + (mineral.hueMax ?? 360)) / 2),
      colorSaturation: 72,
      colorLightness: 50,
      clarityGradeId: data.clarityGradeId,
      treatmentId: data.treatmentId,
      originId: data.originId,
      market: "intl",
      stockStatus: "AVAILABLE",
      listingStatus: "DRAFT",
      isPublished: false,
    },
  });

  revalidatePath("/admin/gems");
  return { ok: true, item: { kind: "gemstone", id: gem.id, name: gem.name } };
}

export async function quickCreateJewelryForSourcing(formData: FormData): Promise<QuickCreateResult> {
  await requireAdmin();
  const parsed = quickCreateJewelrySchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the item details." };
  const data = parsed.data;

  const slug = await uniqueSlug(data.name, async (s) => !!(await prisma.jewelryPiece.findUnique({ where: { slug: s } })));
  const piece = await prisma.jewelryPiece.create({
    data: {
      slug,
      name: data.name,
      description: data.description || undefined,
      pieceType: data.pieceType,
      metalType: data.metalType,
      market: "intl",
      stockStatus: "AVAILABLE",
      listingStatus: "DRAFT",
      isPublished: false,
    },
  });

  revalidatePath("/admin/jewelry");
  return { ok: true, item: { kind: "jewelry", id: piece.id, name: piece.name } };
}

export async function createSourcingOrderAction(sourcingRequestId: string, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = sourcingOrderSchema.safeParse({ items: formData.get("items") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  const result = await createOrderFromSourcing(sourcingRequestId, admin.id, parsed.data.items);
  if (!result.ok) return result;

  revalidatePath("/admin/sourcing");
  revalidatePath(`/admin/sourcing/${sourcingRequestId}`);
  revalidatePath("/admin/orders");
  return { ok: true, redirectTo: `/admin/orders/${result.orderId}` };
}
