import { prisma } from "@/lib/prisma";

// Whether a product page would render — the same visibility rule as
// getGemstoneBySlug/getJewelryBySlug plus the pages' isPublished check (it
// exists, belongs to this store, and is live). proxy.ts asks this on a full
// page load of a product URL so a missing one can be answered with a real
// 404 status: once the page itself starts streaming (app/loading.tsx), its
// own notFound() can only produce a 200 with a noindex tag. Public data
// only: anyone can already tell from the product page itself.
const SLUG = /^[a-z0-9][a-z0-9-]{0,199}$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const slug = url.searchParams.get("slug") ?? "";
  const market = url.searchParams.get("market") === "lk" ? "lk" : "intl";
  if ((kind !== "gemstone" && kind !== "jewelry") || !SLUG.test(slug)) {
    return Response.json({ exists: false });
  }
  const where = { slug, market, isPublished: true };
  const found =
    kind === "gemstone"
      ? await prisma.gemstone.findFirst({ where, select: { id: true } })
      : await prisma.jewelryPiece.findFirst({ where, select: { id: true } });
  return Response.json(
    { exists: !!found },
    // Short shared cache: a crawler re-requesting the same URL doesn't cost a
    // query each time, and a newly published item is answered within 30s.
    { headers: { "Cache-Control": "public, s-maxage=30" } },
  );
}
