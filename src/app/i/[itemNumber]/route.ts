import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasMarketAccess, hasStaffArea } from "@/lib/rbac";
import { withMarket } from "@/lib/market-shared";
import { parseItemNumber } from "@/lib/item-number";

// Where a printed QR label lands (e.g. ratnavue.com/i/G-000123 — see
// lib/item-qr.ts). Looks the item up by its permanent item number and sends
// the visitor to its current product page, on the store the item belongs to,
// so a label never depends on how the product URL itself is built.
//
// A listing that isn't live yet (Draft/Finished) has no public page: staff
// who may edit it are taken to its admin page instead — handy when scanning
// stock in the back room — and everyone else gets a 404.
export async function GET(req: Request, ctx: RouteContext<"/i/[itemNumber]">) {
  const parsed = parseItemNumber((await ctx.params).itemNumber);
  if (!parsed) notFound();

  const select = { id: true, slug: true, market: true, isPublished: true } as const;
  const item =
    parsed.kind === "gemstone"
      ? await prisma.gemstone.findUnique({ where: { itemNumber: parsed.itemNumber }, select })
      : await prisma.jewelryPiece.findUnique({ where: { itemNumber: parsed.itemNumber }, select });
  if (!item) notFound();

  const section = parsed.kind === "gemstone" ? "gems" : "jewelry";
  if (!item.isPublished) {
    const user = (await auth())?.user;
    if (user && hasStaffArea(user, "catalog") && hasMarketAccess(user, item.market)) {
      return NextResponse.redirect(new URL(`/admin/${section}/${item.id}`, req.url));
    }
    notFound();
  }

  return NextResponse.redirect(new URL(withMarket(`/${section}/${item.slug}`, item.market === "lk" ? "lk" : "intl"), req.url));
}
