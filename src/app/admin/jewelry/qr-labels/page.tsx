import type { Metadata } from "next";
import { QrLabelSheet, parseIdsParam } from "@/components/admin/QrLabelSheet";

export const metadata: Metadata = { title: "Jewelry QR Labels" };

export default async function JewelryQrLabelsPage({ searchParams }: PageProps<"/admin/jewelry/qr-labels">) {
  return <QrLabelSheet kind="jewelry" ids={parseIdsParam((await searchParams).ids)} />;
}
