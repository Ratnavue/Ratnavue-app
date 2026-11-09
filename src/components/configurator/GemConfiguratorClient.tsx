"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { GemVisualizer } from "@/components/gem-visualizer/GemVisualizer";
import { resolveGemColor, hueAtPercent, percentAtHue } from "@/components/gem-visualizer/color";
import { estimateDimensionsMm } from "@/components/gem-visualizer/size";
import { Select } from "@/components/ui/Field";
import { QuoteRequestPanel } from "@/components/quote/QuoteRequestPanel";
import { cn } from "@/lib/utils";
import type { ConfiguredSpec } from "@/lib/validation/quote";

interface Mineral {
  id: string;
  name: string;
  slug: string;
  hueMin: number;
  hueMax: number;
}

interface Cut {
  id: string;
  name: string;
  slug: string;
  category: "FACETED" | "CABOCHON";
}

interface ClarityGrade {
  id: string;
  name: string;
  slug: string;
  description: string;
}

interface GemConfiguratorClientProps {
  minerals: Mineral[];
  cuts: Cut[];
  clarityGrades: ClarityGrade[];
  isAuthenticated: boolean;
}

const CARAT_MIN = 0.5;
const CARAT_MAX = 20;
// Five believable hues across the mineral's own range — the colour step is a
// pick from these rather than a free slider, so every option is a real stone.
const SWATCH_PERCENTS = [10, 30, 50, 70, 90];
const TONES = [
  { key: "light", label: "toneLight", darkness: 22 },
  { key: "medium", label: "toneMedium", darkness: 45 },
  { key: "dark", label: "toneDark", darkness: 75 },
] as const;

function nearest<T>(items: readonly T[], distance: (item: T) => number): T {
  return items.reduce((best, item) => (distance(item) < distance(best) ? item : best), items[0]);
}

export function GemConfiguratorClient({ minerals, cuts, clarityGrades, isAuthenticated }: GemConfiguratorClientProps) {
  const t = useTranslations("configurator");
  const [mineralId, setMineralId] = useState(minerals[0]?.id ?? "");
  const [cutId, setCutId] = useState(cuts[0]?.id ?? "");
  const [caratWeight, setCaratWeight] = useState(1.5);
  const [huePercent, setHuePercent] = useState(50);
  const [darkness, setDarkness] = useState<number>(TONES[1].darkness);
  const [clarityId, setClarityId] = useState(clarityGrades[1]?.id ?? clarityGrades[0]?.id ?? "");

  const mineral = minerals.find((m) => m.id === mineralId) ?? minerals[0];
  const cut = cuts.find((c) => c.id === cutId) ?? cuts[0];
  const clarity = clarityGrades.find((c) => c.id === clarityId) ?? clarityGrades[0];

  const hue = mineral ? hueAtPercent(mineral.hueMin, mineral.hueMax, huePercent) : 0;
  const dimensions = cut ? estimateDimensionsMm(cut.slug, caratWeight) : null;

  // Each swatch rendered at the chosen tone, so the row previews what you'd get.
  const swatches = useMemo(() => {
    if (!mineral) return [];
    return SWATCH_PERCENTS.map((percent) => ({
      percent,
      color: resolveGemColor(hueAtPercent(mineral.hueMin, mineral.hueMax, percent), darkness).base,
    }));
  }, [mineral, darkness]);
  const stageColor = resolveGemColor(hue, darkness).base;
  const toneKey = nearest(TONES, (t) => Math.abs(t.darkness - darkness)).key;
  const caratFill = ((caratWeight - CARAT_MIN) / (CARAT_MAX - CARAT_MIN)) * 100;

  function handleMineralChange(id: string) {
    const next = minerals.find((m) => m.id === id);
    setMineralId(id);
    // Keep roughly the same colour where the new mineral allows it, snapped
    // to that mineral's nearest swatch.
    if (next) {
      const carried = percentAtHue(next.hueMin, next.hueMax, hue);
      setHuePercent(nearest(SWATCH_PERCENTS, (p) => Math.abs(p - carried)));
    }
  }

  const configuredSpec: ConfiguredSpec | undefined =
    mineral && cut && clarity
      ? {
          mineralId: mineral.id,
          mineralName: mineral.name,
          cutId: cut.id,
          cutName: cut.name,
          cutSlug: cut.slug,
          caratWeight,
          hue,
          darkness,
          claritySlug: clarity.slug,
          clarityName: clarity.name,
        }
      : undefined;

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
      <div className="lg:sticky lg:top-28 lg:self-start">
        {/* The procedural renderer (cut geometry, tone, clarity inclusions)
            on a stage washed with the stone's own colour. */}
        <div
          className="flex aspect-[1/0.84] items-center justify-center overflow-hidden rounded-3xl p-10 sm:p-14"
          style={{
            background: `radial-gradient(70% 70% at 50% 42%, color-mix(in srgb, ${stageColor} 30%, var(--color-ivory-soft)) 0%, color-mix(in srgb, ${stageColor} 12%, var(--color-ivory-soft)) 60%, var(--color-ivory-soft) 100%)`,
          }}
        >
          {cut && (
            <GemVisualizer
              cutSlug={cut.slug}
              hue={hue}
              darkness={darkness}
              claritySlug={clarity?.slug ?? "eye-clean"}
              caratWeight={caratWeight}
              seedKey="configurator"
              className="aspect-square h-full max-h-full w-auto"
            />
          )}
        </div>
        <p className="mt-4 px-1 text-sm text-charcoal/65">
          {t("previewNote")}
          {dimensions ? ` — ${t("previewSize", { length: dimensions.lengthMm, width: dimensions.widthMm, carat: caratWeight })}` : "."}
        </p>
      </div>

      <div className="rounded-3xl border border-border-subtle bg-surface p-6 sm:p-10">
        <div className="space-y-8">
          <Step n={1} label={t("stepMineral")} htmlFor="mineral">
            <Select id="mineral" value={mineralId} onChange={(e) => handleMineralChange(e.target.value)}>
              {minerals.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </Step>

          <Step n={2} label={t("stepCut")} htmlFor="cut">
            <Select id="cut" value={cutId} onChange={(e) => setCutId(e.target.value)}>
              <optgroup label={t("faceted")}>
                {cuts.filter((c) => c.category === "FACETED").map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
              <optgroup label={t("cabochon")}>
                {cuts.filter((c) => c.category === "CABOCHON").map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            </Select>
          </Step>

          <Step n={3} label={t("stepCarat")} htmlFor="carat" value={`${caratWeight.toFixed(2)} ct`}>
            <input
              id="carat"
              type="range"
              min={CARAT_MIN}
              max={CARAT_MAX}
              step={0.05}
              value={caratWeight}
              onChange={(e) => setCaratWeight(Number(e.target.value))}
              className="range-gold w-full"
              style={{ "--fill": `${caratFill}%` } as React.CSSProperties}
            />
          </Step>

          <Step n={4} label={t("stepColour", { mineral: mineral?.name ?? t("gemFallback") })}>
            <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={t("stepColour", { mineral: mineral?.name ?? t("gemFallback") })}>
              {swatches.map((s, i) => {
                const selected = huePercent === s.percent;
                return (
                  <button
                    key={s.percent}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={t("colourOption", { n: i + 1, total: swatches.length })}
                    onClick={() => setHuePercent(s.percent)}
                    className={cn(
                      "h-12 w-12 rounded-full border-2 transition-transform hover:scale-105",
                      selected ? "border-charcoal ring-2 ring-gold/50 ring-offset-2 ring-offset-surface" : "border-border-subtle",
                    )}
                    style={{ backgroundColor: s.color }}
                  />
                );
              })}
            </div>
            <p className="mt-3 text-sm text-charcoal/65">{t("colourNote", { mineral: mineral?.name.toLowerCase() ?? t("gemFallback") })}</p>
          </Step>

          <Step n={5} label={t("stepTone")}>
            <Segmented
              label={t("stepTone")}
              options={TONES.map((tone) => ({ value: tone.key, label: t(tone.label) }))}
              value={toneKey}
              onChange={(key) => setDarkness(TONES.find((tone) => tone.key === key)?.darkness ?? TONES[1].darkness)}
            />
          </Step>

          <Step n={6} label={t("stepClarity")}>
            <Segmented
              label={t("stepClarity")}
              options={clarityGrades.map((c) => ({ value: c.id, label: c.name }))}
              value={clarityId}
              onChange={setClarityId}
            />
            {clarity && <p className="mt-3 leading-relaxed text-charcoal/70">{clarity.description}</p>}
          </Step>

          <div className="border-t border-border-subtle pt-8">
            <QuoteRequestPanel
              isAuthenticated={isAuthenticated}
              configuredSpec={configuredSpec}
              productLabel={t("productLabel", { mineral: mineral?.name ?? t("gemFallback") })}
              bare
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, label, htmlFor, value, children }: { n: number; label: string; htmlFor?: string; value?: string; children: React.ReactNode }) {
  const title = `${n} · ${label}`;
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="font-semibold text-charcoal">{title}</label>
        ) : (
          <p className="font-semibold text-charcoal">{title}</p>
        )}
        {value && <span className="font-semibold text-gold-deep">{value}</span>}
      </div>
      {children}
    </div>
  );
}

/** A pill-track segmented control (tone, clarity) with one gold selected pill. */
function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      // Four or more options become a 3-column grid on phones instead of
      // squeezing every label onto one row.
      className={cn("gap-1 rounded-2xl bg-ivory p-1.5", options.length > 3 ? "grid grid-cols-3 sm:flex" : "flex")}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-11 flex-1 rounded-xl px-1.5 py-2 text-[13px] leading-tight transition-colors sm:px-2 sm:text-[15px]",
            value === o.value ? "bg-gold font-semibold text-night" : "text-charcoal/85 hover:bg-raised",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
