// Display colours for the stylised gem art (StylizedGem) — one representative
// colour per mineral, keyed by slug. Mineral master data only stores a hue
// range, which can't express the stones whose character is in saturation or
// lightness rather than hue (white sapphire, moonstone, a greyish spinel), so
// the common Ceylon stones get a hand-picked colour and anything an admin
// adds later falls back to the middle of its hue range.

const GEM_COLORS: Record<string, string> = {
  "blue-sapphire": "#5b7cc9",
  "white-sapphire": "#e4dccb",
  "pink-sapphire": "#e3929b",
  "yellow-sapphire": "#e5c45c",
  "purple-sapphire": "#8d6bbd",
  padparadscha: "#ea9a7c",
  ruby: "#c23a52",
  spinel: "#6e6280",
  alexandrite: "#4f8a6e",
  "cats-eye-chrysoberyl": "#c9a44f",
  "cat-s-eye-chrysoberyl": "#c9a44f",
  chrysoberyl: "#c9b24f",
  moonstone: "#b9c8d8",
  zircon: "#6aa6cf",
  garnet: "#8e2b3a",
  topaz: "#d9a24e",
  tourmaline: "#4f9a7d",
  aquamarine: "#7fc0d4",
  amethyst: "#8a62b5",
  citrine: "#e0aa3e",
  emerald: "#2f9a64",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** A representative display colour for a mineral (hex), by slug or name. */
export function gemColorFor(slugOrName: string, hueRange?: { hueMin: number; hueMax: number }): string {
  const known = GEM_COLORS[slugOrName] ?? GEM_COLORS[slugify(slugOrName)];
  if (known) return known;
  const hue = hueRange ? Math.round((hueRange.hueMin + hueRange.hueMax) / 2) : 220;
  return hslToHex(hue, 50, 58);
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}

/** Blend a hex colour toward white by `amount` (0–1). */
export function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (255 - c) * amount));
  return "#" + ch.map((c) => c.toString(16).padStart(2, "0")).join("");
}
