import { z } from "zod";
import { PIECE_TYPES } from "@/lib/gem-constants";

// Coerces the "true"/"false" STRING an HTML checkbox form submits (via
// the hidden-false + checkbox-true pattern every boolean toggle on these
// admin forms uses) into an actual boolean. z.coerce.boolean() can't be
// used here: it coerces via JS's Boolean(), and Boolean("false") is
// true — any non-empty string is truthy — so it would silently coerce
// every "unchecked" submission back to true regardless of the checkbox's
// real state.
function formBoolean(defaultValue: boolean) {
  return z.preprocess((v) => v === "true" || v === true, z.boolean()).default(defaultValue);
}

// A blank number input submits "" — which z.coerce.number() turns into 0,
// silently turning "no price" into "$0, buy now" (price/retailPrice/costPrice
// included — clearing retailPrice to go back to quote-only must leave it
// genuinely null, not 0, which addToRetailCart's `!= null` check would treat
// as a valid, free purchase price). Every money field on these forms uses
// this instead of a bare z.coerce.number() so blank means unset.
const optionalMoney = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number().min(0).max(1_000_000_000).optional(),
);

// Same "blank must mean unset, not 0" guard as optionalMoney — these
// dimension/weight fields have no free-purchase stakes, but a cleared
// field silently becoming "0mm"/"0g" instead of staying unset is still
// wrong data (and on an update, see the `?? null` coalescing in
// updateGemstone/updateJewelry for why blank also has to actually clear
// the saved value, not just avoid becoming 0).
function optionalMeasurement(max: number) {
  return z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().min(0).max(max).optional(),
  );
}

const listingMarket = z.enum(["intl", "lk"]).default("intl");

// A listing belongs to exactly one storefront, and a Sri Lanka listing must be
// priced in rupees: every Sri Lanka listing is buyable at a shown LKR price.
function requireLkPrice(data: { market: "intl" | "lk"; lkrRetailPrice?: number }, ctx: z.RefinementCtx) {
  if (data.market === "lk" && !(data.lkrRetailPrice && data.lkrRetailPrice > 0)) {
    ctx.addIssue({ code: "custom", path: ["lkrRetailPrice"], message: "A Sri Lanka listing needs a retail price in LKR." });
  }
}

// At most one shipping override at a time — a weight tier (a specific
// flat rate) and quoteShipping (no fixed rate at all, arranged after
// purchase) don't mean anything together.
function requireExclusiveShippingOverride(data: { shippingWeightTierId?: string; quoteShipping: boolean }, ctx: z.RefinementCtx) {
  if (data.shippingWeightTierId && data.quoteShipping) {
    ctx.addIssue({ code: "custom", path: ["quoteShipping"], message: "Choose a weight tier or Quote Shipping, not both." });
  }
}

export const gemstoneSchema = z.object({
  name: z.string().min(2).max(150),
  description: z.string().max(4000).optional().or(z.literal("")),
  mineralId: z.string().min(1, "Select a mineral"),
  variety: z.string().max(100).optional().or(z.literal("")),
  cutId: z.string().min(1, "Select a cut"),
  caratWeight: z.coerce.number().min(0.01).max(500),
  lengthMm: optionalMeasurement(200),
  widthMm: optionalMeasurement(200),
  depthMm: optionalMeasurement(200),
  colorHue: z.coerce.number().min(0).max(360),
  colorSaturation: z.coerce.number().min(0).max(100).default(72),
  colorLightness: z.coerce.number().min(0).max(100).default(50),
  colorLabel: z.string().max(100).optional().or(z.literal("")),
  clarityGradeId: z.string().min(1, "Select a clarity grade"),
  treatmentId: z.string().min(1, "Select a treatment"),
  originId: z.string().min(1, "Select an origin"),
  symmetryNotes: z.string().max(500).optional().or(z.literal("")),
  polishNotes: z.string().max(500).optional().or(z.literal("")),
  certLabId: z.string().optional().or(z.literal("")),
  certReportNumber: z.string().max(100).optional().or(z.literal("")),
  certFileUrl: z.string().max(500).optional().or(z.literal("")),
  price: optionalMoney,
  showPrice: formBoolean(false),
  retailPrice: optionalMoney,
  costPrice: optionalMoney,
  market: listingMarket,
  lkrRetailPrice: optionalMoney,
  lkrPrice: optionalMoney,
  stockStatus: z.enum(["AVAILABLE", "RESERVED", "SOLD"]).default("AVAILABLE"),
  isPublished: formBoolean(true),
  isFeatured: formBoolean(false),
  shippingWeightTierId: z.string().optional().or(z.literal("")),
  quoteShipping: formBoolean(false),
}).superRefine(requireLkPrice).superRefine(requireExclusiveShippingOverride);

export type GemstoneInput = z.infer<typeof gemstoneSchema>;

export const jewelrySchema = z.object({
  name: z.string().min(2).max(150),
  description: z.string().max(4000).optional().or(z.literal("")),
  pieceType: z.enum(PIECE_TYPES),
  audience: z.enum(["WOMEN", "MEN", "COUPLE", "UNISEX"]).default("UNISEX"),
  metalType: z.enum(["GOLD", "WHITE_GOLD", "ROSE_GOLD", "PLATINUM", "SILVER"]),
  metalPurity: z.string().max(30).optional().or(z.literal("")),
  metalWeightG: optionalMeasurement(2000),
  ringSize: z.string().max(20).optional().or(z.literal("")),
  styleTags: z.string().max(300).optional().or(z.literal("")), // comma-separated in the form
  price: optionalMoney,
  showPrice: formBoolean(false),
  retailPrice: optionalMoney,
  costPrice: optionalMoney,
  market: listingMarket,
  lkrRetailPrice: optionalMoney,
  lkrPrice: optionalMoney,
  stockStatus: z.enum(["AVAILABLE", "RESERVED", "SOLD"]).default("AVAILABLE"),
  isPublished: formBoolean(true),
  isFeatured: formBoolean(false),
  shippingWeightTierId: z.string().optional().or(z.literal("")),
  quoteShipping: formBoolean(false),
}).superRefine(requireLkPrice).superRefine(requireExclusiveShippingOverride);

export type JewelryInput = z.infer<typeof jewelrySchema>;

// A style/size variant's optional overrides — same "blank means inherit
// the parent piece's own value" convention as the piece's own price
// fields; only the field for the piece's own market is ever used (the
// action decides which, same as createJewelry/updateJewelry).
export const jewelryVariantSchema = z.object({
  label: z.string().min(1, "Enter a label, e.g. \"Size 7\"").max(100),
  retailPrice: optionalMoney,
  costPrice: optionalMoney,
  lkrRetailPrice: optionalMoney,
  stockStatus: z.enum(["AVAILABLE", "RESERVED", "SOLD"]).default("AVAILABLE"),
});

export type JewelryVariantInput = z.infer<typeof jewelryVariantSchema>;

// A minimal catalog record for a one-off item an admin creates on the fly
// while building a sourcing order (actions/sourcing-order.ts) — private
// (isPublished: false) and priced only through that order's own
// OrderItem.unitPrice, not through the usual retailPrice/lkrRetailPrice
// fields. Skips everything the full gemstone/jewelry forms collect beyond
// what the schema actually requires (Gemstone still needs a real
// mineral/cut/clarity/treatment/origin/caratWeight — those columns are
// NOT NULL and describe what the stone actually is, so they can't be
// waived just because this is a quick add).
export const quickCreateGemstoneSchema = z.object({
  name: z.string().min(2).max(150),
  description: z.string().max(2000).optional().or(z.literal("")),
  mineralId: z.string().min(1, "Select a mineral"),
  cutId: z.string().min(1, "Select a cut"),
  caratWeight: z.coerce.number().min(0.01).max(500),
  clarityGradeId: z.string().min(1, "Select a clarity grade"),
  treatmentId: z.string().min(1, "Select a treatment"),
  originId: z.string().min(1, "Select an origin"),
});

export type QuickCreateGemstoneInput = z.infer<typeof quickCreateGemstoneSchema>;

// Jewelry has far fewer required columns (pieceType/metalType are enums
// with sensible defaults), so this one really is just name + description.
export const quickCreateJewelrySchema = z.object({
  name: z.string().min(2).max(150),
  description: z.string().max(2000).optional().or(z.literal("")),
  pieceType: z.enum(["RING", "NECKLACE", "EARRINGS", "BRACELET", "PENDANT", "BROOCH", "OTHER"]).default("OTHER"),
  metalType: z.enum(["GOLD", "WHITE_GOLD", "ROSE_GOLD", "PLATINUM", "SILVER"]).default("GOLD"),
});

export type QuickCreateJewelryInput = z.infer<typeof quickCreateJewelrySchema>;

export const mineralSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().or(z.literal("")),
  hueMin: z.coerce.number().min(0).max(360),
  hueMax: z.coerce.number().min(0).max(360),
  active: formBoolean(true),
});

export const clarityGradeSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(2).max(300),
  sortOrder: z.coerce.number().min(0).max(100).default(0),
  active: formBoolean(true),
});

export const simpleMasterDataSchema = z.object({
  name: z.string().min(2).max(100),
  active: formBoolean(true),
});

export const certLabSchema = z.object({
  name: z.string().min(2).max(100),
  // The lab's general website (e.g. a homepage link on its logo badge) —
  // separate from verifyUrlTemplate below, which is a specific per-report
  // lookup URL, not every lab has one, and this one doesn't need {certId}.
  websiteUrl: z.string().max(500).url("Enter a full URL, e.g. https://www.gia.edu").optional().or(z.literal("")),
  // Must contain the literal token `{certId}` if present — checked so a
  // template without it (which would silently produce a broken link for
  // every gem) is rejected at save time instead of at render time.
  verifyUrlTemplate: z
    .string()
    .max(500)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || v.includes("{certId}"), {
      message: "The verification URL must contain the {certId} placeholder.",
    }),
  active: formBoolean(true),
});
