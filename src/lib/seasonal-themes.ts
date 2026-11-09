export type SeasonalThemeKey = "spring" | "summer" | "autumn" | "winter" | "halloween";

export interface SeasonalThemeDef {
  key: SeasonalThemeKey;
  label: string;
  backgroundClass: string;
  /** Whether this theme's backgroundClass is dark enough for light
   * (ivory) text — Navbar reads this to decide whether /promotions can
   * safely use the transparent-over-hero nav treatment (see its own
   * TRANSPARENT_NAV_ROUTES comment): Halloween's hero is dark like every
   * subculture collection page, but Spring/Summer/Autumn/Winter's are
   * light, where transparent ivory nav text/logo would go illegible. */
  isDark: boolean;
  headingClass: string;
  bodyClass: string;
  kickerClass: string;
  /** Falling suits autumn leaves/winter snow; rising reads better for
   * spring petals and summer sparkles drifting up into a warm sky. */
  particleDirection: "fall" | "rise";
  particles: string[];
  particleCount: number;
  particleSizeRange: [number, number];
  particleDurationRange: [number, number];
}

export const SEASONAL_THEMES: Record<SeasonalThemeKey, SeasonalThemeDef> = {
  spring: {
    key: "spring",
    label: "Spring",
    backgroundClass: "bg-gradient-to-b from-rose-50 via-ivory to-ivory-soft",
    isDark: false,
    headingClass: "text-charcoal",
    bodyClass: "text-charcoal/70",
    kickerClass: "text-rose-400",
    particleDirection: "rise",
    particles: ["🌸", "🌷"],
    particleCount: 24,
    particleSizeRange: [14, 26],
    particleDurationRange: [9, 16],
  },
  summer: {
    key: "summer",
    label: "Summer",
    backgroundClass: "bg-gradient-to-b from-amber-50 via-gold-soft/25 to-ivory",
    isDark: false,
    headingClass: "text-charcoal",
    bodyClass: "text-charcoal/70",
    kickerClass: "text-gold-deep",
    particleDirection: "rise",
    particles: ["✨", "☀️"],
    particleCount: 20,
    particleSizeRange: [10, 20],
    particleDurationRange: [10, 18],
  },
  autumn: {
    key: "autumn",
    label: "Autumn",
    backgroundClass: "bg-gradient-to-b from-orange-50 via-amber-100/50 to-ivory-soft",
    isDark: false,
    headingClass: "text-charcoal",
    bodyClass: "text-charcoal/70",
    kickerClass: "text-orange-500",
    particleDirection: "fall",
    particles: ["🍂", "🍁", "🍃"],
    particleCount: 28,
    particleSizeRange: [16, 28],
    particleDurationRange: [8, 15],
  },
  winter: {
    key: "winter",
    label: "Winter",
    backgroundClass: "bg-gradient-to-b from-sky-50 via-ivory to-ivory-soft",
    isDark: false,
    headingClass: "text-charcoal",
    bodyClass: "text-charcoal/70",
    kickerClass: "text-sky-500",
    particleDirection: "fall",
    particles: ["❄️"],
    particleCount: 32,
    particleSizeRange: [10, 22],
    particleDurationRange: [9, 17],
  },
  halloween: {
    key: "halloween",
    label: "Halloween",
    backgroundClass: "bg-gradient-to-b from-night via-[#1a1220] to-night",
    isDark: true,
    headingClass: "text-cream",
    bodyClass: "text-cream/70",
    kickerClass: "text-orange-400",
    particleDirection: "fall",
    particles: ["🦇"],
    particleCount: 16,
    particleSizeRange: [16, 26],
    particleDurationRange: [7, 13],
  },
};

export const SEASONAL_THEME_KEYS = Object.keys(SEASONAL_THEMES) as SeasonalThemeKey[];
