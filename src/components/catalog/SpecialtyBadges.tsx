import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { specialtyMessageKey, type SpecialtyTag } from "@/lib/gem-constants";
import { cn } from "@/lib/utils";

/**
 * A gem's speciality tags (colour change, star, cat's eye, bi-colour, or
 * any an admin has added to the managed list) as gold pills — on its card in every listing and beside the mineral line on its own
 * page. Renders nothing for an ordinary stone. Works in server and client
 * components alike (useTranslations, not getTranslations).
 */
export function SpecialtyBadges({
  specialties,
  size = "sm",
  className,
}: {
  /** Already filtered to active tags and ordered (SPECIALTY_TAGS_INCLUDE). */
  specialties: readonly SpecialtyTag[] | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useTranslations("catalog.specialty");
  if (!specialties || specialties.length === 0) return null;

  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {specialties.map((tag) => (
        <span
          key={tag.slug}
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-gold font-semibold text-night",
            size === "sm" ? "px-2 py-0.5 text-[10px] sm:px-2.5 sm:text-[11px]" : "px-3 py-1 text-xs",
          )}
        >
          <Sparkles size={size === "sm" ? 10 : 12} aria-hidden />
          {/* The original four have translated labels; ones added later show their own name. */}
          {t.has(specialtyMessageKey(tag.slug)) ? t(specialtyMessageKey(tag.slug)) : tag.name}
        </span>
      ))}
    </span>
  );
}
