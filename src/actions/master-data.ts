"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { slugify } from "@/lib/utils";
import { saveLabLogo, deleteUploadedFile } from "@/lib/media";
import { MASTER_DATA_TAG } from "@/lib/catalog";
import { mineralSchema, clarityGradeSchema, simpleMasterDataSchema, certLabSchema } from "@/lib/validation/catalog";
import type { ActionResult } from "./auth";

function obj(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

// Every mutation below calls this right after its own revalidatePath — the
// cached getMasterData() (lib/catalog.ts) backs public pages (/gems,
// /configurator) and admin forms alike, so an admin editing master data
// needs their own change available immediately, not after the cache's 60s
// window (e.g. adding a mineral they want to pick right away on a new
// gemstone form).
function revalidateMasterData() {
  revalidateTag(MASTER_DATA_TAG, { expire: 0 });
}

// Prisma throws P2002 on a unique-constraint violation (e.g. a name/slug
// that already exists) rather than returning a normal result, so every
// create/update below that touches a @unique field needs to catch it
// explicitly and turn it into a graceful ActionResult — otherwise it
// surfaces as a raw unhandled 500 with a Prisma stack trace in the UI.
function uniqueConstraintMessage(err: unknown, label: string): string | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return `A ${label} with that name already exists.`;
  }
  return null;
}

export async function createMineral(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = mineralSchema.safeParse(obj(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid mineral." };
  const d = parsed.data;
  try {
    await prisma.mineral.create({ data: { ...d, description: d.description || undefined, slug: slugify(d.name) } });
  } catch (err) {
    const message = uniqueConstraintMessage(err, "mineral");
    if (message) return { ok: false, error: message };
    throw err;
  }
  revalidatePath("/admin/master-data/minerals");
  revalidateMasterData();
  return { ok: true };
}

export async function updateMineral(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = mineralSchema.safeParse(obj(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid mineral." };
  const d = parsed.data;
  try {
    await prisma.mineral.update({ where: { id }, data: { ...d, description: d.description || undefined } });
  } catch (err) {
    const message = uniqueConstraintMessage(err, "mineral");
    if (message) return { ok: false, error: message };
    throw err;
  }
  revalidatePath("/admin/master-data/minerals");
  revalidateMasterData();
  return { ok: true };
}

export async function deleteMineral(id: string): Promise<ActionResult> {
  await requireAdmin();
  await prisma.mineral.delete({ where: { id } });
  revalidatePath("/admin/master-data/minerals");
  revalidateMasterData();
  return { ok: true };
}

export async function createClarityGrade(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = clarityGradeSchema.safeParse(obj(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid clarity grade." };
  const d = parsed.data;
  try {
    await prisma.clarityGrade.create({ data: { ...d, slug: slugify(d.name) } });
  } catch (err) {
    const message = uniqueConstraintMessage(err, "clarity grade");
    if (message) return { ok: false, error: message };
    throw err;
  }
  revalidatePath("/admin/master-data/clarity");
  revalidateMasterData();
  return { ok: true };
}

export async function updateClarityGrade(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = clarityGradeSchema.safeParse(obj(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid clarity grade." };
  try {
    await prisma.clarityGrade.update({ where: { id }, data: parsed.data });
  } catch (err) {
    const message = uniqueConstraintMessage(err, "clarity grade");
    if (message) return { ok: false, error: message };
    throw err;
  }
  revalidatePath("/admin/master-data/clarity");
  revalidateMasterData();
  return { ok: true };
}

export async function deleteClarityGrade(id: string): Promise<ActionResult> {
  await requireAdmin();
  await prisma.clarityGrade.delete({ where: { id } });
  revalidatePath("/admin/master-data/clarity");
  revalidateMasterData();
  return { ok: true };
}

type SimpleModel = "cut" | "treatment" | "origin";

async function createSimple(model: SimpleModel, formData: FormData, extra: Record<string, unknown> = {}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = simpleMasterDataSchema.safeParse(obj(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid entry." };
  const d = parsed.data;
  const data = { name: d.name, active: d.active, slug: slugify(d.name), ...extra };
  try {
    if (model === "cut") await prisma.cut.create({ data: data as never });
    if (model === "treatment") await prisma.treatment.create({ data: data as never });
    if (model === "origin") await prisma.origin.create({ data: data as never });
  } catch (err) {
    const message = uniqueConstraintMessage(err, model);
    if (message) return { ok: false, error: message };
    throw err;
  }
  revalidatePath(`/admin/master-data/${model === "cut" ? "cuts" : model + "s"}`);
  revalidateMasterData();
  return { ok: true };
}

export async function createTreatment(formData: FormData): Promise<ActionResult> {
  return createSimple("treatment", formData);
}

export async function createOrigin(formData: FormData): Promise<ActionResult> {
  const isCeylon = formData.get("isCeylon") === "on";
  return createSimple("origin", formData, { isCeylon });
}

export async function toggleTreatmentActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  await prisma.treatment.update({ where: { id }, data: { active } });
  revalidatePath("/admin/master-data/treatments");
  revalidateMasterData();
  return { ok: true };
}

export async function toggleOriginActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  await prisma.origin.update({ where: { id }, data: { active } });
  revalidatePath("/admin/master-data/origins");
  revalidateMasterData();
  return { ok: true };
}

export async function toggleCutActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  await prisma.cut.update({ where: { id }, data: { active } });
  revalidatePath("/admin/master-data/cuts");
  revalidateMasterData();
  return { ok: true };
}

export async function toggleMineralActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  await prisma.mineral.update({ where: { id }, data: { active } });
  revalidatePath("/admin/master-data/minerals");
  revalidateMasterData();
  return { ok: true };
}

export async function createCertLab(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = certLabSchema.safeParse(obj(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid certification lab." };
  const d = parsed.data;

  // The logo file rides along in the same FormData as the rest of the
  // form — unlike a gemstone's certificate file (which needs a gemstone id
  // to attach to before it can be uploaded), a lab logo has nothing else
  // to wait on, so it's saved as part of this one create call.
  const logo = formData.get("logo") as File | null;
  let logoUrl: string | undefined;
  if (logo && logo.size > 0) {
    try {
      logoUrl = (await saveLabLogo(logo)).url;
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Logo upload failed." };
    }
  }

  try {
    await prisma.certificationLab.create({
      data: {
        name: d.name,
        slug: slugify(d.name),
        websiteUrl: d.websiteUrl || undefined,
        verifyUrlTemplate: d.verifyUrlTemplate || undefined,
        logoUrl,
        active: d.active,
      },
    });
  } catch (err) {
    // The lab row didn't get created, so an already-saved logo file would
    // otherwise be orphaned in storage.
    if (logoUrl) await deleteUploadedFile(logoUrl).catch(() => {});
    const message = uniqueConstraintMessage(err, "certification lab");
    if (message) return { ok: false, error: message };
    throw err;
  }
  revalidatePath("/admin/master-data/certification-labs");
  revalidateMasterData();
  return { ok: true };
}

export async function updateCertLab(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = certLabSchema.safeParse(obj(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid certification lab." };
  const d = parsed.data;
  try {
    await prisma.certificationLab.update({
      where: { id },
      data: { name: d.name, websiteUrl: d.websiteUrl || null, verifyUrlTemplate: d.verifyUrlTemplate || null, active: d.active },
    });
  } catch (err) {
    const message = uniqueConstraintMessage(err, "certification lab");
    if (message) return { ok: false, error: message };
    throw err;
  }
  revalidatePath("/admin/master-data/certification-labs");
  revalidatePath("/admin/gems");
  revalidateMasterData();
  return { ok: true };
}

export async function uploadCertLabLogo(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "No file provided." };

  const lab = await prisma.certificationLab.findUnique({ where: { id }, select: { logoUrl: true } });
  if (!lab) return { ok: false, error: "Certification lab not found." };

  try {
    const saved = await saveLabLogo(file);
    await prisma.certificationLab.update({ where: { id }, data: { logoUrl: saved.url } });

    if (lab.logoUrl) await deleteUploadedFile(lab.logoUrl).catch(() => {});

    revalidatePath("/admin/master-data/certification-labs");
    revalidatePath("/admin/gems");
    revalidatePath("/gems", "layout");
    revalidateMasterData();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Upload failed." };
  }
}

export async function removeCertLabLogo(id: string): Promise<ActionResult> {
  await requireAdmin();

  const lab = await prisma.certificationLab.findUnique({ where: { id }, select: { logoUrl: true } });
  if (!lab) return { ok: false, error: "Certification lab not found." };

  await prisma.certificationLab.update({ where: { id }, data: { logoUrl: null } });

  if (lab.logoUrl) await deleteUploadedFile(lab.logoUrl).catch(() => {});

  revalidatePath("/admin/master-data/certification-labs");
  revalidatePath("/admin/gems");
  revalidatePath("/gems", "layout");
  revalidateMasterData();
  return { ok: true };
}

export async function deleteCertLab(id: string): Promise<ActionResult> {
  await requireAdmin();
  await prisma.certificationLab.delete({ where: { id } });
  revalidatePath("/admin/master-data/certification-labs");
  revalidateMasterData();
  return { ok: true };
}

export async function toggleCertLabActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  await prisma.certificationLab.update({ where: { id }, data: { active } });
  revalidatePath("/admin/master-data/certification-labs");
  revalidateMasterData();
  return { ok: true };
}
