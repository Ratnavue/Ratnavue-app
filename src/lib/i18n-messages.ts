import { getTranslations } from "next-intl/server";

// Plain-string message bundles for components that can't call
// getTranslations themselves — TrustBar and Footer are rendered from
// SiteChrome, a Client Component ("use client", needed for its
// usePathname() admin-chrome check), and a Client Component can neither
// render an async Server Component nor receive a translator function as a
// prop (functions aren't serializable across that boundary). So the
// translated strings are resolved here, server-side, and threaded down as
// plain prop values instead — the same "compute where it's cheap, pass a
// plain prop" pattern this app already uses for `year`/`cartItemCount` in
// RootLayout.
//
// TrustBar's other call sites (gem/jewelry detail pages, the home page's
// "Ratnavue Promise" section) are themselves Server Components, so they
// call getTrustBarMessages() directly rather than receiving it through a
// prop chain.

export interface TrustBarMessages {
  certifiedTitle: string;
  certifiedDetail: string;
  uniqueTitle: string;
  uniqueDetail: string;
  shippingTitle: string;
  shippingDetail: string;
  returnsTitle: string;
  returnsDetail: string;
}

export async function getTrustBarMessages(): Promise<TrustBarMessages> {
  const t = await getTranslations("trustBar");
  return {
    certifiedTitle: t("certifiedTitle"),
    certifiedDetail: t("certifiedDetail"),
    uniqueTitle: t("uniqueTitle"),
    uniqueDetail: t("uniqueDetail"),
    shippingTitle: t("shippingTitle"),
    shippingDetail: t("shippingDetail"),
    returnsTitle: t("returnsTitle"),
    returnsDetail: t("returnsDetail"),
  };
}

export interface FooterMessages {
  tagline: string;
  explore: string;
  gemstones: string;
  jewelry: string;
  designYourGem: string;
  gemSourcing: string;
  company: string;
  ourStory: string;
  myAccount: string;
  contact: string;
  pricingNoteTitle: string;
  pricingNoteBody: string;
  /** Pre-interpolated with the current year — see RootLayout, which is
   * where `year` is computed (same reasoning as ever: a Server Component
   * runs this once per request, so it can never disagree with itself the
   * way computing it during client hydration could). */
  rights: string;
}

export async function getFooterMessages(year: number): Promise<FooterMessages> {
  const t = await getTranslations("footer");
  return {
    tagline: t("tagline"),
    explore: t("explore"),
    gemstones: t("gemstones"),
    jewelry: t("jewelry"),
    designYourGem: t("designYourGem"),
    gemSourcing: t("gemSourcing"),
    company: t("company"),
    ourStory: t("ourStory"),
    myAccount: t("myAccount"),
    contact: t("contact"),
    pricingNoteTitle: t("pricingNoteTitle"),
    pricingNoteBody: t("pricingNoteBody"),
    rights: t("rights", { year }),
  };
}
