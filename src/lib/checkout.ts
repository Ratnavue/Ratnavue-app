import { prisma } from "@/lib/prisma";
import { getCommerceSettings } from "@/lib/commerce-settings";
import { resolveShippingRate } from "@/lib/shipping";
import { getActivePromotionMaps } from "@/lib/promotion-items";
import { isBirthdayEligible } from "@/lib/birthday-promo";
import { resolvePointsRedemption } from "@/lib/rewards";
import type { Market } from "@/lib/market-shared";
import type { PaymentMethod } from "@prisma/client";

const SRI_LANKA_NAMES = new Set(["sri lanka", "srilanka", "lk", "ceylon"]);

export function isSriLanka(country: string): boolean {
  return SRI_LANKA_NAMES.has(country.trim().toLowerCase());
}

export interface CheckoutLineItem {
  gemstoneId: string | null;
  jewelryId: string | null;
  jewelryVariantId: string | null;
  label: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface CheckoutBreakdown {
  // "LKR" on the Sri Lanka store (/lk), where every amount is already in
  // rupees — its own per-item lkrRetailPrice, the LKR shipping rate used
  // as-is, LKR discount codes — with no conversion anywhere. On the
  // international site it's "USD" — the catalog's own canonical currency (see the
  // retailPrice field comment in schema.prisma). Orders are charged
  // directly in USD through PayHere (which settles USD/EUR/GBP/AUD as
  // well as LKR) rather than this app pre-converting to LKR itself: a
  // Sri Lankan customer's card issuer converts USD to LKR at the card
  // network's own real-time rate when the charge settles, the same way
  // it would for any other international USD purchase — that's a better
  // rate than a manually-updated admin setting could ever track. Kept as
  // its own field (not hardcoded "USD" at every call site) so a future
  // customer-facing currency choice (EUR/GBP/AUD) is a config change, not
  // a schema one.
  currency: "USD" | "LKR";
  market: Market;
  discountCodeId: string | null;
  items: CheckoutLineItem[];
  subtotal: number;
  birthdayDiscount: number;
  birthdayEligible: boolean;
  codeDiscount: number;
  /** Sum of every matching Bundle's discount — see Bundle's own schema
   * comment for how a bundle "applies" (no new cart/order line type). */
  bundleDiscount: number;
  pointsRedeemed: number;
  pointsDiscount: number;
  tax: number;
  shipping: number;
  shippingZoneLabel: string;
  /** The configured free-shipping threshold in this order's own currency,
   * or null when the admin hasn't set one — lets the cart/checkout UI show
   * a "spend $X more for free shipping" nudge. */
  freeShippingThreshold: number | null;
  /** How much more the customer needs to add to the cart to clear
   * freeShippingThreshold — 0 once they qualify or when no threshold is
   * configured. */
  amountToFreeShipping: number;
  /** At least one cart item is marked quoteShipping — shipping was
   * charged as $0 for it (see the per-item loop below), so the resulting
   * Order needs Order.shippingToBeArranged set. */
  shippingToBeArranged: boolean;
  /** The points redemption covers more than the order's actual profit
   * margin (summed per-item retailPrice - costPrice, same basis as the
   * birthday discount above it) — flags the resulting Order for admin
   * review rather than blocking checkout; see Order.needsPointsApproval. */
  needsPointsApproval: boolean;
  handlingFee: number;
  total: number;
  /** CommerceSettings' current COD deposit rule, passed through so
   * initiateRetailCheckout can compute Order.codDepositRequired/
   * codDepositAmount without a second DB round-trip. Present
   * unconditionally — meaningless outside paymentMethod COD / market lk,
   * same as every other field here that's currency/market-specific. */
  codDepositThresholdLkr: number;
  codDepositPercent: number;
}

// The one place retail pricing math happens — used both to preview the
// checkout page's breakdown and, immediately before creating the Order
// row, to compute the exact amount PayHere is told to charge. Always
// re-reads live retailPrice/costPrice rather than trusting the cart's
// stored snapshot (RetailCartItem.unitPrice), so a cart never checks out
// at a stale price.
//
// `market` picks which cart (one per market — see RetailCart.market) and
// which price columns are read; `paymentMethod` decides whether the card
// gateway's commission/handling margin is added (bank transfer and cash on
// delivery carry no gateway, so no fee).
export async function buildCheckoutBreakdown(input: {
  userId: string;
  shippingCountry: string;
  market?: Market;
  paymentMethod?: PaymentMethod;
}): Promise<CheckoutBreakdown> {
  const market = input.market ?? "intl";
  const lk = market === "lk";
  const [cart, settings, user, promotions] = await Promise.all([
    prisma.retailCart.findUnique({
      where: { userId_market: { userId: input.userId, market } },
      include: {
        items: { include: { gemstone: { include: { shippingWeightTier: true } }, jewelry: { include: { shippingWeightTier: true } }, jewelryVariant: true } },
        discountCode: true,
      },
    }),
    getCommerceSettings(),
    prisma.user.findUniqueOrThrow({ where: { id: input.userId } }),
    getActivePromotionMaps(market),
  ]);
  if (!cart || cart.items.length === 0) throw new Error("Your cart is empty.");

  // Every gemstone/jewelry piece in this catalog is one-of-a-kind — no
  // quantity/units field exists anywhere (see StockStatus) — so this has
  // to be a live re-check, not something trusted from whenever the item
  // was added to the cart. Catches both a genuine sale to someone else in
  // the meantime and an admin manually pulling the item. Thrown here
  // (rather than returning a partial breakdown) so this is the single
  // gate every path to creating an Order goes through — see
  // initiateRetailCheckout, which surfaces this message as-is.
  // A varianted line's real availability/price is its own variant's — the
  // parent piece's own fields are only a derived summary once it has any
  // (see lib/orders.ts's recompute of JewelryPiece.stockStatus).
  const unavailable = cart.items
    .filter((item) => (item.jewelryVariant?.stockStatus ?? (item.gemstone ?? item.jewelry)?.stockStatus) !== "AVAILABLE")
    .map((item) => item.gemstone?.name ?? item.jewelry?.name ?? "An item");
  if (unavailable.length > 0) {
    const subject = unavailable.join(", ");
    throw new Error(`${subject} ${unavailable.length === 1 ? "is" : "are"} no longer available — please remove ${unavailable.length === 1 ? "it" : "them"} from your cart to continue.`);
  }

  // A piece with no rupee price can't be bought on the Sri Lanka store
  // (it's "Request a Quote" there) — normally it can't get into an LK cart
  // in the first place, but an admin can clear a price after it was added.
  if (lk) {
    const unpriced = cart.items
      .filter((item) => (item.jewelryVariant?.lkrRetailPrice ?? (item.gemstone ?? item.jewelry)?.lkrRetailPrice) == null)
      .map((item) => item.gemstone?.name ?? item.jewelry?.name ?? "An item");
    if (unpriced.length > 0) {
      throw new Error(`${unpriced.join(", ")} can't be bought online in rupees right now — please remove ${unpriced.length === 1 ? "it" : "them"} from your cart or request a quote.`);
    }
  }

  // VAT is about the shipping *destination* (Sri Lankan domestic supply
  // vs. a zero-rated export), independent of which currency the charge
  // itself is made in.
  const domestic = isSriLanka(input.shippingCountry);
  const birthdayEligible = isBirthdayEligible(user);

  let subtotal = 0;
  let birthdayDiscount = 0;
  // Summed regardless of birthday eligibility/promo status — this is the
  // order's actual profit margin, used only to gate points redemption
  // below, not to compute any discount itself.
  let totalProfit = 0;
  const items: CheckoutLineItem[] = cart.items.map((item) => {
    const product = item.gemstone ?? item.jewelry;
    const variant = item.jewelryVariant;
    const unitPrice = lk
      ? (variant?.lkrRetailPrice ?? product!.lkrRetailPrice!)
      : (variant?.retailPrice ?? product?.retailPrice ?? item.unitPrice);
    const name = item.gemstone?.name ?? item.jewelry?.name ?? "Item";
    const label = variant ? `${name} — ${variant.label}` : name;
    const lineTotal = unitPrice * item.quantity;
    subtotal += lineTotal;

    const isPromotional = item.gemstoneId
      ? promotions.gemstonePrices.has(item.gemstoneId)
      : item.jewelryId
        ? promotions.jewelryPrices.has(item.jewelryId)
        : false;
    // costPrice is recorded in the listing's own currency (rupees for a Sri
    // Lanka listing, dollars for an international one), so it lines up with
    // the price without any conversion.
    const costPrice = variant?.costPrice ?? product?.costPrice ?? null;
    if (costPrice != null) {
      const profit = Math.max(0, unitPrice - costPrice);
      totalProfit += profit * item.quantity;
      if (birthdayEligible && !isPromotional) {
        birthdayDiscount += profit * (settings.birthdayDiscountPercent / 100) * item.quantity;
      }
    }

    return { gemstoneId: item.gemstoneId, jewelryId: item.jewelryId, jewelryVariantId: item.jewelryVariantId, label, unitPrice, quantity: item.quantity, lineTotal };
  });

  // A code only counts on /lk if the admin gave it a rupee value.
  const discountCode = cart.discountCode && (!lk || cart.discountCode.amountOffLkr != null) ? cart.discountCode : null;
  const codeDiscount = lk ? (discountCode?.amountOffLkr ?? 0) : (discountCode?.amountOff ?? 0);

  // Bundle discounts: any active Bundle whose every member item is present
  // in this cart gets a discount equal to what those items would cost
  // individually minus the bundle's own combined price — applied as a
  // straight discount, the same mechanism as a discount code, not a new
  // cart/order line type (see Bundle's own schema comment). Sorted by
  // sortOrder so an item claimed by one matching bundle can't also count
  // toward a second, overlapping one — admin curation is trusted not to
  // build genuinely overlapping bundles, the same trust level this schema
  // already gives other admin-only exclusivity rules (e.g.
  // shippingWeightTierId/quoteShipping above).
  const activeBundles = await prisma.bundle.findMany({
    where: { market, active: true },
    orderBy: { sortOrder: "asc" },
    include: { items: true },
  });
  let bundleDiscount = 0;
  const claimedItemIds = new Set<string>();
  for (const bundle of activeBundles) {
    const memberIds = bundle.items.map((i) => i.gemstoneId ?? i.jewelryId).filter((id): id is string => !!id);
    if (memberIds.length < 2) continue; // malformed — never discount for free
    const eligible = memberIds.every(
      (id) => items.some((li) => li.gemstoneId === id || li.jewelryId === id) && !claimedItemIds.has(id),
    );
    if (!eligible) continue;
    // One unit's worth per member item, even if the cart holds more than
    // one of something — a bundle discounts the combo itself, not extra
    // quantity bought alongside it.
    const combinedPrice = memberIds.reduce((sum, id) => {
      const line = items.find((li) => li.gemstoneId === id || li.jewelryId === id)!;
      return sum + line.unitPrice;
    }, 0);
    bundleDiscount += Math.max(0, combinedPrice - bundle.price);
    for (const id of memberIds) claimedItemIds.add(id);
  }

  const afterCodeDiscounts = Math.max(0, subtotal - birthdayDiscount - codeDiscount - bundleDiscount);

  // Rewards points staged on the cart, re-clamped against the live
  // balance and the order's own cap — never trusted as still affordable
  // just because it was staged earlier (see resolvePointsRedemption).
  const { points: pointsRedeemed, discount: pointsDiscount } = await resolvePointsRedemption({
    requestedPoints: cart.pointsToRedeem,
    availableBalance: user.pointsBalance,
    orderableAmount: afterCodeDiscounts,
    currency: lk ? "LKR" : "USD",
  });
  const afterDiscounts = Math.max(0, afterCodeDiscounts - pointsDiscount);
  // An item with no costPrice recorded contributes nothing to totalProfit
  // (same treatment as the birthday discount above) — deliberately
  // conservative: an unknown margin counts as $0 profit here, so it's
  // more likely to flag for review, not less.
  const needsPointsApproval = pointsDiscount > 0 && pointsDiscount > totalProfit;

  // Per item: quoteShipping contributes nothing (flagged separately
  // below instead — see Order.shippingToBeArranged), an assigned weight
  // tier contributes its own flat rate instead of the destination rate,
  // and anything with neither falls under the single destination-based
  // zone rate below (charged once for the whole order, not per item,
  // same as before either of these existed).
  let tieredShippingRateLKR = 0;
  let hasUntieredItem = false;
  let shippingToBeArranged = false;
  for (const item of cart.items) {
    const product = item.gemstone ?? item.jewelry;
    if (product?.quoteShipping) {
      shippingToBeArranged = true;
    } else if (product?.shippingWeightTier) {
      tieredShippingRateLKR += product.shippingWeightTier.ratePerOrderLKR * item.quantity;
    } else {
      hasUntieredItem = true;
    }
  }

  // The only remaining currency conversion in this app: EMS's own rate
  // card (and the weight tiers above, same convention) is denominated in
  // LKR (see lib/shipping.ts), so on the international site that figure
  // alone gets converted into USD here to fold into an otherwise all-USD
  // total — CommerceSettings.usdToLkrRate exists for this (and the /lk
  // birthday-discount cost above), not for pricing the order itself. On
  // /lk it's already in the right currency.
  // Waives only the destination-zone rate on the untiered portion of the
  // order — a weight-tiered item already carries its own deliberate flat
  // rate (usually for something heavy/oversized) and isn't affected by
  // this threshold either way.
  const freeShippingThreshold = lk ? settings.freeShippingThresholdLkr : settings.freeShippingThresholdUsd;
  const qualifiesForFreeShipping = freeShippingThreshold != null && subtotal >= freeShippingThreshold;
  const amountToFreeShipping = freeShippingThreshold != null ? Math.max(0, freeShippingThreshold - subtotal) : 0;

  const { zoneLabel: shippingZoneLabel, rateLKR: zoneRateLKR } = await resolveShippingRate(input.shippingCountry);
  const shippingRateLKR = tieredShippingRateLKR + (hasUntieredItem && !qualifiesForFreeShipping ? zoneRateLKR : 0);
  const shipping = lk ? shippingRateLKR : shippingRateLKR / settings.usdToLkrRate;

  const tax = domestic || settings.applyVatToInternational ? afterDiscounts * (settings.vatPercent / 100) : 0;

  const gatewayCharged = afterDiscounts + tax + shipping;
  const chargesGatewayFee = (input.paymentMethod ?? "PAYHERE_CARD") === "PAYHERE_CARD";
  const handlingFee = chargesGatewayFee
    ? gatewayCharged * ((settings.gatewayCommissionPercent + settings.handlingFeeMarginPercent) / 100)
    : 0;
  const total = gatewayCharged + handlingFee;

  return {
    currency: lk ? "LKR" : "USD",
    market,
    discountCodeId: discountCode?.id ?? null,
    items,
    subtotal,
    birthdayDiscount,
    birthdayEligible,
    codeDiscount,
    bundleDiscount,
    pointsRedeemed,
    pointsDiscount,
    tax,
    shipping,
    shippingZoneLabel,
    freeShippingThreshold,
    amountToFreeShipping,
    shippingToBeArranged,
    needsPointsApproval,
    handlingFee,
    total,
    codDepositThresholdLkr: settings.codDepositThresholdLkr,
    codDepositPercent: settings.codDepositPercent,
  };
}
