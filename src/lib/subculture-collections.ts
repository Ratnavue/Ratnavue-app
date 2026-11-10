// Code-level "art direction" for the five hidden subculture landing pages
// at /collections/[slug] (see prisma SubcultureCollectionItem and
// src/lib/subculture-content.ts). Deliberately split from admin-editable
// content: colors, fonts, decor, and thematic groupings are design
// decisions an admin shouldn't need to hand-tune, while copy/images live
// in SubcultureContent (PageContent-backed) and product membership lives
// in SubcultureCollectionItem. Adding a sixth subculture later (Steampunk,
// etc.) means adding one entry here plus one PageVisibility key — no
// schema change, no new page component (requirement: reusable
// architecture, see AlternativeCollectionPage).
//
// Preferred-gemstone names below are editorial copy (a "Gemstones We Love
// For This Look" strip), not a strict filter against Mineral rows — some
// (Onyx, Labradorite, Smoky Quartz, Black Tourmaline) aren't in this
// catalog's current STANDARD_MINERALS (src/lib/gem-constants.ts) yet.
// That's a sourcing/master-data decision for the business, not something
// this feature should presume by auto-seeding minerals. The product
// filter's own "Gemstone" options are always derived from whatever
// Mineral values actually appear among a collection's assigned items, so
// they never drift from reality.

export const SUBCULTURE_KEYS = [
  "goth-dark-romantic",
  "vampire-gothic-fantasy",
  "dark-academia",
  "metal-rock",
  "witchy-occult",
] as const;

export type SubcultureKey = (typeof SUBCULTURE_KEYS)[number];

export interface ThematicSection {
  key: string;
  label: string;
  description: string;
  /** Case-insensitive substrings matched against an assigned gemstone's
   * mineral name (or a jewelry piece's linked gemstone) to bucket it into
   * this section for display. An item matching no section's hints still
   * shows in the collection — just outside any named grouping. */
  mineralHints: string[];
}

export interface SubcultureDef {
  key: SubcultureKey;
  slug: string;
  label: string;
  shortLabel: string;
  emoji: string;

  backgroundClass: string;
  heroOverlayClass: string;
  headingClass: string;
  bodyClass: string;
  kickerClass: string;
  accentClass: string;
  dividerClass: string;
  cardBorderClass: string;
  cardGlowClass: string;
  buttonVariant: "accent" | "outline-light";

  /** Extra `next/font` display face loaded for this collection's headline
   * only (see src/app/collections/layout.tsx) — undefined keeps the
   * site's default Cormorant serif, still restyled via headingClass. */
  headingFontVar?: string;

  /** Which decorative motif component renders behind the hero (see
   * src/components/collections/decor). */
  decor: "goth" | "vampire" | "dark-academia" | "metal" | "witchy";
  /** Config for the shared DriftParticles layer (src/components/collections/decor/DriftParticles.tsx)
   * — deliberately plain glyphs (✦ · ⟡), never emoji, so the effect reads
   * as premium dust/embers/stars rather than a costume-shop motif. */
  particles: {
    char: string;
    colorClassName: string;
    count: number;
    direction: "fall" | "rise";
    sizeRange: [number, number];
    durationRange: [number, number];
    opacity: number;
  };

  /** Label for the default single product grid ("The Collection",
   * "The Reading List", ...). Ignored when `sections` is set. */
  collectionGridLabel: string;
  /** Named thematic groupings (Vampire's Blood Red/Midnight/Twilight,
   * Witchy's Moon/Shadow/Mystic/Ember) — omitted for collections the
   * brief doesn't call this out for, which just render one grid. */
  sections?: ThematicSection[];

  preferredGemstones: string[];
  designNotes: string;
}

export const SUBCULTURE_COLLECTIONS: Record<SubcultureKey, SubcultureDef> = {
  "goth-dark-romantic": {
    key: "goth-dark-romantic",
    slug: "goth-dark-romantic",
    label: "Goth / Dark Romantic",
    shortLabel: "Dark Romantic",
    emoji: "🖤",
    backgroundClass: "bg-gradient-to-b from-[#141013] via-[#1a1418] to-[#0f0c0e]",
    heroOverlayClass: "bg-gradient-to-t from-[#0f0c0e] via-[#0f0c0e]/60 to-transparent",
    headingClass: "text-[#f2ece4]",
    bodyClass: "text-[#f2ece4]/70",
    // Lighter than the border/glow's own #8a5a6b (kept below for those
    // decorative, non-text uses) — the original measured ~3.7:1 against
    // this page's near-black backgrounds, short of WCAG AA's 4.5:1 for
    // the small text this drives (the kicker label and each product
    // card's "Request a Quote" link). This shade holds the same dusty-
    // rose hue at ~6.9:1.
    kickerClass: "text-[#c99aac]",
    accentClass: "text-[#c99aac]",
    dividerClass: "bg-[#8a5a6b]/40",
    cardBorderClass: "border-[#3a2e33] hover:border-[#8a5a6b]/50",
    cardGlowClass: "shadow-[0_0_40px_-12px_rgba(138,90,107,0.35)]",
    buttonVariant: "outline-light",
    decor: "goth",
    particles: { char: "✦", colorClassName: "text-[#f2ece4]", count: 16, direction: "rise", sizeRange: [3, 7], durationRange: [16, 26], opacity: 0.35 },
    collectionGridLabel: "The Edit",
    preferredGemstones: ["Black Spinel", "Dark Garnet", "Dark Purple Sapphire", "Amethyst", "Onyx", "Dark Blue Sapphire"],
    designNotes: "Victorian ironwork, cathedral silhouettes, candlelight and black lace — elegance, not horror.",
  },

  "vampire-gothic-fantasy": {
    key: "vampire-gothic-fantasy",
    slug: "vampire-gothic-fantasy",
    label: "Vampire / Gothic Fantasy",
    shortLabel: "Gothic Fantasy",
    emoji: "🧛",
    backgroundClass: "bg-gradient-to-b from-[#0b0507] via-[#1c0810] to-[#0b0507]",
    heroOverlayClass: "bg-gradient-to-t from-[#0b0507] via-[#0b0507]/55 to-transparent",
    headingClass: "text-[#f2e6e6]",
    bodyClass: "text-[#f2e6e6]/70",
    // Same contrast fix as Goth's kicker/accent above — the original
    // #a3283f measured under 3:1 against this page's near-black
    // backgrounds. This brighter crimson holds the hue at ~5.6:1.
    kickerClass: "text-[#e0546c]",
    accentClass: "text-[#e0546c]",
    dividerClass: "bg-[#a3283f]/50",
    cardBorderClass: "border-[#3d151d] hover:border-[#a3283f]/60",
    cardGlowClass: "shadow-[0_0_50px_-10px_rgba(163,40,63,0.4)]",
    buttonVariant: "accent",
    headingFontVar: "--font-cinzel",
    decor: "vampire",
    particles: { char: "·", colorClassName: "text-[#a3283f]", count: 20, direction: "rise", sizeRange: [4, 10], durationRange: [10, 18], opacity: 0.5 },
    collectionGridLabel: "The Collection",
    sections: [
      {
        key: "blood-red",
        label: "Blood Red",
        description: "Garnet, ruby, and red spinel — deep colour with an ancient pulse.",
        mineralHints: ["ruby", "garnet", "spinel", "red"],
      },
      {
        key: "midnight",
        label: "Midnight",
        description: "Black spinel and dark sapphire — colour so deep it reads as shadow.",
        mineralHints: ["black", "sapphire", "onyx", "zircon"],
      },
      {
        key: "twilight",
        label: "Twilight",
        description: "Amethyst and violet stones — the hour between dusk and dark.",
        mineralHints: ["amethyst", "purple", "violet", "tourmaline"],
      },
    ],
    preferredGemstones: ["Garnet", "Ruby", "Red Spinel", "Black Spinel", "Dark Sapphire", "Amethyst"],
    designNotes: "Moonlit towers, crimson velvet, mist — more dramatic than Goth, bats used only as the rarest accent.",
  },

  "dark-academia": {
    key: "dark-academia",
    slug: "dark-academia",
    label: "Dark Academia",
    shortLabel: "Dark Academia",
    emoji: "📚",
    backgroundClass: "bg-gradient-to-b from-[#1c140d] via-[#241a10] to-[#150f0a]",
    heroOverlayClass: "bg-gradient-to-t from-[#150f0a] via-[#150f0a]/55 to-transparent",
    headingClass: "text-[#ece2cd]",
    bodyClass: "text-[#ece2cd]/70",
    kickerClass: "text-gold",
    accentClass: "text-gold",
    dividerClass: "bg-gold/40",
    cardBorderClass: "border-[#3a2c1c] hover:border-gold/50",
    cardGlowClass: "shadow-[0_0_36px_-14px_rgba(179,145,90,0.35)]",
    buttonVariant: "accent",
    headingFontVar: "--font-courier-prime",
    decor: "dark-academia",
    particles: { char: "·", colorClassName: "text-gold-soft", count: 10, direction: "rise", sizeRange: [3, 6], durationRange: [20, 30], opacity: 0.3 },
    collectionGridLabel: "The Reading List",
    preferredGemstones: ["Dark Sapphire", "Garnet", "Smoky Quartz", "Amethyst", "Brown Zircon", "Dark Spinel"],
    designNotes: "Old libraries, leather and brass, candlelit study rooms — understated, oval/cushion cuts, signet settings.",
  },

  "metal-rock": {
    key: "metal-rock",
    slug: "metal-rock",
    label: "Metal / Rock",
    shortLabel: "Metal / Rock",
    emoji: "⛓️",
    backgroundClass: "bg-gradient-to-b from-[#0c0d0f] via-[#17191c] to-[#0c0d0f]",
    heroOverlayClass: "bg-gradient-to-t from-[#0c0d0f] via-[#0c0d0f]/60 to-transparent",
    headingClass: "text-[#e7e8ea]",
    bodyClass: "text-[#e7e8ea]/70",
    // The original #8a1f1f measured ~2.3:1 against this page's near-black
    // backgrounds — the worst offender of this feature's contrast pass.
    // This lighter red holds the hue at ~4.8:1. accentClass's light grey
    // was already comfortably high-contrast and is unchanged.
    kickerClass: "text-[#c9504f]",
    accentClass: "text-[#9aa0a8]",
    dividerClass: "bg-[#9aa0a8]/40",
    cardBorderClass: "border-[#2a2c30] hover:border-[#9aa0a8]/60",
    cardGlowClass: "shadow-[0_0_36px_-14px_rgba(154,160,168,0.3)]",
    buttonVariant: "outline-light",
    headingFontVar: "--font-bebas",
    decor: "metal",
    particles: { char: "✦", colorClassName: "text-[#c94b2f]", count: 14, direction: "fall", sizeRange: [2, 5], durationRange: [4, 9], opacity: 0.6 },
    collectionGridLabel: "The Arsenal",
    preferredGemstones: ["Black Spinel", "Onyx", "Hematite", "Dark Garnet", "Dark Sapphire", "Labradorite"],
    designNotes: "Stage lighting and brushed gunmetal, chunky signet rings and bold pendants — unisex, industrial, not merch.",
  },

  "witchy-occult": {
    key: "witchy-occult",
    slug: "witchy-occult",
    label: "Witchy / Occult",
    shortLabel: "Witchy / Occult",
    emoji: "🧙",
    backgroundClass: "bg-gradient-to-b from-[#0a1410] via-[#131022] to-[#0a1410]",
    heroOverlayClass: "bg-gradient-to-t from-[#0a1410] via-[#0a1410]/55 to-transparent",
    headingClass: "text-[#e8e6f0]",
    bodyClass: "text-[#e8e6f0]/70",
    kickerClass: "text-[#7a6fb0]",
    accentClass: "text-[#7a6fb0]",
    dividerClass: "bg-[#7a6fb0]/40",
    cardBorderClass: "border-[#241f38] hover:border-[#7a6fb0]/50",
    cardGlowClass: "shadow-[0_0_40px_-12px_rgba(122,111,176,0.35)]",
    buttonVariant: "outline-light",
    decor: "witchy",
    particles: { char: "✦", colorClassName: "text-[#e8e6f0]", count: 24, direction: "rise", sizeRange: [3, 8], durationRange: [14, 24], opacity: 0.4 },
    collectionGridLabel: "The Grimoire",
    sections: [
      {
        key: "moon",
        label: "Moon",
        description: "Labradorite and moonstone — sheen that shifts like moonlight on water.",
        mineralHints: ["labradorite", "moonstone"],
      },
      {
        key: "shadow",
        label: "Shadow",
        description: "Black spinel, black tourmaline, and onyx — protective, grounding darkness.",
        mineralHints: ["black", "onyx", "tourmaline", "zircon"],
      },
      {
        key: "mystic",
        label: "Mystic",
        description: "Amethyst and violet stones — intuition, clarity, quiet ritual.",
        mineralHints: ["amethyst", "purple", "violet"],
      },
      {
        key: "ember",
        label: "Ember",
        description: "Garnet and deep red stones — warmth held inside something dark.",
        mineralHints: ["garnet", "ruby", "red"],
      },
    ],
    preferredGemstones: ["Labradorite", "Amethyst", "Smoky Quartz", "Black Tourmaline", "Garnet", "Black Spinel"],
    designNotes: "Moon phases, botanical illustration, celestial diagrams — mystical and artistic, not a costume-shop occult store.",
  },
};

export function isSubcultureKey(value: string): value is SubcultureKey {
  return (SUBCULTURE_KEYS as readonly string[]).includes(value);
}

export const SUBCULTURE_LIST = SUBCULTURE_KEYS.map((key) => SUBCULTURE_COLLECTIONS[key]);
