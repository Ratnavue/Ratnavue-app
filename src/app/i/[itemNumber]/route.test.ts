import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { auth } from "@/lib/auth";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

function scan(itemNumber: string) {
  return GET(new Request(`https://ratnavue.test/i/${itemNumber}`), { params: Promise.resolve({ itemNumber }) } as never);
}

describe("GET /i/[itemNumber]", () => {
  it("sends a live international gemstone to its product page", async () => {
    prismaMock.gemstone.findUnique.mockResolvedValue({ id: "g1", slug: "blue-sapphire", market: "intl", isPublished: true } as never);

    const res = await scan("g123");

    expect(prismaMock.gemstone.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { itemNumber: "G-000123" } }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://ratnavue.test/gems/blue-sapphire");
  });

  it("sends a Sri Lanka jewelry piece to its /lk product page", async () => {
    prismaMock.jewelryPiece.findUnique.mockResolvedValue({ id: "j1", slug: "gold-ring", market: "lk", isPublished: true } as never);

    const res = await scan("J-000007");

    expect(res.headers.get("location")).toBe("https://ratnavue.test/lk/jewelry/gold-ring");
  });

  it("404s for something that isn't an item number", async () => {
    await expect(scan("not-a-number")).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.gemstone.findUnique).not.toHaveBeenCalled();
  });

  it("404s for an unknown number", async () => {
    prismaMock.gemstone.findUnique.mockResolvedValue(null);
    await expect(scan("G-999999")).rejects.toThrow("NOT_FOUND");
  });

  it("takes catalog staff to the admin page of an item that isn't live", async () => {
    prismaMock.gemstone.findUnique.mockResolvedValue({ id: "g1", slug: "blue-sapphire", market: "intl", isPublished: false } as never);
    vi.mocked(auth).mockResolvedValue({ user: { id: "a1", role: "ADMIN", staffMarketScope: null, staffPermissions: [] } } as never);

    const res = await scan("G-000001");

    expect(res.headers.get("location")).toBe("https://ratnavue.test/admin/gems/g1");
  });

  it("404s for a customer scanning an item that isn't live", async () => {
    prismaMock.gemstone.findUnique.mockResolvedValue({ id: "g1", slug: "blue-sapphire", market: "intl", isPublished: false } as never);
    vi.mocked(auth).mockResolvedValue({ user: { id: "c1", role: "CUSTOMER", staffMarketScope: null, staffPermissions: [] } } as never);

    await expect(scan("G-000001")).rejects.toThrow("NOT_FOUND");
  });
});
