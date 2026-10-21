import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { createWholesaleAccount } from "@/actions/wholesale";
import { createNotification } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";

vi.mock("@/lib/rbac", () => ({ requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN" }) }));
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(), SUPPORT_EMAIL: "support@ratnavue.com", SALES_EMAIL: "sales@ratnavue.com" }));

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const validFields = {
  name: "Jane Doe",
  email: "jane@wholesaler.example",
  temporaryPassword: "TempPass123",
  businessName: "Doe Gems Pte Ltd",
  businessRegNo: "REG-12345",
};

describe("createWholesaleAccount", () => {
  beforeEach(() => {
    vi.mocked(createNotification).mockResolvedValue(undefined);
    vi.mocked(sendEmail).mockResolvedValue({ ok: true });
  });

  it("refuses an email that's already registered", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing-user" } as never);

    const result = await createWholesaleAccount(formData(validFields));

    expect(result).toEqual({ ok: false, error: "An account with this email already exists." });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an invalid submission (short password) before touching the database", async () => {
    const result = await createWholesaleAccount(formData({ ...validFields, temporaryPassword: "short" }));

    expect(result.ok).toBe(false);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("creates the user already APPROVED, with its own BusinessAccount, and notifies + emails them", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: "user-1", email: validFields.email } as never);
    prismaMock.businessAccount.create.mockResolvedValue({ id: "biz-1" } as never);
    prismaMock.user.update.mockResolvedValue({ id: "user-1" } as never);

    const result = await createWholesaleAccount(formData(validFields));

    expect(result).toEqual({ ok: true });
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerType: "WHOLESALE",
          wholesaleStatus: "APPROVED",
          mustChangePassword: true,
        }),
      }),
    );
    expect(prismaMock.businessAccount.create).toHaveBeenCalledWith({ data: { name: validFields.businessName, ownerId: "user-1" } });
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { businessAccountId: "biz-1", businessRole: "OWNER" } });
    expect(createNotification).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: validFields.email, subject: expect.stringContaining("wholesale") }));
  });

  it("still succeeds if the email fails to send (best-effort)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: "user-1", email: validFields.email } as never);
    prismaMock.businessAccount.create.mockResolvedValue({ id: "biz-1" } as never);
    prismaMock.user.update.mockResolvedValue({ id: "user-1" } as never);
    vi.mocked(sendEmail).mockResolvedValue({ ok: false, error: "not configured" });

    const result = await createWholesaleAccount(formData(validFields));

    expect(result).toEqual({ ok: true });
  });
});
