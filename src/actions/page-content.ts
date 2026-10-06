"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { SITE_CONFIG_TAG } from "@/lib/site-config-cache";
import { requireAdmin, requireStaffArea, requireMarketAccess } from "@/lib/rbac";
import { saveUploadedMedia } from "@/lib/media";
import { savePageContent, getSeasonalContent, getHomeContent, LK_PAYMENTS_KEY } from "@/lib/page-content";
import { marketKey, type Market } from "@/lib/market-shared";
import type { AboutRow } from "@/lib/about-blocks";
import { aboutRowsSchema } from "@/lib/about-blocks-schema";
import { SEASONAL_THEME_KEYS, type SeasonalThemeKey } from "@/lib/seasonal-themes";
import type { ActionResult } from "./auth";

function obj(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

// Coerces the "true"/"false" STRING an HTML checkbox form submits (via the
// hidden-false + checkbox-true pattern every boolean toggle on these admin
// forms uses) into an actual boolean — same helper as
// lib/validation/catalog.ts's formBoolean, duplicated here rather than
// imported since this is the only schema in this file that needs it.
// z.coerce.boolean() can't be used here: it coerces via JS's Boolean(), and
// Boolean("false") is true — any non-empty string is truthy — so it would
// silently coerce an unchecked box's hidden "false" field right back to true.
function formBoolean(defaultValue: boolean) {
  return z.preprocess((v) => v === "true" || v === true, z.boolean()).default(defaultValue);
}

// ---------- Home ----------
//
// The international home page ("home") and the Sri Lanka one ("lk:home")
// are edited by the same actions, told apart by a trailing `market` — the
// admin page's market tab. Same fields, separate saved copy.

function revalidateHome(market: Market) {
  revalidatePath(market === "lk" ? "/lk" : "/");
  revalidatePath("/admin/content/home");
}

const homeTextSchema = z.object({
  heroKicker: z.string().max(200),
  heroHeadingLine1: z.string().max(200),
  heroHeadingLine2: z.string().max(200),
  heroHeadingHighlight: z.string().max(200),
  heroSubtext: z.string().max(1000),
  heritageKicker: z.string().max(100),
  heritageHeading: z.string().max(300),
  heritageBody: z.string().max(2000),
  sourcingKicker: z.string().max(100),
  sourcingHeading: z.string().max(300),
  sourcingBody: z.string().max(2000),
  editorialQuote: z.string().max(500),
  editorialQuoteHighlight: z.string().max(200),
  editorialAttribution: z.string().max(200),
  closingKicker: z.string().max(200),
  closingHeading: z.string().max(300),
  closingBody: z.string().max(1000),
  showFeaturedGems: formBoolean(false),
  showFeaturedJewelry: formBoolean(false),
});

export async function updateHomeText(formData: FormData, market: Market = "intl"): Promise<ActionResult> {
  const user = await requireStaffArea("content");
  await requireMarketAccess(user, market);
  const parsed = homeTextSchema.safeParse(obj(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid content." };

  const current = await getHomeContent(market);
  await savePageContent(marketKey("home", market), { ...current, ...parsed.data });
  revalidateHome(market);
  return { ok: true };
}

export async function setHomeImage(market: Market, field: "heritageImage" | "sourcingImage", formData: FormData): Promise<ActionResult> {
  const user = await requireStaffArea("content");
  await requireMarketAccess(user, market);
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "No file provided." };
  try {
    const saved = await saveUploadedMedia(file);
    if (saved.type !== "IMAGE") return { ok: false, error: "Please upload an image file." };
    const current = await getHomeContent(market);
    await savePageContent(marketKey("home", market), { ...current, [field]: saved.url });
    revalidateHome(market);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Upload failed." };
  }
}

export async function addHeroSlide(formData: FormData, market: Market = "intl"): Promise<ActionResult> {
  const user = await requireStaffArea("content");
  await requireMarketAccess(user, market);
  const file = formData.get("file") as File | null;
  const alt = ((formData.get("alt") as string | null) ?? "").slice(0, 200);
  if (!file || file.size === 0) return { ok: false, error: "No file provided." };

  try {
    const saved = await saveUploadedMedia(file);
    if (saved.type !== "IMAGE") return { ok: false, error: "Please upload an image file." };
    const current = await getHomeContent(market);
    const heroSlides = [...current.heroSlides, { src: saved.url, alt }];
    await savePageContent(marketKey("home", market), { ...current, heroSlides });
    revalidateHome(market);
      return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Upload failed." };
  }
}

export async function replaceHeroSlideImage(index: number, formData: FormData, market: Market = "intl"): Promise<ActionResult> {
  const user = await requireStaffArea("content");
  await requireMarketAccess(user, market);
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "No file provided." };

  try {
    const saved = await saveUploadedMedia(file);
    if (saved.type !== "IMAGE") return { ok: false, error: "Please upload an image file." };
    const current = await getHomeContent(market);
    if (index < 0 || index >= current.heroSlides.length) return { ok: false, error: "Slide not found." };
    const heroSlides = current.heroSlides.map((s, i) => (i === index ? { ...s, src: saved.url } : s));
    await savePageContent(marketKey("home", market), { ...current, heroSlides });
    revalidateHome(market);
      return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Upload failed." };
  }
}

export async function updateHeroSlideAlt(index: number, alt: string, market: Market = "intl"): Promise<ActionResult> {
  const user = await requireStaffArea("content");
  await requireMarketAccess(user, market);
  const current = await getHomeContent(market);
  if (index < 0 || index >= current.heroSlides.length) return { ok: false, error: "Slide not found." };
  const heroSlides = current.heroSlides.map((s, i) => (i === index ? { ...s, alt: alt.slice(0, 200) } : s));
  await savePageContent(marketKey("home", market), { ...current, heroSlides });
  revalidateHome(market);
  return { ok: true };
}

export async function updateHeroSlideFocus(index: number, focusX: number, market: Market = "intl"): Promise<ActionResult> {
  const user = await requireStaffArea("content");
  await requireMarketAccess(user, market);
  const current = await getHomeContent(market);
  if (index < 0 || index >= current.heroSlides.length) return { ok: false, error: "Slide not found." };
  const clamped = Math.min(100, Math.max(0, Math.round(focusX)));
  const heroSlides = current.heroSlides.map((s, i) => (i === index ? { ...s, focusX: clamped } : s));
  await savePageContent(marketKey("home", market), { ...current, heroSlides });
  revalidateHome(market);
  return { ok: true };
}

export async function removeHeroSlide(index: number, market: Market = "intl"): Promise<ActionResult> {
  const user = await requireStaffArea("content");
  await requireMarketAccess(user, market);
  const current = await getHomeContent(market);
  if (current.heroSlides.length <= 1) return { ok: false, error: "Keep at least one hero slide." };
  if (index < 0 || index >= current.heroSlides.length) return { ok: false, error: "Slide not found." };
  const heroSlides = current.heroSlides.filter((_, i) => i !== index);
  await savePageContent(marketKey("home", market), { ...current, heroSlides });
  revalidateHome(market);
  return { ok: true };
}

// ---------- About (block-based page builder) ----------

export async function updateAboutRows(rows: AboutRow[]): Promise<ActionResult> {
  await requireStaffArea("content");
  const parsed = aboutRowsSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid content." };

  await savePageContent("about", { rows: parsed.data } satisfies { rows: AboutRow[] });
  revalidatePath("/about");
  revalidatePath("/admin/content/about");
  return { ok: true };
}

export async function uploadAboutBlockImage(formData: FormData): Promise<ActionResult & { url?: string }> {
  await requireStaffArea("content");
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "No file provided." };
  try {
    const saved = await saveUploadedMedia(file);
    if (saved.type !== "IMAGE") return { ok: false, error: "Please upload an image file." };
    return { ok: true, url: saved.url };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Upload failed." };
  }
}

// ---------- Cart (wire transfer instructions) ----------

export async function updateCartContent(wireTransferInstructions: string): Promise<ActionResult> {
  await requireAdmin();
  const trimmed = wireTransferInstructions.trim();
  if (!trimmed) return { ok: false, error: "Instructions can't be empty." };
  if (trimmed.length > 2000) return { ok: false, error: "Keep it under 2000 characters." };

  await savePageContent("cart", { wireTransferInstructions: trimmed });
  revalidatePath("/account/cart");
  revalidatePath("/admin/carts");
  return { ok: true };
}

// ---------- Sri Lanka store (bank-transfer instructions) ----------

export async function updateLkPaymentsContent(wireTransferInstructions: string): Promise<ActionResult> {
  await requireAdmin();
  const trimmed = wireTransferInstructions.trim();
  if (!trimmed) return { ok: false, error: "Instructions can't be empty." };
  if (trimmed.length > 2000) return { ok: false, error: "Keep it under 2000 characters." };

  await savePageContent(LK_PAYMENTS_KEY, { wireTransferInstructions: trimmed });
  revalidatePath("/checkout/wire");
  revalidatePath("/admin/orders");
  return { ok: true };
}

// ---------- Seasonal promotions page ----------

const seasonalThemeCopySchema = z.object({
  kicker: z.string().max(100),
  heading: z.string().max(200),
  body: z.string().max(1000),
  ctaLabel: z.string().max(50),
});

// Each theme is saved independently — an admin editing Winter's copy
// shouldn't need to also resubmit Spring's, and a stale form for one
// theme can't clobber another's already-saved edits the way one big
// "all 5 themes" form would if two admins (or two tabs) saved at once.
export async function updateSeasonalThemeCopy(theme: SeasonalThemeKey, formData: FormData, market: Market = "intl"): Promise<ActionResult> {
  await requireAdmin();
  if (!SEASONAL_THEME_KEYS.includes(theme)) return { ok: false, error: "Unknown theme." };
  const parsed = seasonalThemeCopySchema.safeParse(obj(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid content." };

  const current = await getSeasonalContent(market);
  await savePageContent(marketKey("seasonal", market), { ...current, themes: { ...current.themes, [theme]: parsed.data } });
  // The root layout caches the seasonal settings (see lib/site-config-cache.ts).
  revalidateTag(SITE_CONFIG_TAG, { expire: 0 });
  revalidatePath(market === "lk" ? "/lk/promotions" : "/promotions");
  revalidatePath("/admin/promotions");
  return { ok: true };
}

// Which of the 5 predefined themes is currently showing on the live
// page — distinct from editing a theme's copy above, same as picking
// which slide is active versus editing a slide.
export async function setActiveSeasonalTheme(theme: SeasonalThemeKey, market: Market = "intl"): Promise<ActionResult> {
  await requireAdmin();
  if (!SEASONAL_THEME_KEYS.includes(theme)) return { ok: false, error: "Unknown theme." };

  const current = await getSeasonalContent(market);
  await savePageContent(marketKey("seasonal", market), { ...current, activeTheme: theme });
  // The root layout caches the seasonal settings (see lib/site-config-cache.ts).
  revalidateTag(SITE_CONFIG_TAG, { expire: 0 });
  revalidatePath(market === "lk" ? "/lk/promotions" : "/promotions");
  revalidatePath("/admin/promotions");
  return { ok: true };
}
