import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPageVisibility } from "@/lib/page-visibility";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { DesignStudio } from "@/components/design-studio/DesignStudio";

export const metadata: Metadata = {
  title: "Design Studio",
  description: "Sketch your own jewelry idea — split the canvas, repeat a stone pattern around a band, and submit it as a custom design request.",
};

export default async function CustomerDesignStudioPage() {
  const visibility = await getPageVisibility("design-studio");
  if (visibility === "HIDDEN") notFound();

  const session = await auth();

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

      <DesignStudio mode="customer" isAuthenticated={!!session?.user} />
    </div>
  );
}
