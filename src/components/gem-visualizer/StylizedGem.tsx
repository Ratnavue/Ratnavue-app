import { tint } from "@/lib/gem-palette";
import { cn } from "@/lib/utils";

export type StylizedGemShape = "round" | "oval" | "cushion";

/** Maps a cut slug onto the closest of the three stylised silhouettes. */
export function shapeForCut(cutSlug: string | undefined): StylizedGemShape {
  if (!cutSlug) return "oval";
  if (/cushion|princess|emerald|asscher|radiant|square|baguette/.test(cutSlug)) return "cushion";
  if (/oval|pear|marquise|heart/.test(cutSlug)) return "oval";
  return "round";
}

/**
 * The site's flat, stylised gem mark — a body, a lighter crossed facet
 * "kite", a bright table and a soft floor shadow. Pure SVG (no client JS),
 * so it's used anywhere a gem needs to read at a glance: the home hero,
 * category tiles, the sourcing card, the configurator preview. The detailed
 * procedural renderer (GemVisualizer) stays for product pages.
 */
export function StylizedGem({
  color,
  shape = "oval",
  className,
  shadow = true,
}: {
  /** Body colour, hex. Facets and table are tinted lighter from it. */
  color: string;
  shape?: StylizedGemShape;
  className?: string;
  shadow?: boolean;
}) {
  const cx = 100;
  const cy = 72;
  const rx = shape === "round" ? 66 : 80;
  const ry = shape === "round" ? 62 : 58;
  const facet = tint(color, 0.2);
  const table = tint(color, 0.4);
  const clipId = `sg-${shape}-${color.slice(1)}`;

  return (
    <svg viewBox="0 0 200 170" className={cn("h-auto w-full", className)} aria-hidden>
      <defs>
        <clipPath id={clipId}>
          {shape === "cushion" ? (
            <rect x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} rx={ry * 0.55} />
          ) : (
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
          )}
        </clipPath>
      </defs>
      {shadow && <ellipse cx={cx} cy={156} rx={rx * 0.82} ry={7} fill="currentColor" className="text-night/30" />}
      <g clipPath={`url(#${clipId})`}>
        <rect x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} fill={color} />
        <polygon points={`${cx},${cy - ry} ${cx + rx},${cy} ${cx},${cy + ry} ${cx - rx},${cy}`} fill={facet} />
        {shape === "cushion" ? (
          <rect x={cx - rx * 0.46} y={cy - ry * 0.48} width={rx * 0.92} height={ry * 0.96} rx={ry * 0.3} fill={table} />
        ) : (
          <ellipse cx={cx} cy={cy} rx={rx * 0.48} ry={ry * 0.48} fill={table} />
        )}
      </g>
    </svg>
  );
}

/**
 * A rounded stage behind a StylizedGem: the page's soft surface, washed with a
 * radial glow of the gem's own colour (via color-mix, so it adapts to the
 * dark and light themes without separate values).
 */
export function GemStage({
  color,
  className,
  children,
}: {
  color: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        background: `radial-gradient(85% 75% at 50% 40%, color-mix(in srgb, ${color} 34%, var(--color-ivory-soft)) 0%, color-mix(in srgb, ${color} 10%, var(--color-ivory-soft)) 55%, var(--color-ivory-soft) 100%)`,
      }}
    >
      {children}
    </div>
  );
}
