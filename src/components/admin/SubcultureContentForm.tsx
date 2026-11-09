"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateSubcultureText, updateSubcultureSlug } from "@/actions/subculture-content";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { Input, Textarea, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { PageVisibilityControl } from "@/components/admin/PageVisibilityControl";
import { SubcultureImageField } from "@/components/admin/SubcultureImageField";
import { SubcultureGalleryManager } from "@/components/admin/SubcultureGalleryManager";
import { SubcultureItemsManager } from "@/components/admin/SubcultureItemsManager";
import { SUBCULTURE_KEYS, SUBCULTURE_COLLECTIONS, type SubcultureKey } from "@/lib/subculture-collections";
import type { SubcultureContent } from "@/lib/subculture-content";
import type { PageVisibilityState } from "@/lib/page-visibility";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  name: string;
  specs: string;
}

interface CollectionItemRow {
  id: string;
  label: string;
  featured: boolean;
}

// Top-level admin editor for all five hidden subculture collections —
// mirrors SeasonalContentForm.tsx's tab shape (one theme = one tab, each
// its own independently-saved forms so switching tabs never loses an
// unsaved edit), extended with the richer per-collection image slots and
// gallery fields this feature needs.
export function SubcultureContentForm({
  contentByCollection,
  visibilityByCollection,
  gemstones,
  jewelry,
  itemsByCollection,
}: {
  contentByCollection: Record<SubcultureKey, SubcultureContent>;
  visibilityByCollection: Record<SubcultureKey, PageVisibilityState>;
  gemstones: Option[];
  jewelry: Option[];
  itemsByCollection: Record<SubcultureKey, CollectionItemRow[]>;
}) {
  const [tab, setTab] = useState<SubcultureKey>(SUBCULTURE_KEYS[0]);
  const theme = SUBCULTURE_COLLECTIONS[tab];
  const content = contentByCollection[tab];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {SUBCULTURE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition-colors",
              tab === key ? "border-charcoal bg-night text-cream" : "border-border-subtle text-charcoal/70 hover:border-charcoal/40",
            )}
          >
            {SUBCULTURE_COLLECTIONS[key].emoji} {SUBCULTURE_COLLECTIONS[key].shortLabel}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-charcoal/50">Never linked from the main site — reachable only by direct URL.</p>
        <Link href={`/collections/${content.urlSlug}`} target="_blank" className="text-sm text-gold underline">
          View live page ↗
        </Link>
      </div>

      <div className="mt-6 rounded-xl border border-border-subtle bg-surface p-5">
        <SubcultureSlugForm key={tab} collection={tab} initialSlug={content.urlSlug} />
      </div>

      <div className="mt-6 rounded-xl border border-border-subtle bg-surface p-5">
        <PageVisibilityControl key={tab} pageKey={tab} currentState={visibilityByCollection[tab]} />
      </div>

      <div className="mt-8 border-t border-border-subtle pt-8">
        <p className="font-serif text-lg text-charcoal">Copy</p>
        <div className="mt-4">
          <SubcultureTextForm key={tab} collection={tab} initial={content} />
        </div>
      </div>

      <div className="mt-10 border-t border-border-subtle pt-8">
        <p className="font-serif text-lg text-charcoal">Hero &amp; Background Images</p>
        <p className="mt-1 text-sm text-charcoal/60">
          Empty slots fall back to {theme.label}&apos;s themed gradient and decorative motif — real editorial
          photography can be added any time.
        </p>
        <div key={tab} className="mt-4 grid gap-6 sm:grid-cols-2">
          <SubcultureImageField collection={tab} field="heroImage" label="Hero Image (desktop)" currentSrc={content.heroImage} aspect="aspect-[16/9]" />
          <SubcultureImageField collection={tab} field="heroImageMobile" label="Hero Image (mobile crop)" currentSrc={content.heroImageMobile} aspect="aspect-[9/16]" />
          <SubcultureImageField collection={tab} field="backgroundImage" label="Background Image" currentSrc={content.backgroundImage} aspect="aspect-[16/9]" />
          <SubcultureImageField collection={tab} field="ogImage" label="Social Share (OG) Image" currentSrc={content.ogImage} aspect="aspect-[1200/630]" />
        </div>
      </div>

      <div className="mt-10 border-t border-border-subtle pt-8">
        <p className="font-serif text-lg text-charcoal">Banner Images</p>
        <div key={`banners-${tab}`} className="mt-4">
          <SubcultureGalleryManager collection={tab} field="bannerImages" images={content.bannerImages} />
        </div>
      </div>

      <div className="mt-10 border-t border-border-subtle pt-8">
        <p className="font-serif text-lg text-charcoal">Lifestyle Gallery</p>
        <div key={`lifestyle-${tab}`} className="mt-4">
          <SubcultureGalleryManager collection={tab} field="lifestyleImages" images={content.lifestyleImages} />
        </div>
      </div>

      <div className="mt-10 border-t border-border-subtle pt-8">
        <p className="font-serif text-lg text-charcoal">{theme.label} Products</p>
        <p className="mt-1 text-sm text-charcoal/60">
          Assign existing gemstones and jewelry to this collection — a single item can belong to several
          collections at once. Featured items get a badge on the public page.
        </p>
        <div className="mt-4">
          <SubcultureItemsManager key={tab} collection={tab} gemstones={gemstones} jewelry={jewelry} items={itemsByCollection[tab]} />
        </div>
      </div>
    </div>
  );
}

// Renaming takes effect immediately (the route resolves whatever's
// currently saved on every request — see resolveBySlug in
// collections/[slug]/page.tsx), but the old URL simply stops working;
// nothing redirects it forward, so this warns before saving.
function SubcultureSlugForm({ collection, initialSlug }: { collection: SubcultureKey; initialSlug: string }) {
  const router = useRouter();
  const [slug, setSlug] = useState(initialSlug);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const confirm = useConfirm();

  async function handleSubmit() {
    setError(null);
    setSaved(false);
    if (
      slug !== initialSlug &&
      !(await confirm(`Change the live URL from /collections/${initialSlug} to /collections/${slug}? The old link will stop working immediately.`))
    ) {
      return;
    }
    setPending(true);
    try {
      const result = await updateSubcultureSlug(collection, slug);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Label htmlFor="urlSlug">URL Slug</Label>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-charcoal/50">/collections/</span>
        <Input id="urlSlug" value={slug} onChange={(e) => setSlug(e.target.value)} className="w-64" />
        <Button type="button" variant="outline" size="sm" disabled={pending || slug === initialSlug} onClick={handleSubmit}>
          {pending ? "Saving..." : "Save Slug"}
        </Button>
        {saved && !error && <span className="text-sm text-green-700">Saved.</span>}
      </div>
      <p className="mt-1.5 text-xs text-charcoal/50">
        Lowercase letters, numbers, and hyphens only. Changing this updates the live page immediately — the old URL
        stops working right away, nothing forwards it.
      </p>
      <FieldError>{error ?? undefined}</FieldError>
    </div>
  );
}

function SubcultureTextForm({ collection, initial }: { collection: SubcultureKey; initial: SubcultureContent }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    setPending(true);
    const result = await updateSubcultureText(collection, formData);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="max-w-2xl space-y-4">
      <div>
        <Label htmlFor="heroKicker">Hero Kicker</Label>
        <Input id="heroKicker" name="heroKicker" defaultValue={initial.heroKicker} />
      </div>
      <div>
        <Label htmlFor="heroHeading">Hero Heading</Label>
        <Input id="heroHeading" name="heroHeading" defaultValue={initial.heroHeading} />
      </div>
      <div>
        <Label htmlFor="heroSubtext">Hero Subtext</Label>
        <Textarea id="heroSubtext" name="heroSubtext" defaultValue={initial.heroSubtext} />
      </div>
      <div>
        <Label htmlFor="heroCtaLabel">Hero Button Label</Label>
        <Input id="heroCtaLabel" name="heroCtaLabel" defaultValue={initial.heroCtaLabel} className="w-56" />
      </div>
      <div>
        <Label htmlFor="introKicker">Story Kicker</Label>
        <Input id="introKicker" name="introKicker" defaultValue={initial.introKicker} />
      </div>
      <div>
        <Label htmlFor="introHeading">Story Heading</Label>
        <Input id="introHeading" name="introHeading" defaultValue={initial.introHeading} />
      </div>
      <div>
        <Label htmlFor="introBody">Story Body</Label>
        <Textarea id="introBody" name="introBody" defaultValue={initial.introBody} className="min-h-40" />
      </div>
      <div>
        <Label htmlFor="crossLinkBlurb">Cross-Collection Footer Heading</Label>
        <Input id="crossLinkBlurb" name="crossLinkBlurb" defaultValue={initial.crossLinkBlurb} />
      </div>
      <div>
        <Label htmlFor="seoTitle">SEO Title</Label>
        <Input id="seoTitle" name="seoTitle" defaultValue={initial.seoTitle} />
      </div>
      <div>
        <Label htmlFor="seoDescription">SEO Description</Label>
        <Textarea id="seoDescription" name="seoDescription" defaultValue={initial.seoDescription} />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="gold" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
        {saved && !error && <span className="text-sm text-green-700">Saved.</span>}
      </div>
      <FieldError>{error ?? undefined}</FieldError>
    </form>
  );
}
