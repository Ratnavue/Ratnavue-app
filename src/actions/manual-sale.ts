"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { createManualSaleOrder } from "@/lib/orders";
import { saveCertificateFile } from "@/lib/media";
import { manualSaleSchema } from "@/lib/validation/orders";
import type { Market } from "@/lib/market-shared";
import type { ActionResult } from "./auth";

export interface CatalogSearchVariant {
  id: string;
  label: string;
  price: number | null;
}

export interface CatalogSearchResult {
  kind: "gemstone" | "jewelry";
  id: string;
  name: string;
  price: number | null;
  variants: CatalogSearchVariant[];
}

// Backs the item picker in ManualSaleForm — only AVAILABLE items in the
// chosen market are offered, same "can't sell what isn't there" rule
// createManualSaleOrder re-checks server-side before actually recording
// the sale.
export async function searchAvailableCatalogItems(market: Market, query: string): Promise<CatalogSearchResult[]> {
  await requireAdmin();
  const q = query.trim();
  if (q.length < 2) return [];

  const [gems, pieces] = await Promise.all([
    prisma.gemstone.findMany({
      where: { market, stockStatus: "AVAILABLE", name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, retailPrice: true, lkrRetailPrice: true },
      take: 8,
    }),
    prisma.jewelryPiece.findMany({
      where: { market, stockStatus: "AVAILABLE", name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, retailPrice: true, lkrRetailPrice: true, variants: { orderBy: { sortOrder: "asc" } } },
      take: 8,
    }),
  ]);

  const lk = market === "lk";
  return [
    ...gems.map((g): CatalogSearchResult => ({ kind: "gemstone", id: g.id, name: g.name, price: lk ? g.lkrRetailPrice : g.retailPrice, variants: [] })),
    ...pieces.map((p): CatalogSearchResult => {
      const basePrice = lk ? p.lkrRetailPrice : p.retailPrice;
      return {
        kind: "jewelry",
        id: p.id,
        name: p.name,
        price: basePrice,
        variants: p.variants
          .filter((v) => v.stockStatus === "AVAILABLE")
          .map((v) => ({ id: v.id, label: v.label, price: (lk ? v.lkrRetailPrice : v.retailPrice) ?? basePrice })),
      };
    }),
  ];
}

export interface CustomerLookup {
  id: string;
  name: string | null;
  email: string;
}

export async function findCustomerByEmail(email: string): Promise<CustomerLookup | null> {
  await requireAdmin();
  const trimmed = email.trim();
  if (!trimmed) return null;
  return prisma.user.findUnique({ where: { email: trimmed }, select: { id: true, name: true, email: true } });
}

export async function createManualSaleOrderAction(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = manualSaleSchema.safeParse({
    customerUserId: formData.get("customerUserId"),
    market: formData.get("market"),
    items: formData.get("items"),
    paymentMethod: formData.get("paymentMethod"),
    paymentReference: formData.get("paymentReference") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const data = parsed.data;

  let receiptUrl: string | undefined;
  if (data.paymentMethod === "WIRE_TRANSFER") {
    const receiptFile = formData.get("receipt") as File | null;
    if (!receiptFile || receiptFile.size === 0) return { ok: false, error: "Attach a receipt file for a bank-transfer sale." };
    try {
      receiptUrl = (await saveCertificateFile(receiptFile)).url;
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Couldn't upload the receipt." };
    }
  }

  const result = await createManualSaleOrder({
    customerUserId: data.customerUserId,
    market: data.market,
    items: data.items,
    paymentMethod: data.paymentMethod,
    paymentReference: data.paymentReference || undefined,
    receiptUrl,
  });
  if (!result.ok) return result;

  revalidatePath("/admin/orders");
  return { ok: true, redirectTo: `/admin/orders/${result.orderId}` };
}
