"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { createWholesaleAccountSchema } from "@/lib/validation/auth";
import { createNotification } from "@/lib/notifications";
import { sendEmail, SALES_EMAIL } from "@/lib/email";
import { wholesaleAccountCreatedEmail } from "@/lib/email-templates";
import { withMarket } from "@/lib/market-shared";
import type { ActionResult } from "./auth";

// Approval gates nothing else in the app today beyond standing up the
// customer's team — a PENDING account can already browse, quote, and buy
// retail exactly like any other customer (see the comment on
// User.wholesaleStatus in schema.prisma). This is purely the admin review
// step for the business's own paper trail, plus creating the
// BusinessAccount that /account/business is built on, with the applicant
// as its OWNER (see lib/business.ts for how a member later joins it).
export async function approveWholesaleApplication(userId: string): Promise<ActionResult> {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.customerType !== "WHOLESALE") return { ok: false, error: "Wholesale application not found." };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { wholesaleStatus: "APPROVED" } });
    // A second approval click (or an application that was somehow
    // approved twice) shouldn't spawn a duplicate team — ownerId is
    // unique, so only create one if this user doesn't already own one.
    if (!user.businessAccountId) {
      const business = await tx.businessAccount.create({
        data: { name: user.businessName ?? user.name ?? "Wholesale Account", ownerId: userId },
      });
      await tx.user.update({ where: { id: userId }, data: { businessAccountId: business.id, businessRole: "OWNER" } });
    }
  });

  revalidatePath("/admin/wholesale-applications");
  revalidatePath(`/admin/customers/${userId}`);
  return { ok: true };
}

/**
 * An admin registering a wholesale customer directly (rather than the
 * customer self-registering and waiting for approval — see
 * approveWholesaleApplication above) with a predefined password. Created
 * already APPROVED with its own BusinessAccount, same as an approved
 * application ends up — the only difference is who typed the password and
 * that mustChangePassword nudges them to change it. Best-effort email +
 * an in-app notification either way; the account itself is real regardless
 * of whether either one succeeds.
 */
export async function createWholesaleAccount(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = createWholesaleAccountSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    temporaryPassword: String(formData.get("temporaryPassword") ?? ""),
    businessName: String(formData.get("businessName") ?? "").trim(),
    businessRegNo: String(formData.get("businessRegNo") ?? "").trim(),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details you entered." };
  const { name, email, temporaryPassword, businessName, businessRegNo } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "An account with this email already exists." };

  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "CUSTOMER",
        customerType: "WHOLESALE",
        wholesaleStatus: "APPROVED",
        businessName,
        businessRegNo,
        mustChangePassword: true,
      },
    });
    const business = await tx.businessAccount.create({ data: { name: businessName, ownerId: created.id } });
    return tx.user.update({ where: { id: created.id }, data: { businessAccountId: business.id, businessRole: "OWNER" } });
  });

  const changePasswordUrl = `${process.env.AUTH_URL ?? "http://localhost:3000"}${withMarket("/account/change-password", "intl")}`;
  await createNotification({
    userId: user.id,
    type: "STATUS_CHANGE",
    message: "Your wholesale account has been created — please change your temporary password from the account menu.",
    requestType: "general",
    requestId: user.id,
  });
  const emailResult = await sendEmail({
    to: email,
    ...wholesaleAccountCreatedEmail({ email, temporaryPassword, changePasswordUrl }),
    replyTo: SALES_EMAIL,
  });
  if (!emailResult.ok) console.warn(`Wholesale account email not sent for ${email}: ${emailResult.error}`);

  revalidatePath("/admin/wholesale-applications");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/business-accounts");
  return { ok: true };
}

export async function rejectWholesaleApplication(userId: string): Promise<ActionResult> {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.customerType !== "WHOLESALE") return { ok: false, error: "Wholesale application not found." };

  await prisma.user.update({ where: { id: userId }, data: { wholesaleStatus: "REJECTED" } });
  revalidatePath("/admin/wholesale-applications");
  revalidatePath(`/admin/customers/${userId}`);
  return { ok: true };
}
