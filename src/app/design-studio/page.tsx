import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPageVisibility } from "@/lib/page-visibility";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { DesignStudio, type InitialDesign } from "@/components/design-studio/DesignStudio";
import type { StudioState } from "@/lib/design-studio/types";

export const metadata: Metadata = {
  title: "Design Studio",
  description: "Sketch your own jewelry idea — split the canvas, repeat a stone pattern around a band, and submit it as a custom design request.",
};

export default async function CustomerDesignStudioPage({ searchParams }: PageProps<"/design-studio">) {
  const visibility = await getPageVisibility("design-studio");
  // Unlike /promotions or /auction, this page has no themed "Coming Soon"
  // teaser — there's nothing to show for that state but the real, working
  // editor, which would defeat the point of choosing it. So Coming Soon
  // behaves the same as Hidden here specifically: only Live actually
  // unlocks the page (see Navbar's matching showDesignStudio condition).
  if (visibility !== "LIVE") notFound();

  const session = await auth();

  // Resumes a sketch from "Continue a sketch" on /account/custom-designs
  // (see actions/design-studio.ts's listMyInProgressDesigns) — an
  // unrecognized id, someone else's design, or no session at all just
  // falls through to a blank canvas rather than a hard error, same
  // "informational, not a boundary" treatment every other soft-fail here
  // gets (this is a convenience deep link, not an authorization check
  // anything actually depends on).
  const sp = await searchParams;
  const designId = typeof sp.design === "string" ? sp.design : undefined;
  const design = designId && session?.user ? await prisma.jewelryDesign.findUnique({ where: { id: designId } }) : null;
  const initialDesign: InitialDesign | null =
    design && design.userId === session?.user?.id
      ? { id: design.id, name: design.name, data: design.data as unknown as StudioState, thumbnailUrl: design.thumbnailUrl, quoteRequestId: design.quoteRequestId }
      : null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Design Studio" }]} />
      <div className="mb-10 max-w-2xl">
        <p className="text-xs uppercase tracking-widest text-gold-deep">Design Studio</p>
        <h1 className="mt-2 font-serif text-4xl text-charcoal">Sketch your own piece</h1>
        <p className="mt-3 text-charcoal/65">
          Lay out a ring, earring, pendant or bracelet idea on the canvas below — add stones and a band, split the
          view to sketch from another angle, and repeat a pattern evenly around a band. When you&apos;re happy with
          it, submit it and our design team will follow up with next steps.
        </p>
      </div>

      {/* key forces a remount when resuming a different sketch via
          ?design= — a query-param change alone wouldn't re-run
          DesignStudio's useState initializers (see the admin page's
          identical comment). */}
      <DesignStudio key={initialDesign?.id ?? "new"} mode="customer" initialDesign={initialDesign} isAuthenticated={!!session?.user} />
    </div>
  );
}
