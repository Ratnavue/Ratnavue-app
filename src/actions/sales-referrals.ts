"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/rbac";
import {
  designatePromoter,
  setPromoterActive,
  requestSalesReferralPayout,
  resolveSalesReferralPayout,
} from "@/lib/sales-referrals";
import type { ActionResult } from "./auth";

// ---------- Admin: designate/manage promoters ----------

// Candidates are existing users with *any* admin-portal access — an ADMIN,
// or a STAFF member with at least one area switched on — same
// "full or partial admin access" eligibility hasAdminPortalAccess
// (src/lib/admin-access.ts) already encodes for the nav-link decision.
// Deliberately the inverse of searchUsersForStaff (actions/staff.ts),
// which searches CUSTOMER accounts to promote *to* staff.
export async function searchPromoterCandidates(query: string): Promise<{ id: string; name: string | null; email: string; role: string }[]> {
  await requireAdmin();
  const q = query.trim();
  if (q.length < 2) return [];
  return prisma.user.findMany({
    where: {
      AND: [
        { OR: [{ role: "ADMIN" }, { role: "STAFF", staffPermissions: { isEmpty: false } }] },
        { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] },
      ],
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { email: "asc" },
    take: 8,
  });
}

export async function createPromoter(userId: string): Promise<ActionResult> {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, staffPermissions: true } });
  if (!user) return { ok: false, error: "User not found." };
  const hasAdminAccess = user.role === "ADMIN" || (user.role === "STAFF" && user.staffPermissions.length > 0);
  if (!hasAdminAccess) return { ok: false, error: "This user has no admin portal access." };

  const result = await designatePromoter(userId);
  if (!result.ok) return result;
  revalidatePath("/admin/sales-referrals");
  return { ok: true };
}

export async function togglePromoterActive(promoterId: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  await setPromoterActive(promoterId, active);
  revalidatePath("/admin/sales-referrals");
  return { ok: true };
}

// ---------- Admin: resolve a payout request ----------

export async function resolvePayoutRequest(payoutId: string, resolution: "PAID" | "DENIED", formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  await resolveSalesReferralPayout(payoutId, resolution, {
    paymentReference: String(formData.get("paymentReference") ?? "").trim() || undefined,
    adminNotes: String(formData.get("adminNotes") ?? "").trim() || undefined,
  });
  revalidatePath("/admin/sales-referrals");
  return { ok: true };
}

// ---------- Promoter: request their own payout ----------

// Scoped to the signed-in user's own promoter row — never an id passed
// in from the client, same "never trust which record the request claims
// to be about" discipline every other self-service action in this app
// follows.
export async function requestOwnPayout(currency: string): Promise<ActionResult> {
  const user = await requireUser();
  const promoter = await prisma.salesReferralPromoter.findUnique({ where: { userId: user.id }, select: { id: true, active: true } });
  if (!promoter) return { ok: false, error: "You're not a sales referral promoter." };

  const result = await requestSalesReferralPayout(promoter.id, currency);
  if (!result.ok) return result;
  revalidatePath("/account/sales-referral");
  return { ok: true };
}
