"use client";

import { GemCard } from "@/components/catalog/GemCard";
import { ViewToggle } from "@/components/catalog/ViewToggle";
import { RevealGroup, RevealItem } from "@/components/layout/Reveal";
import { useCatalogView } from "@/lib/useCatalogView";
import { cn } from "@/lib/utils";
import type { SpecialtyTag } from "@/lib/gem-constants";

export interface GemResultItem {
  id: string;
  slug: string;
  name: string;
  mineral: { name: string };
  cut: { slug: string; name: string };
  caratWeight: number;
  colorHue: number;
  colorLightness: number;
  clarityGrade: { slug: string; name: string };
  treatment: { name: string };
  origin: { isCeylon: boolean };
  specialtyTags?: readonly SpecialtyTag[];
  stockStatus: string;
  media: { isPrimary: boolean; url: string }[];
  price: number | null;
  showPrice: boolean;
  /** The retail direct-purchase price — see CardPrice's own doc comment. */
  retailPrice?: number | null;
  /** Set only when this gem is in the currently *live* promotional
   * collection — see getActivePromotionMaps. */
  promoPrice?: number | null;
}

export function GemResults({
  gems,
  wishlistedIds,
  isAuthenticated,
}: {
  gems: GemResultItem[];
  /** ids currently saved by the viewer — see lib/wishlist.ts's
   * getWishlistedIds. Omit (or pass an empty Set) for a guest. */
  wishlistedIds?: Set<string>;
  isAuthenticated?: boolean;
}) {
  const [view, setView] = useCatalogView();

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <ViewToggle view={view} onChange={setView} />
      </div>

      <RevealGroup className={cn(view === "grid" ? "grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 sm:gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "flex flex-col gap-4")}>
        {gems.map((gem, i) => (
          <RevealItem key={gem.id}>
            <GemCard
              view={view}
              // First row (up to xl's 5 columns) loads eagerly rather than
              // lazily — Next.js was flagging one of these as the page's
              // Largest Contentful Paint element and recommending exactly
              // this. Below the fold, lazy (the Image default) is correct.
              priority={i < 5}
              id={gem.id}
              isWishlisted={wishlistedIds?.has(gem.id)}
              isAuthenticated={isAuthenticated}
              slug={gem.slug}
              name={gem.name}
              mineralName={gem.mineral.name}
              cutSlug={gem.cut.slug}
              cutName={gem.cut.name}
              caratWeight={gem.caratWeight}
              colorHue={gem.colorHue}
              colorLightness={gem.colorLightness}
              claritySlug={gem.clarityGrade.slug}
              clarityName={gem.clarityGrade.name}
              treatmentName={gem.treatment.name}
              isCeylon={gem.origin.isCeylon}
              specialties={gem.specialtyTags}
              stockStatus={gem.stockStatus}
              primaryImageUrl={gem.media.find((m) => m.isPrimary)?.url ?? gem.media[0]?.url}
              price={gem.price}
              showPrice={gem.showPrice}
              retailPrice={gem.retailPrice}
              promoPrice={gem.promoPrice}
            />
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  );
}
