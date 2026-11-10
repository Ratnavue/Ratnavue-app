import { itemQrResponse } from "@/lib/item-qr";

// The item's QR code for download/printing — see itemQrResponse.
export async function GET(req: Request, ctx: RouteContext<"/admin/gems/[id]/qr">) {
  const { id } = await ctx.params;
  return itemQrResponse("gemstone", id, new URL(req.url));
}
