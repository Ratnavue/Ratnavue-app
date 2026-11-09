// Single source of truth for gem master data. Both prisma/seed.ts and the
// client-side configurator import from here so the "fixed list of standard
// cuts" rule (no free-text / foreign cuts) can't drift between seed and UI.

export type CutCategory = "FACETED" | "CABOCHON";

export interface CutDef {
  name: string;
  slug: string;
  category: CutCategory;
}

export const STANDARD_CUTS: CutDef[] = [
  { name: "Round Brilliant", slug: "round-brilliant", category: "FACETED" },
  { name: "Oval", slug: "oval", category: "FACETED" },
  { name: "Cushion", slug: "cushion", category: "FACETED" },
  { name: "Emerald Cut", slug: "emerald-cut", category: "FACETED" },
  { name: "Princess", slug: "princess", category: "FACETED" },
  { name: "Pear (Teardrop)", slug: "pear", category: "FACETED" },
  { name: "Marquise", slug: "marquise", category: "FACETED" },
  { name: "Radiant", slug: "radiant", category: "FACETED" },
  { name: "Asscher", slug: "asscher", category: "FACETED" },
  { name: "Heart", slug: "heart", category: "FACETED" },
  { name: "Trillion (Trilliant)", slug: "trillion", category: "FACETED" },
  { name: "Baguette", slug: "baguette", category: "FACETED" },
  { name: "Octagon", slug: "octagon", category: "FACETED" },
  { name: "Rose Cut", slug: "rose-cut", category: "FACETED" },
  { name: "Round Cabochon", slug: "round-cabochon", category: "CABOCHON" },
  { name: "Oval Cabochon", slug: "oval-cabochon", category: "CABOCHON" },
  { name: "Sugarloaf Cabochon", slug: "sugarloaf-cabochon", category: "CABOCHON" },
  { name: "Buff-Top Cabochon", slug: "buff-top-cabochon", category: "CABOCHON" },
];

export interface MineralDef {
  name: string;
  slug: string;
  description: string;
  hueMin: number;
  hueMax: number;
}

// Hue ranges are on the standard 0-360 HSL wheel and deliberately constrain
// the configurator's color picker to physically plausible hues per mineral.
export const STANDARD_MINERALS: MineralDef[] = [
  {
    name: "Blue Sapphire",
    slug: "blue-sapphire",
    description: "Ceylon's signature gem — corundum in hues from cornflower to royal blue.",
    hueMin: 195,
    hueMax: 250,
  },
  {
    name: "Padparadscha Sapphire",
    slug: "padparadscha-sapphire",
    description: "A rare pink-orange corundum named for the lotus blossom.",
    hueMin: 10,
    hueMax: 35,
  },
  {
    name: "Pink Sapphire",
    slug: "pink-sapphire",
    description: "Corundum in vivid pink hues.",
    hueMin: 320,
    hueMax: 345,
  },
  {
    name: "Yellow Sapphire",
    slug: "yellow-sapphire",
    description: "Corundum in golden to lemon yellow hues.",
    hueMin: 45,
    hueMax: 60,
  },
  {
    name: "Ruby",
    slug: "ruby",
    description: "Red corundum, prized for pigeon-blood hues.",
    hueMin: 345,
    hueMax: 10,
  },
  {
    name: "Cat's Eye Chrysoberyl",
    slug: "cats-eye-chrysoberyl",
    description: "Chrysoberyl cut en cabochon to display chatoyancy.",
    hueMin: 45,
    hueMax: 90,
  },
  {
    name: "Alexandrite",
    slug: "alexandrite",
    description: "Colour-change chrysoberyl — green in daylight, red under incandescent light.",
    hueMin: 90,
    hueMax: 160,
  },
  {
    name: "Spinel",
    slug: "spinel",
    description: "An underrated Ceylon gem spanning red, pink, and vivid blue.",
    hueMin: 330,
    hueMax: 360,
  },
  {
    name: "Garnet",
    slug: "garnet",
    description: "A gem family spanning deep red to vivid green.",
    hueMin: 0,
    hueMax: 20,
  },
  {
    name: "Zircon",
    slug: "zircon",
    description: "Naturally brilliant, often heat-treated to a vivid blue.",
    hueMin: 190,
    hueMax: 220,
  },
  {
    name: "Tourmaline",
    slug: "tourmaline",
    description: "One of the most colour-diverse gem species.",
    hueMin: 100,
    hueMax: 340,
  },
  {
    name: "Moonstone",
    slug: "moonstone",
    description: "Feldspar prized for its ethereal blue sheen (adularescence).",
    hueMin: 200,
    hueMax: 240,
  },
  {
    name: "Aquamarine",
    slug: "aquamarine",
    description: "Blue-green beryl, cool and serene.",
    hueMin: 175,
    hueMax: 200,
  },
  {
    name: "Amethyst",
    slug: "amethyst",
    description: "Purple quartz, from lilac to deep violet.",
    hueMin: 260,
    hueMax: 285,
  },
  {
    name: "Citrine",
    slug: "citrine",
    description: "Golden-yellow quartz.",
    hueMin: 35,
    hueMax: 50,
  },
  {
    name: "Peridot",
    slug: "peridot",
    description: "Olivine in a distinctive lime to olive green.",
    hueMin: 70,
    hueMax: 90,
  },
  {
    name: "Topaz",
    slug: "topaz",
    description: "From colourless to imperial gold, blue, and pink.",
    hueMin: 25,
    hueMax: 45,
  },
];

export interface ClarityGradeDef {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}

export const CLARITY_GRADES: ClarityGradeDef[] = [
  {
    name: "Loupe Clean",
    slug: "loupe-clean",
    description: "No inclusions visible under 10x magnification — the finest clarity tier.",
    sortOrder: 0,
  },
  {
    name: "Eye Clean",
    slug: "eye-clean",
    description: "No inclusions visible to the naked eye, though some may show under magnification.",
    sortOrder: 1,
  },
  {
    name: "Slightly Included",
    slug: "slightly-included",
    description: "Minor inclusions may be visible to the naked eye on close inspection.",
    sortOrder: 2,
  },
  {
    name: "Included",
    slug: "included",
    description: "Inclusions are noticeable to the naked eye; character stones prized for their story.",
    sortOrder: 3,
  },
];

export const TREATMENTS = [
  { name: "Unheated", slug: "unheated" },
  { name: "Heated", slug: "heated" },
  { name: "Other", slug: "other" },
];

export const ORIGINS = [
  { name: "Ceylon (Sri Lanka)", slug: "ceylon", isCeylon: true },
  { name: "Other Origin", slug: "other-origin", isCeylon: false },
];

// Seed data for known gemological labs. `verifyUrlTemplate` is only
// pre-filled for GIA, whose report-check URL scheme is well documented and
// stable (https://www.gia.edu/report-check). The rest are seeded blank —
// admins fill in each lab's actual lookup URL themselves via
// /admin/master-data/certification-labs (or add labs not listed here).
export const CERTIFICATION_LABS = [
  { name: "GIA", slug: "gia", verifyUrlTemplate: "https://www.gia.edu/report-check?reportno={certId}" },
  { name: "GRS", slug: "grs", verifyUrlTemplate: null as string | null },
  { name: "AIGS", slug: "aigs", verifyUrlTemplate: null as string | null },
  { name: "Gübelin", slug: "gubelin", verifyUrlTemplate: null as string | null },
  { name: "IGI", slug: "igi", verifyUrlTemplate: null as string | null },
];

// Mirrors the GemSpecialty enum in prisma/schema.prisma (labels: messages
// catalog.specialty.*). Order is the display order.
export const GEM_SPECIALTIES = ["COLOR_CHANGE", "STAR", "CATS_EYE", "BI_COLOR"] as const;
export type GemSpecialtyKey = (typeof GEM_SPECIALTIES)[number];

// The admin form's labels and hints (the back office is English-only; the
// storefront's translated labels are in messages catalog.specialty.*).
export const GEM_SPECIALTY_ADMIN: Record<GemSpecialtyKey, { label: string; hint: string }> = {
  COLOR_CHANGE: { label: "Colour change", hint: "Shows a different colour in daylight and incandescent light (alexandrite effect)." },
  STAR: { label: "Star", hint: "Asterism — a star of light across a cabochon." },
  CATS_EYE: { label: "Cat's eye", hint: "Chatoyancy — a single bright band across a cabochon." },
  BI_COLOR: { label: "Bi-colour", hint: "Two distinct colour zones in one stone." },
};

export const PIECE_TYPES = ["RING", "PENDANT", "EARRINGS", "NECKLACE", "BRACELET", "ANKLET", "JEWELRY_SET", "BROOCH", "CUFFLINKS", "OTHER"] as const;

export const METAL_TYPES = [
  { value: "GOLD", label: "Gold" },
  { value: "WHITE_GOLD", label: "White Gold" },
  { value: "ROSE_GOLD", label: "Rose Gold" },
  { value: "PLATINUM", label: "Platinum" },
  { value: "SILVER", label: "Silver" },
] as const;
