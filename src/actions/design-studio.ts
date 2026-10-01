"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, hasStaffArea } from "@/lib/rbac";
import { looksLikePriceOffer } from "@/lib/moderation";
import { saveUploadedMedia } from "@/lib/media";
import { checkRateLimit } from "@/lib/rate-limit";
import type { StudioState } from "@/lib/design-studio/types";
import type { ActionResult } from "./auth";

export type SaveDesignResult = { ok: true; id: string } | { ok: false; error: string };

const MAX_NAME_LENGTH = 80;

/** Admin/staff (with the "requests" area) may touch any design; anyone
 * else may only touch a design that's either theirs or brand new (not yet
 * saved). Thrown errors are caught by every caller below and turned into
 * an ActionResult, matching every other action in this codebase. */
async function assertCanEditDesign(design: { userId: string | null } | null) {
  const user = await requireUser();
  if (hasStaffArea(user, "requests")) return user;
  if (design && design.userId !== user.id) throw new Error("FORBIDDEN");
  return user;
}

/** Create-or-update a design. Debounced client-side (~2s after the last
 * edit) rather than on every shape move — see DesignStudio.tsx. */
export async function saveDesign(designId: string | null, name: string, data: StudioState): Promise<SaveDesignResult> {
  try {
    const existing = designId ? await prisma.jewelryDesign.findUnique({ where: { id: designId }, select: { userId: true } }) : null;
    const user = await assertCanEditDesign(existing);
    const trimmedName = name.trim().slice(0, MAX_NAME_LENGTH) || "Untitled design";
    const json = JSON.parse(JSON.stringify(data));

    if (existing) {
      await prisma.jewelryDesign.update({ where: { id: designId! }, data: { name: trimmedName, data: json } });
      return { ok: true, id: designId! };
    }

    const created = await prisma.jewelryDesign.create({
      data: {
        userId: user.id,
        name: trimmedName,
        data: json,
        source: hasStaffArea(user, "requests") ? "ADMIN" : "CUSTOMER",
      },
      select: { id: true },
    });
    return { ok: true, id: created.id };
  } catch (err) {
    if (err instanceof Error && (err.message === "UNAUTHENTICATED" || err.message === "FORBIDDEN" || err.message === "ACCOUNT_DISABLED")) {
      return { ok: false, error: "Please sign in to save a design." };
    }
    return { ok: false, error: "Could not save the design." };
  }
}

/** Rasterizing (SVG → canvas → PNG) happens client-side; this just takes
 * the resulting file and stores it the same way every other upload does. */
export async function uploadDesignThumbnail(designId: string, formData: FormData): Promise<ActionResult> {
  try {
    const existing = await prisma.jewelryDesign.findUnique({ where: { id: designId }, select: { userId: true } });
    if (!existing) return { ok: false, error: "Design not found." };
    await assertCanEditDesign(existing);

    const file = formData.get("thumbnail");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No thumbnail image received." };

    const uploaded = await saveUploadedMedia(file);
    await prisma.jewelryDesign.update({ where: { id: designId }, data: { thumbnailUrl: uploaded.url } });
    return { ok: true };
  } catch (err) {
    if (err instanceof Error && (err.message === "UNAUTHENTICATED" || err.message === "FORBIDDEN" || err.message === "ACCOUNT_DISABLED")) {
      return { ok: false, error: "Please sign in to save a design." };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Could not upload the thumbnail." };
  }
}

/** Turns a finished sketch into a custom-design QuoteRequest — the exact
 * same productType/pipeline submitCustomJewelryRequest (actions/quotes.ts)
 * creates from a description + uploaded photos, so it flows through the
 * same admin review/chat/accept path. The design stays linked
 * (quoteRequestId) so admin can reopen the editable version later. */
export async function submitDesignStudioRequest(designId: string, description: string): Promise<ActionResult> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Please sign in to submit a custom design request." };

  const limit = await checkRateLimit(`submit-request:${user.id}`, { limit: 10, windowSeconds: 60 * 60 });
  if (!limit.allowed) {
    return { ok: false, error: "You've submitted a lot of requests recently — please wait a while before submitting another." };
  }

  const trimmed = description.trim();
  if (trimmed.length < 10) return { ok: false, error: "Tell us a bit more about what you'd like made." };
  if (trimmed.length > 2000) return { ok: false, error: "That description is too long." };

  const design = await prisma.jewelryDesign.findUnique({ where: { id: designId } });
  if (!design || design.userId !== user.id) return { ok: false, error: "Design not found." };
  if (design.quoteRequestId) return { ok: false, error: "This design was already submitted." };
  if (!design.thumbnailUrl) return { ok: false, error: "Save the sketch before submitting it." };

  try {
    const quote = await prisma.quoteRequest.create({
      data: {
        userId: user.id,
        productType: "CUSTOM",
        note: trimmed,
        noteFlaggedForPrice: looksLikePriceOffer(trimmed),
        referenceImages: [design.thumbnailUrl],
      },
      select: { id: true },
    });
    await prisma.jewelryDesign.update({ where: { id: design.id }, data: { quoteRequestId: quote.id } });
  } catch {
    return { ok: false, error: "Could not submit the request." };
  }

  revalidatePath("/account/quotes");
  revalidatePath("/account/custom-designs");
  return { ok: true };
}

export interface MyDesignSummary {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  updatedAt: Date;
}

/** The current admin/staff user's own saved designs, most recently
 * updated first — backs the editor's "My Designs" panel. */
export async function listMyDesigns(): Promise<MyDesignSummary[]> {
  const user = await requireUser();
  return prisma.jewelryDesign.findMany({
    where: { userId: user.id, source: "ADMIN" },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, name: true, thumbnailUrl: true, updatedAt: true },
  });
}
