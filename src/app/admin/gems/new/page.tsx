import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasStaffArea, marketFilterFor } from "@/lib/rbac";
import { getMasterData } from "@/lib/catalog";
import { getActiveShippingWeightTiers } from "@/lib/shipping";
import { GemstoneForm } from "@/components/admin/GemstoneForm";
import { BackLink } from "@/components/admin/BackLink";

export default async function NewGemstonePage({ searchParams }: PageProps<"/admin/gems/new">) {
  const user = (await auth())?.user;
  if (!user || !hasStaffArea(user, "catalog")) notFound();
  const scopedMarket = marketFilterFor(user);
  const [{ minerals, cuts, clarityGrades, treatments, origins, certificationLabs }, shippingWeightTiers] = await Promise.all([
    getMasterData(),
    getActiveShippingWeightTiers(),
  ]);
  const defaultMarket = scopedMarket ?? ((await searchParams).market === "lk" ? "lk" : "intl");

  return (
    <div>
      <BackLink href="/admin/gems" label="Back to Gemstones" />
      <h1 className="font-serif text-3xl text-charcoal">Add {defaultMarket === "lk" ? "Sri Lanka " : ""}Gemstone</h1>
      <div className="mt-6">
        <GemstoneForm
          minerals={minerals}
          cuts={cuts}
          clarityGrades={clarityGrades}
          treatments={treatments}
          origins={origins}
          certificationLabs={certificationLabs}
          shippingWeightTiers={shippingWeightTiers}
          defaultMarket={defaultMarket}
          staff={user.role === "STAFF"}
          lockMarket={!!scopedMarket}
        />
      </div>
      <p className="mt-4 text-xs text-charcoal/50">
        Photos and videos can be added above. Save the gemstone first, then attach a certificate file from its edit page.
        Saving also gives it a permanent item number and a downloadable QR code.
      </p>
    </div>
  );
}
