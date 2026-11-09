import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { createManualSaleOrderAction, searchAvailableCatalogItems, findCustomerByEmail } from "@/actions/manual-sale";
import { createManualSaleOrder } from "@/lib/orders";
import { saveCertificateFile } from "@/lib/media";

vi.mock("@/lib/rbac", () => ({ requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN" }) }));
vi.mock("@/lib/orders", () => ({ createManualSaleOrder: vi.fn() }));
vi.mock("@/lib/media", () => ({ saveCertificateFile: vi.fn() }));

function formData(fields: Record<string, string | File>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v as string);
  return fd;
}

const validCashFields = {
  customerUserId: "user-1",
  market: "intl",
  items: JSON.stringify([{ gemstoneId: "gem-1", unitPrice: 500 }]),
  paymentMethod: "CASH",
};

describe("createManualSaleOrderAction", () => {
  beforeEach(() => {
    vi.mocked(createManualSaleOrder).mockResolvedValue({ ok: true, orderId: "order-1" });
  });

  it("rejects a submission with no items", async () => {
    const result = await createManualSaleOrderAction(formData({ ...validCashFields, items: "[]" }));
    expect(result).toEqual({ ok: false, error: "Add at least one item" });
    expect(createManualSaleOrder).not.toHaveBeenCalled();
  });

  it("rejects a bank-transfer sale with no receipt file attached", async () => {
    const result = await createManualSaleOrderAction(formData({ ...validCashFields, paymentMethod: "WIRE_TRANSFER", paymentReference: "REF-1" }));
    expect(result).toEqual({ ok: false, error: "Attach a receipt file for a bank-transfer sale." });
    expect(createManualSaleOrder).not.toHaveBeenCalled();
  });

  it("surfaces a receipt upload failure without creating the order", async () => {
    vi.mocked(saveCertificateFile).mockRejectedValue(new Error("Unsupported file type."));
    const fd = formData({ ...validCashFields, paymentMethod: "WIRE_TRANSFER", paymentReference: "REF-1" });
    fd.set("receipt", new File(["data"], "receipt.exe", { type: "application/x-msdownload" }));

    const result = await createManualSaleOrderAction(fd);

    expect(result).toEqual({ ok: false, error: "Unsupported file type." });
    expect(createManualSaleOrder).not.toHaveBeenCalled();
  });

  it("records a cash sale and redirects to the new order", async () => {
    const result = await createManualSaleOrderAction(formData(validCashFields));

    expect(createManualSaleOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        customerUserId: "user-1",
        market: "intl",
        items: [{ gemstoneId: "gem-1", unitPrice: 500 }],
        paymentMethod: "CASH",
      }),
    );
    // The form navigates; the action returns where to (see ActionResult).
    expect(result).toEqual({ ok: true, redirectTo: "/admin/orders/order-1" });
  });

  it("uploads the receipt and passes its URL through for a bank-transfer sale", async () => {
    vi.mocked(saveCertificateFile).mockResolvedValue({ url: "https://storage.example/receipt.pdf" });
    const fd = formData({ ...validCashFields, paymentMethod: "WIRE_TRANSFER", paymentReference: "REF-1" });
    fd.set("receipt", new File(["data"], "receipt.pdf", { type: "application/pdf" }));

    await createManualSaleOrderAction(fd);

    expect(createManualSaleOrder).toHaveBeenCalledWith(
      expect.objectContaining({ paymentReference: "REF-1", receiptUrl: "https://storage.example/receipt.pdf" }),
    );
  });

  it("surfaces the underlying error when createManualSaleOrder itself fails, without redirecting", async () => {
    vi.mocked(createManualSaleOrder).mockResolvedValue({ ok: false, error: "One of the selected items was just taken elsewhere — refresh and try again." });

    const result = await createManualSaleOrderAction(formData(validCashFields));

    expect(result).toEqual({ ok: false, error: "One of the selected items was just taken elsewhere — refresh and try again." });
    expect(result).not.toHaveProperty("redirectTo");
  });
});

describe("searchAvailableCatalogItems", () => {
  it("returns nothing for a query shorter than 2 characters", async () => {
    const result = await searchAvailableCatalogItems("intl", "a");
    expect(result).toEqual([]);
    expect(prismaMock.gemstone.findMany).not.toHaveBeenCalled();
  });

  it("only searches AVAILABLE items in the given market", async () => {
    prismaMock.gemstone.findMany.mockResolvedValue([]);
    prismaMock.jewelryPiece.findMany.mockResolvedValue([]);

    await searchAvailableCatalogItems("lk", "sapphire");

    expect(prismaMock.gemstone.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { market: "lk", stockStatus: "AVAILABLE", name: { contains: "sapphire", mode: "insensitive" } } }),
    );
  });

  it("only offers a jewelry piece's AVAILABLE variants, priced for the given market", async () => {
    prismaMock.gemstone.findMany.mockResolvedValue([]);
    prismaMock.jewelryPiece.findMany.mockResolvedValue([
      {
        id: "jew-1", name: "Signet Ring", retailPrice: 500, lkrRetailPrice: 150000,
        variants: [
          { id: "v1", label: "Size 7", retailPrice: null, lkrRetailPrice: null, stockStatus: "AVAILABLE" },
          { id: "v2", label: "Size 8", retailPrice: 650, lkrRetailPrice: null, stockStatus: "SOLD" },
        ],
      },
    ] as never);

    const result = await searchAvailableCatalogItems("intl", "signet");

    expect(result).toEqual([
      { kind: "jewelry", id: "jew-1", name: "Signet Ring", price: 500, variants: [{ id: "v1", label: "Size 7", price: 500 }] },
    ]);
  });
});

describe("findCustomerByEmail", () => {
  it("returns null for a blank email without querying", async () => {
    const result = await findCustomerByEmail("  ");
    expect(result).toBeNull();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("looks up the trimmed email", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1", name: "Jane Doe", email: "jane@example.com" } as never);

    const result = await findCustomerByEmail("  jane@example.com  ");

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: "jane@example.com" }, select: { id: true, name: true, email: true } });
    expect(result).toEqual({ id: "user-1", name: "Jane Doe", email: "jane@example.com" });
  });
});
