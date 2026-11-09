import Link from "@/components/ui/MarketLink";
import { useTranslations } from "next-intl";
import { MarketSwitcherInline } from "@/components/layout/MarketSwitcher";
import { useMarket } from "@/components/providers/MarketProvider";
import type { FooterMessages } from "@/lib/i18n-messages";

// The message bundle comes in as a plain prop, pre-resolved server-side in
// RootLayout — see src/lib/i18n-messages.ts for why Footer (rendered from
// SiteChrome, a Client Component) can't call getTranslations itself.
//
// A recessed band (bg-sunken) under the page: brand, two link columns, and a
// store column — the Sri Lanka store's delivery/payment facts on /lk, the
// pricing note on the international store. The store switch sits as a quiet
// text line in the bottom bar rather than a row of pills. (The four
// "Ratnavue Promise" claims used to repeat here as a trust bar; Home and Our
// Story each carry them in their own sections now.)
export function Footer({
  messages,
  paymentMethodsLive,
}: {
  messages: FooterMessages;
  /** Real resolved live/coming-soon status for card and COD on the Sri
   * Lanka store, from RootLayout — so this blurb can't say "Coming soon"
   * for a method an admin has already turned live on /checkout. */
  paymentMethodsLive: { card: boolean; cod: boolean };
}) {
  const market = useMarket();
  const t = useTranslations("lk.footer");
  const tMarket = useTranslations("market");
  const linkClass = "transition-colors hover:text-gold-deep";

  return (
    <footer className="bg-sunken">
      <div className="mx-auto max-w-[120rem] px-5 pb-8 pt-14 sm:px-8 sm:pt-16 lg:px-12 xl:px-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.3fr] lg:gap-12">
          <div>
            <p className="font-serif text-3xl text-charcoal">Ratnavue</p>
            <p className="mt-4 max-w-sm leading-relaxed text-charcoal/85">{messages.tagline}</p>
          </div>
          <div>
            <p className="font-semibold text-charcoal">{messages.explore}</p>
            <ul className="mt-4 space-y-3 text-charcoal/85">
              <li><Link href="/gems" className={linkClass}>{messages.gemstones}</Link></li>
              <li><Link href="/jewelry" className={linkClass}>{messages.jewelry}</Link></li>
              <li><Link href="/configurator" className={linkClass}>{messages.designYourGem}</Link></li>
              <li><Link href="/sourcing" className={linkClass}>{messages.gemSourcing}</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-charcoal">{messages.company}</p>
            <ul className="mt-4 space-y-3 text-charcoal/85">
              <li><Link href="/about" className={linkClass}>{messages.ourStory}</Link></li>
              <li><Link href="/account" className={linkClass}>{messages.myAccount}</Link></li>
              <li><Link href="/contact" className={linkClass}>{messages.contact}</Link></li>
            </ul>
          </div>
          {market === "lk" ? (
            <div className="text-charcoal/85">
              <p className="font-semibold text-charcoal">{t("storeTitle")}</p>
              <p className="mt-1.5 leading-relaxed">{t("storeBody")}</p>
              <p className="mt-4 font-semibold text-charcoal">{t("paymentsTitle")}</p>
              <p className="mt-1.5 leading-relaxed">
                {t("bankTransfer")}
                {" · "}
                {t("card")}
                {!paymentMethodsLive.card && <span className="text-charcoal/60"> ({t("comingSoon").toLowerCase()})</span>}
                {" · "}
                {t("cod")}
                {!paymentMethodsLive.cod && <span className="text-charcoal/60"> ({t("comingSoon").toLowerCase()})</span>}
              </p>
            </div>
          ) : (
            <div className="text-charcoal/85">
              <p className="font-semibold text-charcoal">{messages.pricingNoteTitle}</p>
              <p className="mt-1.5 leading-relaxed">{messages.pricingNoteBody}</p>
            </div>
          )}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-border-subtle pt-6 text-sm text-charcoal/85 sm:flex-row sm:items-center sm:justify-between">
          <p>{messages.rights}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{market === "lk" ? t("switchTitle") : tMarket("switchLabel")}</span>
            <MarketSwitcherInline variant="links" />
          </div>
        </div>
      </div>
    </footer>
  );
}
