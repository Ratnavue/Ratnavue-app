import Link from "@/components/ui/MarketLink";
import { useTranslations } from "next-intl";
import { TrustBar } from "./TrustBar";
import { KandyanBand } from "@/components/decor/Kandyan";
import { MarketSwitcherInline } from "@/components/layout/MarketSwitcher";
import { useMarket } from "@/components/providers/MarketProvider";
import type { FooterMessages, TrustBarMessages } from "@/lib/i18n-messages";

// Both message bundles come in as plain props, pre-resolved server-side in
// RootLayout — see src/lib/i18n-messages.ts for why Footer (rendered from
// SiteChrome, a Client Component) can't call getTranslations itself.
export function Footer({
  messages,
  trustBarMessages,
  showTrustBar = true,
  paymentMethodsLive,
}: {
  messages: FooterMessages;
  trustBarMessages: TrustBarMessages;
  /** Off on the home page, whose own "Ratnavue Promise" section already
   * shows these same four claims one screen above the footer — repeating
   * them back to back reads as filler rather than reassurance. */
  showTrustBar?: boolean;
  /** Real resolved live/coming-soon status for card and COD on the Sri
   * Lanka store, from RootLayout — so this blurb can't say "Coming soon"
   * for a method an admin has already turned live on /checkout. */
  paymentMethodsLive: { card: boolean; cod: boolean };
}) {
  const market = useMarket();
  const t = useTranslations("lk.footer");
  const tMarket = useTranslations("market");
  return (
    <footer className="bg-ivory-soft">
      {/* Transparency comes from the colour's alpha (text-gold/60), NOT the
          opacity property: an element with opacity < 1 is its own stacking
          context, and this footer comes after <main> in the DOM, so such a
          band painted on top of the full-screen page loader (which is
          trapped inside <main>'s stacking context) and drew a line across
          the loader's logo mid-navigation. */}
      {market === "lk" && <KandyanBand className="text-gold/60" />}
      <div className="mx-auto max-w-[120rem] px-5 py-12 sm:px-8 sm:py-14 lg:px-12 xl:px-16">
        {showTrustBar && <TrustBar messages={trustBarMessages} className="mb-10 border-b border-border-subtle pb-10 sm:mb-12 sm:pb-12" />}
        <div className="grid gap-8 sm:grid-cols-2 sm:gap-10 md:grid-cols-4">
          <div>
            <p className="font-serif text-xl text-charcoal">Ratnavue</p>
            <p className="mt-3 text-sm leading-relaxed text-charcoal/65">{messages.tagline}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">{messages.explore}</p>
            <ul className="mt-3 space-y-2 text-sm text-charcoal/70">
              <li><Link href="/gems" className="hover:text-charcoal">{messages.gemstones}</Link></li>
              <li><Link href="/jewelry" className="hover:text-charcoal">{messages.jewelry}</Link></li>
              <li><Link href="/configurator" className="hover:text-charcoal">{messages.designYourGem}</Link></li>
              <li><Link href="/sourcing" className="hover:text-charcoal">{messages.gemSourcing}</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">{messages.company}</p>
            <ul className="mt-3 space-y-2 text-sm text-charcoal/70">
              <li><Link href="/about" className="hover:text-charcoal">{messages.ourStory}</Link></li>
              <li><Link href="/account" className="hover:text-charcoal">{messages.myAccount}</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">{messages.pricingNoteTitle}</p>
            <p className="mt-3 text-sm leading-relaxed text-charcoal/65">{messages.pricingNoteBody}</p>
          </div>
        </div>
        {market === "lk" && (
          <div className="mt-10 grid gap-8 border-t border-border-subtle pt-8 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">{t("storeTitle")}</p>
              <p className="mt-3 text-sm leading-relaxed text-charcoal/65">{t("storeBody")}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">{t("paymentsTitle")}</p>
              <ul className="mt-3 space-y-2 text-sm text-charcoal/70">
                <li>{t("bankTransfer")}</li>
                <li className="text-charcoal/65">{t("card")}{!paymentMethodsLive.card && <> · {t("comingSoon")}</>}</li>
                <li className="text-charcoal/65">{t("cod")}{!paymentMethodsLive.cod && <> · {t("comingSoon")}</>}</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">{t("switchTitle")}</p>
              <MarketSwitcherInline className="mt-3" />
            </div>
          </div>
        )}
        {market === "intl" && (
          <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-border-subtle pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">{tMarket("switchLabel")}</p>
            <MarketSwitcherInline />
          </div>
        )}
        <p className="mt-12 text-xs text-charcoal/65">{messages.rights}</p>
      </div>
    </footer>
  );
}
