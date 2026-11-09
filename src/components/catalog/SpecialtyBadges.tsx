import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { GEM_SPECIALTIES, type GemSpecialtyKey } from "@/lib/gem-constants";
import { cn } from "@/lib/utils";

/**
 * A gem's speciality tags (colour change, star, cat's eye, bi-colour) as gold
 * pills — on its card in every listing and beside the mineral line on its own
 * page. Renders nothing for an ordinary stone. Works in server and client
 * components alike (useTranslations, not getTranslations).
 */
export function SpecialtyBadges({
  specialties,
  size = "sm",
  className,
}: {
  specialties: readonly string[] | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useTranslations("catalog.specialty");
  // Known keys only, in the canonical display order.
  const keys = GEM_SPECIALTIES.filter((k): k is GemSpecialtyKey => !!specialties?.includes(k));
  if (keys.length === 0) return null;

  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {keys.map((key) => (
        <span
          key={key}
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-gold font-semibold text-night",
            size === "sm" ? "px-2 py-0.5 text-[10px] sm:px-2.5 sm:text-[11px]" : "px-3 py-1 text-xs",
          )}
        >
          <Sparkles size={size === "sm" ? 10 : 12} aria-hidden />
          {t(key)}
        </span>
      ))}
    </span>
  );
}
