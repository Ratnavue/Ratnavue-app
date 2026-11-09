import type { Metadata } from "next";
import { PAGE_SEO } from "@/lib/seo-copy";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: PAGE_SEO.sizeGuide.title,
    description: PAGE_SEO.sizeGuide.description,
  });
}

const RING_SIZES: { us: string; uk: string; eu: string; circumferenceMm: number }[] = [
  { us: "4", uk: "H", eu: "47", circumferenceMm: 46.8 },
  { us: "5", uk: "J½", eu: "49", circumferenceMm: 49.3 },
  { us: "6", uk: "L½", eu: "52", circumferenceMm: 51.9 },
  { us: "7", uk: "N½", eu: "54", circumferenceMm: 54.4 },
  { us: "8", uk: "P½", eu: "57", circumferenceMm: 56.9 },
  { us: "9", uk: "R½", eu: "59", circumferenceMm: 59.5 },
  { us: "10", uk: "T½", eu: "62", circumferenceMm: 62.1 },
  { us: "11", uk: "V½", eu: "64", circumferenceMm: 64.6 },
  { us: "12", uk: "X½", eu: "67", circumferenceMm: 67.2 },
];

const NECKLACE_LENGTHS: { name: string; inches: string; fallsAt: string }[] = [
  { name: "Choker", inches: "14–16\"", fallsAt: "Base of the neck" },
  { name: "Princess", inches: "17–19\"", fallsAt: "Collarbone" },
  { name: "Matinee", inches: "20–24\"", fallsAt: "Top of the bust" },
  { name: "Opera", inches: "28–36\"", fallsAt: "Below the bust" },
  { name: "Rope", inches: "36\"+", fallsAt: "Waist or lower" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="font-serif text-xl text-charcoal">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-charcoal/75">{children}</div>
    </section>
  );
}

export default function SizeGuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-10 sm:px-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Size Guide" }]} />
      <p className="text-xs uppercase tracking-widest text-gold-deep">Reference</p>
      <h1 className="mt-2 font-serif text-4xl text-charcoal">Size Guide</h1>
      <p className="mt-4 text-sm text-charcoal/60">
        A guide to ring sizing and jewelry lengths, for both our international and Sri Lanka stores.
      </p>

      <Section id="rings" title="Ring Sizes">
        <p>
          If you already have a ring that fits the intended finger well, the most reliable way to size it is to take
          it to any local jeweler and ask them to measure the inner diameter — free almost everywhere, and more
          accurate than a printable chart.
        </p>
        <p>
          Without one on hand: wrap a strip of paper or string snugly around the base of the finger, mark where it
          overlaps, measure that length in millimeters, and compare it to the circumference column below.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border-subtle">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-ivory-soft text-xs uppercase tracking-wide text-charcoal/65">
                <th className="px-4 py-2 font-medium">US</th>
                <th className="px-4 py-2 font-medium">UK</th>
                <th className="px-4 py-2 font-medium">EU</th>
                <th className="px-4 py-2 font-medium">Circumference (mm)</th>
              </tr>
            </thead>
            <tbody>
              {RING_SIZES.map((row) => (
                <tr key={row.us} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 py-2 text-charcoal">{row.us}</td>
                  <td className="px-4 py-2 text-charcoal">{row.uk}</td>
                  <td className="px-4 py-2 text-charcoal">{row.eu}</td>
                  <td className="px-4 py-2 text-charcoal">{row.circumferenceMm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-charcoal/60">
          A piece listed with a specific ring size is made to that size only — check the product page&apos;s own
          Ring Size spec before ordering. Get in touch through the item&apos;s message thread if you need a different
          size and resizing is possible for that piece.
        </p>
      </Section>

      <Section id="necklaces" title="Necklace &amp; Pendant Lengths">
        <p>Where a length typically falls varies by neckline and build — use this as a starting point, not a rule.</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border-subtle">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-ivory-soft text-xs uppercase tracking-wide text-charcoal/65">
                <th className="px-4 py-2 font-medium">Style</th>
                <th className="px-4 py-2 font-medium">Length</th>
                <th className="px-4 py-2 font-medium">Typically Falls At</th>
              </tr>
            </thead>
            <tbody>
              {NECKLACE_LENGTHS.map((row) => (
                <tr key={row.name} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 py-2 text-charcoal">{row.name}</td>
                  <td className="px-4 py-2 text-charcoal">{row.inches}</td>
                  <td className="px-4 py-2 text-charcoal">{row.fallsAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="bracelets" title="Bracelet Sizing">
        <p>
          Wrap a soft measuring tape (or a string, then measure the string) around the wrist just below the wrist
          bone. Add ½&quot; (about 13 mm) for a comfortable fit, or ¼&quot; (about 6 mm) for a snugger one, then
          compare to the bracelet&apos;s own listed length on its product page.
        </p>
      </Section>
    </div>
  );
}
