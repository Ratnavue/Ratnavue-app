import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { auth } from "@/lib/auth";
import { SourcingForm } from "@/components/quote/SourcingForm";
import { LinkButton } from "@/components/ui/Button";
import { StylizedGem } from "@/components/gem-visualizer/StylizedGem";
import { gemColorFor } from "@/lib/gem-palette";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Gem Sourcing",
    description: "Can't find the stone you want? Tell us the mineral, size, cut or colour and our team will source it from Sri Lanka's gem markets — no obligation.",
  });
}

const STEPS = [1, 2, 3] as const;

export default async function SourcingPage() {
  const [session, t] = await Promise.all([auth(), getTranslations("sourcing")]);
  const signedIn = !!session?.user;

  return (
    <div className="mx-auto grid max-w-[120rem] gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:px-12 xl:px-16">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">{t("kicker")}</p>
        <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-[1.05] text-charcoal sm:text-6xl lg:text-7xl">
          {t("title")}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-charcoal/75">
          {t("intro")}
        </p>

        <ol className="mt-10 space-y-7">
          {STEPS.map((n) => (
            <li key={n} className="flex items-start gap-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-raised text-lg font-semibold text-gold-deep">
                {n}
              </span>
              <div>
                <p className="text-lg font-semibold text-charcoal sm:text-xl">{t(`step${n}Title`)}</p>
                <p className="mt-1 text-charcoal/75">{t(`step${n}Body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className={signedIn ? "" : "lg:pt-8"}>
        <div className="rounded-3xl border border-border-subtle bg-surface p-6 sm:p-10">
          {signedIn ? (
            <>
              <h2 className="font-serif text-3xl text-charcoal">{t("formTitle")}</h2>
              <p className="mb-8 mt-2 text-charcoal/70">{t("formIntro")}</p>
              <SourcingForm />
            </>
          ) : (
            <div className="text-center">
              <StylizedGem color={gemColorFor("ruby")} shape="oval" className="mx-auto w-40" />
              <h2 className="mt-6 font-serif text-3xl text-charcoal sm:text-4xl">{t("formTitle")}</h2>
              <p className="mt-3 text-charcoal/75">{t("signInPrompt")}</p>
              <LinkButton href="/account/login?callbackUrl=/sourcing" size="lg" className="mt-8 w-full">
                {t("signIn")}
              </LinkButton>
              <p className="mt-6 text-sm text-charcoal/60">
                {t("footnote")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
