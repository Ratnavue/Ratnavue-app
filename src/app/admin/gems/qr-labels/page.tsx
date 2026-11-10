import type { Metadata } from "next";
import { QrLabelSheet, parseIdsParam } from "@/components/admin/QrLabelSheet";

export const metadata: Metadata = { title: "Gemstone QR Labels" };

export default async function GemstoneQrLabelsPage({ searchParams }: PageProps<"/admin/gems/qr-labels">) {
  return <QrLabelSheet kind="gemstone" ids={parseIdsParam((await searchParams).ids)} />;
}
