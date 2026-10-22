"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrCreateRetailCart } from "@/lib/retail-cart";
import { getMarket } from "@/lib/market";
import { normalizeCode, discountCodeError } from "@/lib/discount-codes";
import { checkRateLimit } from "@/lib/rate-limit";
import { getLoyaltySettings } from "@/lib/loyalty-settings";
import type { ActionResult } from "./auth";

export async function addToRetailCart(input: { gemstoneId?: string; jewelryId?: string; jewelryVariantId?: string }): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sign in required." };
  if (!input.gemstoneId && !input.jewelryId) return { ok: false, error: "No item specified." };

  const market = await getMarket();
  const cart = await getOrCreateRetailCart(session.user.id, market);

  if (input.gemstoneId) {
    const item = await prisma.gemstone.findUnique({ where: { id: input.gemstoneId } });
    // The price the customer sees on their own storefront: rupees on /lk,
    // dollars everywhere else. A piece with no price for this market is
    // quote-only there.
    const unitPrice = market === "lk" ? item?.lkrRetailPrice : item?.retailPrice;
    // A listing from the other storefront can't be bought here (the
    // catalogs don't overlap), even if someone crafts the request by hand.
    if (!item || item.market !== market || unitPrice == null) return { ok: false, error: "This item isn't available for direct purchase." };
    // Every gemstone is one-of-a-kind — there's no quantity/units field —
    // so once it's SOLD/RESERVED there's nothing left to add another unit
    // of. Re-checked again at checkout (see buildCheckoutBreakdown) for
    // the window between adding to cart and paying.
    if (item.stockStatus !== "AVAILABLE") return { ok: false, error: "This item is no longer available." };

    await prisma.retailCartItem.upsert({
      where: { cartId_gemstoneId: { cartId: cart.id, gemstoneId: input.gemstoneId } },
      // Already in the cart (a repeat "Add to Cart" click) — one-of-a-kind,
      // so there's nothing to increment; just refresh the snapshotted price.
      create: { cartId: cart.id, gemstoneId: input.gemstoneId, quantity: 1, unitPrice },
      update: { quantity: 1, unitPrice },
    });
  } else {
    const item = await prisma.jewelryPiece.findUnique({ where: { id: input.jewelryId }, include: { variants: true } });
    const basePrice = market === "lk" ? item?.lkrRetailPrice : item?.retailPrice;
    if (!item || item.market !== market || basePrice == null) return { ok: false, error: "This item isn't available for direct purchase." };

    let unitPrice = basePrice;
    let jewelryVariantId: string | null = null;
    if (item.variants.length > 0) {
      // A piece with variants sells only through one — its own stockStatus
      // is a derived summary once variants exist (see the recompute in
      // lib/orders.ts), not the real availability check.
      const variant = item.variants.find((v) => v.id === input.jewelryVariantId);
      if (!variant) return { ok: false, error: "Please choose an option." };
      if (variant.stockStatus !== "AVAILABLE") return { ok: false, error: "That option is no longer available." };
      jewelryVariantId = variant.id;
      const variantPrice = market === "lk" ? variant.lkrRetailPrice : variant.retailPrice;
      unitPrice = variantPrice ?? basePrice;
    } else if (item.stockStatus !== "AVAILABLE") {
      return { ok: false, error: "This item is no longer available." };
    }

    if (jewelryVariantId) {
      // The compound unique key requires every field non-null — usable
      // directly here since a variant purchase always has one.
      await prisma.retailCartItem.upsert({
        where: { cartId_jewelryId_jewelryVariantId: { cartId: cart.id, jewelryId: input.jewelryId!, jewelryVariantId } },
        create: { cartId: cart.id, jewelryId: input.jewelryId, jewelryVariantId, quantity: 1, unitPrice },
        update: { quantity: 1, unitPrice },
      });
    } else {
      // A plain (non-varianted) piece's line always has jewelryVariantId =
      // null, which Prisma's compound-unique input can't express (it
      // requires every field non-null) — found/updated by hand instead.
      const existing = await prisma.retailCartItem.findFirst({ where: { cartId: cart.id, jewelryId: input.jewelryId, jewelryVariantId: null } });
      if (existing) {
        await prisma.retailCartItem.update({ where: { id: existing.id }, data: { quantity: 1, unitPrice } });
      } else {
        await prisma.retailCartItem.create({ data: { cartId: cart.id, jewelryId: input.jewelryId, jewelryVariantId: null, quantity: 1, unitPrice } });
      }
    }
  }

  revalidatePath("/account/retail-cart");
  return { ok: true };
}

// Adds every item in an active Bundle to the cart in one click — each
// still becomes its own ordinary RetailCartItem (reusing addToRetailCart's
// own per-item availability checks), so the combined-price discount is
// purely a checkout-time calculation (see buildCheckoutBreakdown), not a
// new kind of cart row. A jewelry piece with variants can't be added this
// way (BundleItem has no way to say which variant) — surfaces
// addToRetailCart's own "Please choose an option" error in that case
// rather than silently skipping it.
export async function addBundleToCart(bundleId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sign in required." };

  const market = await getMarket();
  const bundle = await prisma.bundle.findUnique({ where: { id: bundleId }, include: { items: true } });
  if (!bundle || !bundle.active || bundle.market !== market) return { ok: false, error: "This bundle is no longer available." };

  for (const item of bundle.items) {
    const result = await addToRetailCart({ gemstoneId: item.gemstoneId ?? undefined, jewelryId: item.jewelryId ?? undefined });
    if (!result.ok) return result;
  }
  return { ok: true };
}

export async function removeRetailCartItem(itemId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sign in required." };

  const item = await prisma.retailCartItem.findUnique({ where: { id: itemId }, include: { cart: true } });
  if (!item || item.cart.userId !== session.user.id) return { ok: false, error: "Item not found." };

  await prisma.retailCartItem.delete({ where: { id: itemId } });
  revalidatePath("/account/retail-cart");
  return { ok: true };
}

// ---------- Discount code on the retail cart ----------
//
// Same "apply only previews, finalize is what actually redeems" split as
// the wholesale Cart's applyDiscountCode/removeDiscountCode — see
// lib/discount-codes.ts. Finalization happens in actions/checkout.ts once
// PayHere confirms payment, not here.

export async function applyRetailDiscountCode(rawCode: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sign in required." };

  // A short admin-set custom code (as few as 3 characters — see
  // generateDiscountCode) has a small enough keyspace to be guessable by
  // brute force without this; keyed by user since applying a code already
  // requires being signed in.
  const limit = await checkRateLimit(`apply-discount:${session.user.id}`, { limit: 10, windowSeconds: 10 * 60 });
  if (!limit.allowed) return { ok: false, error: "Too many attempts — please wait a few minutes and try again." };

  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, error: "Enter a code." };

  const market = await getMarket();
  const cart = await getOrCreateRetailCart(session.user.id, market);
  const cartWithItems = await prisma.retailCart.findUniqueOrThrow({ where: { id: cart.id }, include: { items: true } });
  if (cartWithItems.items.length === 0) return { ok: false, error: "Your cart is empty." };
  if (cart.discountCodeId) return { ok: false, error: "Remove the current code before applying a different one." };

  const discount = await prisma.discountCode.findUnique({ where: { code } });
  if (!discount) return { ok: false, error: "That code doesn't exist." };
  const error = discountCodeError(discount, session.user.id);
  if (error) return { ok: false, error };
  // amountOff is dollars; a code only works on the Sri Lanka store once an
  // admin has given it a rupee value.
  if (market === "lk" && discount.amountOffLkr == null) return { ok: false, error: "This code isn't valid on the Sri Lanka store." };

  await prisma.retailCart.update({ where: { id: cart.id }, data: { discountCodeId: discount.id } });
  revalidatePath("/account/retail-cart");
  return { ok: true };
}

export async function removeRetailDiscountCode(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sign in required." };

  const cart = await getOrCreateRetailCart(session.user.id, await getMarket());
  if (!cart.discountCodeId) return { ok: false, error: "No code is applied." };

  await prisma.retailCart.update({ where: { id: cart.id }, data: { discountCodeId: null } });
  revalidatePath("/account/retail-cart");
  return { ok: true };
}

// ---------- Rewards points on the retail cart ----------
//
// Same "apply only stages an amount, checkout re-clamps it against the
// live balance and the order's own cap" split as the discount code above
// — see resolvePointsRedemption in lib/rewards.ts, which is the only
// place that actually decides what's redeemable. This just soft-validates
// (so the customer isn't offered a wildly invalid number) and stores it.

export async function applyRetailPoints(rawPoints: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sign in required." };

  const points = Math.floor(Number(rawPoints));
  if (!Number.isFinite(points) || points <= 0) return { ok: false, error: "Enter a positive number of points." };

  const loyalty = await getLoyaltySettings();
  if (!loyalty.pointsEnabled) return { ok: false, error: "The rewards program is currently paused." };

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { pointsBalance: true } });
  if (!user) return { ok: false, error: "Your account could not be found — please sign in again." };
  if (points > user.pointsBalance) return { ok: false, error: "You don't have that many points." };

  const cart = await getOrCreateRetailCart(session.user.id, await getMarket());
  await prisma.retailCart.update({ where: { id: cart.id }, data: { pointsToRedeem: points } });
  revalidatePath("/account/retail-cart");
  return { ok: true };
}

export async function removeRetailPoints(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sign in required." };

  const cart = await getOrCreateRetailCart(session.user.id, await getMarket());
  await prisma.retailCart.update({ where: { id: cart.id }, data: { pointsToRedeem: 0 } });
  revalidatePath("/account/retail-cart");
  return { ok: true };
}
