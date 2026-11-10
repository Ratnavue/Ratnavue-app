// Search-result titles and descriptions for the storefront's fixed pages, in
// one place so they stay unique and within length (see seo-copy.test.ts:
// every description leaves room for the Sri Lanka store's rupee note).
// Product, collection and promotion pages build theirs from their own data.

export const PAGE_SEO = {
  homeLk: {
    title: "Ratnavue Sri Lanka — Ceylon Gemstones & Jewelry",
    description: "Shop Ceylon sapphires, rubies and fine jewelry priced in rupees and delivered across Sri Lanka — or ask us to source the stone you want.",
  },
  gems: {
    title: "Ceylon Gemstones",
    description: "Shop natural Ceylon sapphires, rubies and spinels — each stone listed with its cut, colour, clarity and treatment.",
  },
  gemsAll: {
    title: "Shop All Ceylon Gemstones",
    description: "Browse every Ceylon gemstone in stock and filter by mineral, cut, colour, clarity, treatment, origin, carat and price.",
  },
  jewelry: {
    title: "Fine Jewelry",
    description: "Rings, pendants and earrings set with Ceylon gemstones — fine jewelry for women, men and couples, made around the stone.",
  },
  jewelryAll: {
    title: "Shop All Fine Jewelry",
    description: "Browse every piece of Ceylon gemstone jewelry in stock and filter by piece type, metal, audience and price.",
  },
  // A single-mineral category (/gems?mineral=sapphire). {mineral} = its name.
  gemsMineral: {
    title: "Ceylon {mineral} Gemstones",
    description: "Natural Ceylon {mineral} gemstones, each listed with its cut, colour, clarity and treatment.",
  },
  // A piece-type category (/jewelry?pieceType=RING). {type} = "Rings" etc.
  jewelryType: {
    title: "Ceylon Gemstone {type}",
    description: "Ceylon gemstone {type} — each piece made around its stone, with the stone and metal listed in full.",
  },
  // Both (/jewelry?audience=women&pieceType=RING).
  jewelryAudienceType: {
    title: "{type} for {audience}",
    description: "Ceylon gemstone {type} for {audience} — each piece made around its stone, with the stone and metal listed in full.",
  },
  // {audience} = "Women", "Men", "Couples", "Everyone" style labels.
  jewelryAudience: {
    title: "Fine Jewelry for {audience}",
    description: "Ceylon gemstone jewelry for {audience} — rings, pendants, earrings and more, each piece made around its stone.",
  },
  configurator: {
    title: "Design Your Gem",
    description: "Configure a Ceylon gemstone by mineral, cut, carat, colour, tone and clarity, then request a private quote.",
  },
  sourcing: {
    title: "Gem Sourcing",
    description: "Can't find the stone you want? Tell us what you have in mind and we'll source it from Sri Lanka's gem markets — no obligation.",
  },
  about: {
    title: "Our Story",
    description: "How Ratnavue sources, grades and discloses every Ceylon gem — honest grading, treatment disclosed, stone-first design.",
  },
  contact: {
    title: "Contact Us",
    description: "Ask Ratnavue about a gemstone, a custom piece, an order or a sourcing request — our team in Sri Lanka will reply.",
  },
  sizeGuide: {
    title: "Size Guide",
    description: "Find your ring size and the right necklace and bracelet lengths before you order — measuring tips and size charts.",
  },
  terms: {
    title: "Terms & Conditions",
    description: "The terms for buying Ceylon gemstones and fine jewelry from Ratnavue: orders, payment, delivery, returns and certificates.",
  },
  search: {
    title: "Search",
    description: "Search Ratnavue's Ceylon gemstones and fine jewelry.",
  },
  designStudio: {
    title: "Design Studio",
    description: "Sketch your own jewelry idea — split the canvas, repeat a stone pattern around a band — and send it as a custom request.",
  },
  auctions: {
    title: "Auctions",
    description: "Bid on selected Ceylon gemstones and fine jewelry in Ratnavue's auctions — each lot independently graded.",
  },
  auctionsComingSoon: {
    title: "Auctions — Coming Soon",
    description: "Ratnavue auctions of selected Ceylon gemstones and fine jewelry are coming soon.",
  },
  // {item} = the lot's gem or jewelry name.
  auctionItem: {
    title: "{item} — Auction",
    description: "Bid on {item} in a Ratnavue auction of Ceylon gemstones and fine jewelry.",
  },
  // {label} = the active seasonal theme, e.g. "Halloween".
  promotionsCollection: {
    title: "{label} Collection",
    description: "Ceylon gemstones and fine jewelry from our {label} collection, at promotional prices for a limited time.",
  },
  promotionsComingSoon: {
    title: "Promotions — Coming Soon",
    description: "Ratnavue's next seasonal collection of Ceylon gemstones and fine jewelry is coming soon.",
  },
} as const;

// How each jewelry audience reads in a title ("Fine Jewelry for Couples").
export const AUDIENCE_SEO_LABELS: Record<string, string> = { women: "Women", men: "Men", couple: "Couples", unisex: "Everyone" };

export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}
