"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { addCustomLocale, setCustomLocaleActive, deleteCustomLocale } from "@/lib/locales";
import { SUPPORTED_LOCALES } from "@/i18n/request";
import type { ActionResult } from "./auth";

// Admin-only, same reasoning as saveTranslationOverride — languages are
// global across both stores and every customer.
export async function createCustomLocale(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const code = String(formData.get("code") ?? "");
  const name = String(formData.get("name") ?? "");
  const nativeName = String(formData.get("nativeName") ?? "");
  const result = await addCustomLocale(code, name, nativeName, SUPPORTED_LOCALES);
  if (!result.ok) return result;
  revalidatePath("/admin/translations");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleCustomLocaleActive(code: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  await setCustomLocaleActive(code, active);
  revalidatePath("/admin/translations");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeCustomLocale(code: string): Promise<ActionResult> {
  await requireAdmin();
  await deleteCustomLocale(code);
  revalidatePath("/admin/translations");
  revalidatePath("/", "layout");
  return { ok: true };
}
