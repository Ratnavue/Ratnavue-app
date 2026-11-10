import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasMarketAccess, hasStaffArea } from "@/lib/rbac";
import { SITE_URL } from "@/lib/seo";
import { itemScanPath, type ItemKind } from "@/lib/item-number";

// QR codes for printed item labels. The code encodes the item NUMBER's scan
// URL (/i/G-000123), never the slug — renaming an item changes its slug, but
// its number and therefore its printed label stay valid forever.

/** The full URL a label's QR code encodes. */
export function itemScanUrl(itemNumber: string): string {
  return SITE_URL.replace(/\/+$/, "") + itemScanPath(itemNumber);
}

// "M" error correction survives a scuffed or partly covered label; a 4-module
// quiet zone is what the QR spec asks for so phone cameras lock on reliably.
const QR_OPTIONS = { errorCorrectionLevel: "M", margin: 4 } as const;

export function itemQrPng(itemNumber: string, width = 1024): Promise<Buffer> {
  return QRCode.toBuffer(itemScanUrl(itemNumber), { ...QR_OPTIONS, type: "png", width });
}

export function itemQrSvg(itemNumber: string): Promise<string> {
  return QRCode.toString(itemScanUrl(itemNumber), { ...QR_OPTIONS, type: "svg" });
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}

/**
 * A print-ready label: the QR code with the item number (and, optionally, the
 * item's name) underneath, so a label is still identifiable by eye. SVG so it
 * prints sharp at any size; the text is rendered by whatever opens it.
 */
export async function itemQrLabelSvg(itemNumber: string, name?: string): Promise<string> {
  const qr = QRCode.create(itemScanUrl(itemNumber), { errorCorrectionLevel: QR_OPTIONS.errorCorrectionLevel });
  const size = qr.modules.size;
  const quiet = QR_OPTIONS.margin;
  const box = size + quiet * 2;
  let path = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.modules.get(x, y)) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }
  const label = name ? (name.length > 34 ? `${name.slice(0, 33)}…` : name) : null;
  const textHeight = label ? 9 : 5.5;
  const height = box + textHeight;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${height}" width="${box * 10}" height="${height * 10}" shape-rendering="crispEdges">`,
    `<rect width="${box}" height="${height}" fill="#fff"/>`,
    `<path fill="#000" d="${path}"/>`,
    `<text x="${box / 2}" y="${box + 2}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="3.6" font-weight="700" fill="#000" shape-rendering="auto">${escapeXml(itemNumber)}</text>`,
    label
      ? `<text x="${box / 2}" y="${box + 6}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="2.4" fill="#333" shape-rendering="auto">${escapeXml(label)}</text>`
      : "",
    `</svg>`,
  ].join("");
}

const FORMATS = ["png", "svg", "label"] as const;
type QrFormat = (typeof FORMATS)[number];

/**
 * The admin "Download QR" endpoint shared by /admin/gems/[id]/qr and
 * /admin/jewelry/[id]/qr. ?format=png (default) | svg | label;
 * ?download=1 sends it as a file named after the item number.
 */
export async function itemQrResponse(kind: ItemKind, id: string, url: URL): Promise<Response> {
  const user = (await auth())?.user;
  if (!user || !hasStaffArea(user, "catalog")) return new Response("Not found", { status: 404 });

  const item =
    kind === "gemstone"
      ? await prisma.gemstone.findUnique({ where: { id }, select: { itemNumber: true, name: true, market: true } })
      : await prisma.jewelryPiece.findUnique({ where: { id }, select: { itemNumber: true, name: true, market: true } });
  if (!item || !hasMarketAccess(user, item.market)) return new Response("Not found", { status: 404 });

  const requested = url.searchParams.get("format");
  const format: QrFormat = (FORMATS as readonly string[]).includes(requested ?? "") ? (requested as QrFormat) : "png";
  const download = url.searchParams.get("download") === "1";

  let body: BodyInit;
  let contentType: string;
  let filename: string;
  if (format === "png") {
    body = new Uint8Array(await itemQrPng(item.itemNumber));
    contentType = "image/png";
    filename = `${item.itemNumber}-qr.png`;
  } else if (format === "svg") {
    body = await itemQrSvg(item.itemNumber);
    contentType = "image/svg+xml";
    filename = `${item.itemNumber}-qr.svg`;
  } else {
    body = await itemQrLabelSvg(item.itemNumber, item.name);
    contentType = "image/svg+xml";
    filename = `${item.itemNumber}-label.svg`;
  }

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
      ...(download ? { "Content-Disposition": `attachment; filename="${filename}"` } : {}),
    },
  });
}
