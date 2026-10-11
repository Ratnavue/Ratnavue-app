"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { setTranslationOverride } from "@/lib/translations";
import { SUPPORTED_LOCALES } from "@/i18n/request";
import type { ActionResult } from "./auth";

// Admin-only, not folded into the "content" staff area (lib/staff-permissions.ts)
// — translations are global across both stores and every customer, closer to
// the already-admin-only pricing/promotions/page-visibility items than to
// per-store Home/About content editing.
export async function saveTranslationOverride(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const key = String(formData.get("key") ?? "").trim();
  const locale = String(formData.get("locale") ?? "").trim();
  const value = String(formData.get("value") ?? "");

  if (!key) return { ok: false, error: "Missing translation key." };
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) return { ok: false, error: "Unsupported locale." };

  await setTranslationOverride(key, locale, value);
  revalidatePath("/admin/translations");
  return { ok: true };
}
