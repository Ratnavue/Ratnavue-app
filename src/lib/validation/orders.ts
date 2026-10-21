import { z } from "zod";

export const shipOrderSchema = z.object({
  carrier: z.string().min(1, "Enter a carrier").max(100),
  trackingNumber: z.string().min(1, "Enter a tracking number").max(100),
  trackingUrl: z.string().url("Enter a valid URL").max(500).optional().or(z.literal("")),
});

export type ShipOrderInput = z.infer<typeof shipOrderSchema>;

// Who's actually collecting cash at the door for a COD order — every
// field optional (an admin may only know some of this yet), and a blank
// value clears whatever was there before (see setCodDeliveryDetails).
export const codDeliveryDetailsSchema = z.object({
  agentName: z.string().max(100).optional().or(z.literal("")),
  agentReference: z.string().max(100).optional().or(z.literal("")),
  trackingUrl: z.string().url("Enter a valid URL").max(500).optional().or(z.literal("")),
});

export type CodDeliveryDetailsInput = z.infer<typeof codDeliveryDetailsSchema>;

// Shared by every admin form that builds an order line-by-line from
// catalog items (manual sales, sourcing orders): which item, and the
// price actually agreed for it — not necessarily the catalog's own
// listed price.
const orderLineItemSchema = z
  .object({
    gemstoneId: z.string().optional(),
    jewelryId: z.string().optional(),
    jewelryVariantId: z.string().optional(),
    unitPrice: z.coerce.number().min(0).max(10_000_000),
  })
  .refine((i) => !!i.gemstoneId || !!i.jewelryId, { message: "Every line needs a gemstone or jewelry item." });

// A JSON-encoded array of orderLineItemSchema rows — the form builds a
// dynamic list client-side (ManualSaleForm, SourcingOrderBuilder) rather
// than individual FormData fields.
const orderItemsJson = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}, z.array(orderLineItemSchema).min(1, "Add at least one item"));

export const manualSaleSchema = z.object({
  customerUserId: z.string().min(1, "Select a customer"),
  market: z.enum(["intl", "lk"]),
  items: orderItemsJson,
  paymentMethod: z.enum(["CASH", "WIRE_TRANSFER"]),
  paymentReference: z.string().max(200).optional().or(z.literal("")),
});

export type ManualSaleInput = z.infer<typeof manualSaleSchema>;

export const sourcingOrderSchema = z.object({
  items: orderItemsJson,
});

export type SourcingOrderInput = z.infer<typeof sourcingOrderSchema>;
