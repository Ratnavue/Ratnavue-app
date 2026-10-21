import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { createStaffAccount, updateStaffMarketScope, updateStaffPermissions, revokeStaffAccess, grantStaffAccess, searchUsersForStaff } from "@/actions/staff";
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

const validFields = { name: "Priya Staff", email: "priya@ratnavue.example", temporaryPassword: "TempPass123", marketScope: "intl", permissions: "orders" };

beforeEach(() => {
  vi.mocked(createNotification).mockResolvedValue(undefined);
  vi.mocked(sendEmail).mockResolvedValue({ ok: true });
});

describe("createStaffAccount", () => {
  it("refuses an email that's already registered", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing-user" } as never);
    const result = await createStaffAccount(formData(validFields));
    expect(result).toEqual({ ok: false, error: "An account with this email already exists." });
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid market scope before touching the database", async () => {
    const result = await createStaffAccount(formData({ ...validFields, marketScope: "everywhere" }));
    expect(result.ok).toBe(false);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a short temporary password", async () => {
    const result = await createStaffAccount(formData({ ...validFields, temporaryPassword: "short" }));
    expect(result.ok).toBe(false);
  });

  it("creates the account with role STAFF, the chosen scope, and mustChangePassword true", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: "staff-1" } as never);

    const result = await createStaffAccount(formData(validFields));

    expect(result).toEqual({ ok: true });
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: "STAFF", staffMarketScope: "intl", staffPermissions: ["orders"], mustChangePassword: true, email: "priya@ratnavue.example" }),
    });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "priya@ratnavue.example" }));
  });

  it("requires at least one area to be switched on", async () => {
    const fields = { ...validFields } as Record<string, string>;
    delete fields.permissions;
    const result = await createStaffAccount(formData(fields));
    expect(result.ok).toBe(false);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("drops an area name that isn't real rather than storing it", async () => {
    const result = await createStaffAccount(formData({ ...validFields, permissions: "superuser" }));
    expect(result.ok).toBe(false);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("stores several areas when several are checked", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: "staff-1" } as never);
    const fd = formData(validFields);
    fd.append("permissions", "catalog");
    await createStaffAccount(fd);
    expect(prismaMock.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({ staffPermissions: ["orders", "catalog"] }) });
  });

  it("still succeeds even if the email fails to send (best-effort)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: "staff-1" } as never);
    vi.mocked(sendEmail).mockResolvedValue({ ok: false, error: "not configured" });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await createStaffAccount(formData(validFields));

    expect(result).toEqual({ ok: true });
    warnSpy.mockRestore();
  });
});

describe("updateStaffMarketScope", () => {
  it("refuses to touch a non-staff account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "CUSTOMER" } as never);
    const result = await updateStaffMarketScope("user-1", "both");
    expect(result).toEqual({ ok: false, error: "Not a staff account." });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("updates the scope for a real staff account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "STAFF" } as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    const result = await updateStaffMarketScope("staff-1", "both");
    expect(result).toEqual({ ok: true });
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: "staff-1" }, data: { staffMarketScope: "both" } });
  });
});

describe("searchUsersForStaff", () => {
  it("ignores a query shorter than two characters without touching the database", async () => {
    expect(await searchUsersForStaff(" a ")).toEqual([]);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it("only ever searches customer accounts, by email or name", async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: "u1", name: "Sam", email: "sam@x.com" }] as never);
    const result = await searchUsersForStaff("sam");
    expect(result).toHaveLength(1);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ role: "CUSTOMER" }), take: 8 }));
  });
});

describe("grantStaffAccess", () => {
  it("turns an existing customer into staff with the chosen scope and areas", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "CUSTOMER", email: "sam@x.com" } as never);
    prismaMock.user.update.mockResolvedValue({} as never);

    const result = await grantStaffAccess("u1", "lk", ["reviews", "orders"]);

    expect(result).toEqual({ ok: true });
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { role: "STAFF", staffMarketScope: "lk", staffPermissions: ["orders", "reviews"] } });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "sam@x.com" }));
  });

  it("refuses an admin account and an account that is already staff", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "ADMIN", email: "a@x.com" } as never);
    expect((await grantStaffAccess("u1", "intl", ["orders"])).ok).toBe(false);
    prismaMock.user.findUnique.mockResolvedValue({ role: "STAFF", email: "s@x.com" } as never);
    expect((await grantStaffAccess("u1", "intl", ["orders"])).ok).toBe(false);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("needs a real scope and at least one real area", async () => {
    expect((await grantStaffAccess("u1", "everywhere", ["orders"])).ok).toBe(false);
    expect((await grantStaffAccess("u1", "intl", [])).ok).toBe(false);
    expect((await grantStaffAccess("u1", "intl", ["superuser"])).ok).toBe(false);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("updateStaffPermissions", () => {
  it("refuses to touch a non-staff account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "CUSTOMER" } as never);
    const result = await updateStaffPermissions("user-1", ["orders"]);
    expect(result).toEqual({ ok: false, error: "Not a staff account." });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("saves only real areas, in canonical order", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "STAFF" } as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    const result = await updateStaffPermissions("staff-1", ["reviews", "bogus", "orders"]);
    expect(result).toEqual({ ok: true });
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: "staff-1" }, data: { staffPermissions: ["orders", "reviews"] } });
  });
});

describe("revokeStaffAccess", () => {
  it("refuses to touch a non-staff account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "ADMIN" } as never);
    const result = await revokeStaffAccess("user-1");
    expect(result).toEqual({ ok: false, error: "Not a staff account." });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("demotes a real staff account back to CUSTOMER and clears its scope", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "STAFF" } as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    const result = await revokeStaffAccess("staff-1");
    expect(result).toEqual({ ok: true });
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: "staff-1" }, data: { role: "CUSTOMER", staffMarketScope: null, staffPermissions: [] } });
  });
});
