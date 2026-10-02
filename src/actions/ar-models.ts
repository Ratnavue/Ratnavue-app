"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffArea } from "@/lib/rbac";
import { saveArModelFile, deleteUploadedFile } from "@/lib/media";
import type { ActionResult } from "./auth";

/** Uploads/replaces the GLB 3D model behind a jewelry piece's AR try-on
 * button (JewelryPiece.arModelUrl) — same immediate-upload-on-select,
 * single-file-per-item pattern as uploadCertLabLogo (actions/master-data.ts).
 * Only reachable for an existing piece (ArModelUploader isn't shown on the
 * create-new form — there's no id to attach a model to yet). */
export async function uploadArModel(jewelryId: string, formData: FormData): Promise<ActionResult> {
  await requireStaffArea("catalog");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "No file provided." };

  const piece = await prisma.jewelryPiece.findUnique({ where: { id: jewelryId }, select: { arModelUrl: true, slug: true } });
  if (!piece) return { ok: false, error: "Jewelry piece not found." };

  try {
    const saved = await saveArModelFile(file);
    await prisma.jewelryPiece.update({ where: { id: jewelryId }, data: { arModelUrl: saved.url } });

    if (piece.arModelUrl) await deleteUploadedFile(piece.arModelUrl).catch(() => {});

    revalidatePath(`/admin/jewelry/${jewelryId}`);
    revalidatePath(`/jewelry/${piece.slug}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Upload failed." };
  }
}

export async function removeArModel(jewelryId: string): Promise<ActionResult> {
  await requireStaffArea("catalog");

  const piece = await prisma.jewelryPiece.findUnique({ where: { id: jewelryId }, select: { arModelUrl: true, slug: true } });
  if (!piece) return { ok: false, error: "Jewelry piece not found." };

  await prisma.jewelryPiece.update({ where: { id: jewelryId }, data: { arModelUrl: null } });

  if (piece.arModelUrl) await deleteUploadedFile(piece.arModelUrl).catch(() => {});

  revalidatePath(`/admin/jewelry/${jewelryId}`);
  revalidatePath(`/jewelry/${piece.slug}`);
  return { ok: true };
}
