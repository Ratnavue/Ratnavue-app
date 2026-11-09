import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

/**
 * What's different about buying on the Sri Lanka store (rupee prices,
 * bank-transfer checkout, delivery within Sri Lanka) — three short facts,
 * shown along the bottom of the home page's closing band on /lk only. Every
 * line describes what the checkout actually does today — card and cash on
 * delivery are called out as coming soon, not promised.
 */
export async function LkStrip({ className }: { className?: string }) {
  const t = await getTranslations("lk.strip");
  const items = [
    { title: t("pricesTitle"), body: t("pricesBody") },
    { title: t("payTitle"), body: t("payBody") },
    { title: t("deliveryTitle"), body: t("deliveryBody") },
  ];
  return (
    <ul className={cn("grid gap-6 sm:grid-cols-3 sm:gap-10", className)}>
      {items.map(({ title, body }) => (
        <li key={title}>
          <p className="font-semibold text-charcoal">{title}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-charcoal/75">{body}</p>
        </li>
      ))}
    </ul>
  );
}
