"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/rbac";
import { getSiteBannerSettings } from "@/lib/site-banner";
import { SITE_CONFIG_TAG } from "@/lib/site-config-cache";
import { siteFeedbackSchema } from "@/lib/validation/site-feedback";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getMarket, type Market } from "@/lib/market";
import type { ActionResult } from "./auth";

export async function updateSiteBannerSettings(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  await getSiteBannerSettings(); // ensure the singleton row exists before updating it

  const intlEnabled = formData.getAll("intlEnabled").includes("true");
  const lkEnabled = formData.getAll("lkEnabled").includes("true");
  const intlMessage = String(formData.get("intlMessage") ?? "").trim();
  const lkMessage = String(formData.get("lkMessage") ?? "").trim();

  if (intlEnabled && !intlMessage) return { ok: false, error: "Enter a message for the international site's banner before enabling it." };
  if (lkEnabled && !lkMessage) return { ok: false, error: "Enter a message for the Sri Lanka site's banner before enabling it." };

  await prisma.siteBannerSettings.update({
    where: { id: "singleton" },
    data: {
      intlEnabled,
      intlMessage: intlMessage || null,
      lkEnabled,
      lkMessage: lkMessage || null,
    },
  });

  revalidateTag(SITE_CONFIG_TAG, { expire: 0 });
  revalidatePath("/admin/site-status");
  return { ok: true };
}

// Public — reachable by a signed-out visitor from the banner itself, so
// rate-limited by IP the same way password-reset/register are, rather than
// requiring a session.
export async function submitSiteFeedback(formData: FormData): Promise<ActionResult> {
  const ip = await getClientIp();
  const limit = await checkRateLimit(`site-feedback:${ip}`, { limit: 5, windowSeconds: 60 * 60 });
  if (!limit.allowed) return { ok: false, error: "You've sent a lot of feedback recently — please wait a while before sending more." };

  const parsed = siteFeedbackSchema.safeParse({
    message: formData.get("message"),
    email: formData.get("email") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter your feedback before sending." };

  const market: Market = await getMarket();
  const session = await auth();

  await prisma.siteFeedback.create({
    data: {
      market,
      message: parsed.data.message,
      email: parsed.data.email || null,
      userId: session?.user?.id ?? null,
    },
  });

  return { ok: true };
}
