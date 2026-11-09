import type { Metadata } from "next";
import { PAGE_SEO } from "@/lib/seo-copy";
import { pageMetadata } from "@/lib/seo";
import { getMasterData } from "@/lib/catalog";
import { auth } from "@/lib/auth";
import { GemConfiguratorClient } from "@/components/configurator/GemConfiguratorClient";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: PAGE_SEO.configurator.title,
    description: PAGE_SEO.configurator.description,
  });
}

export default async function ConfiguratorPage() {
  const [masterData, session, t] = await Promise.all([getMasterData(), auth(), getTranslations("configurator")]);

  return (
    <div className="mx-auto max-w-[120rem] px-5 pb-20 pt-10 sm:px-8 lg:px-12 xl:px-16">
      <div className="mb-10 max-w-5xl sm:mb-14">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">{t("kicker")}</p>
        <h1 className="mt-4 font-serif text-5xl leading-[1.05] text-charcoal sm:text-6xl lg:text-7xl">{t("title")}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-charcoal/75">
          {t("intro")}
        </p>
      </div>

      <GemConfiguratorClient
        minerals={masterData.minerals}
        cuts={masterData.cuts}
        clarityGrades={masterData.clarityGrades}
        isAuthenticated={!!session?.user}
      />
    </div>
  );
}
