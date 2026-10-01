import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/admin/BackLink";
import { PageVisibilityControl } from "@/components/admin/PageVisibilityControl";
import { getPageVisibility } from "@/lib/page-visibility";
import { DesignStudio, type InitialDesign } from "@/components/design-studio/DesignStudio";
import type { StudioState } from "@/lib/design-studio/types";

export const metadata: Metadata = { title: "Design Studio" };

export default async function AdminDesignStudioPage({ searchParams }: PageProps<"/admin/design-studio">) {
  const sp = await searchParams;
  const designId = typeof sp.design === "string" ? sp.design : undefined;

  const [visibility, design] = await Promise.all([
    getPageVisibility("design-studio"),
    designId ? prisma.jewelryDesign.findUnique({ where: { id: designId } }) : null,
  ]);

  const initialDesign: InitialDesign | null = design
    ? { id: design.id, name: design.name, data: design.data as unknown as StudioState, thumbnailUrl: design.thumbnailUrl, quoteRequestId: design.quoteRequestId }
    : null;

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Design Studio</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        A 2D sketch tool for jewelry layouts — split the canvas into views, copy a segment between them, and repeat a
        stone or prong pattern evenly around a band.
      </p>

      <div className="mt-6 rounded-xl border border-border-subtle bg-surface p-5">
        <PageVisibilityControl pageKey="design-studio" currentState={visibility} />
        <p className="mt-2 text-xs text-charcoal/50">Controls whether customers can reach this tool at /design-studio. This admin page is unaffected either way.</p>
      </div>

      <div className="mt-6">
        {/* key forces a remount when switching designs via the "My Designs"
            list (query param change alone wouldn't re-run DesignStudio's
            useState initializers). */}
        <DesignStudio key={initialDesign?.id ?? "new"} mode="admin" initialDesign={initialDesign} />
      </div>
    </div>
  );
}
