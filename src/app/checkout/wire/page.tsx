import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPageContent, DEFAULT_LK_PAYMENTS_CONTENT, LK_PAYMENTS_KEY } from "@/lib/page-content";
import { formatPrice } from "@/lib/utils";
import { LinkButton } from "@/components/ui/Button";
import { CancelWireOrderButton } from "@/components/checkout/CancelWireOrderButton";

export const metadata: Metadata = { title: "Bank Transfer" };

// Where a bank-transfer customer is told how to pay. Unlike PayHere's
// public return pages this shows the amount and the bank details, so it's
// behind the session (proxy.ts) *and* checks the order belongs to the
// signed-in customer.
export default async function WireInstructionsPage({ searchParams }: PageProps<"/checkout/wire">) {
  const session = await auth();
  if (!session?.user) return null; // proxy guards this route

  const sp = await searchParams;
  const orderId = typeof sp.order === "string" ? sp.order : "";
  const order = orderId
    ? await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, orderNumber: true, userId: true, status: true, paymentMethod: true, total: true, currency: true } })
    : null;
  if (!order || order.userId !== session.user.id || order.paymentMethod !== "WIRE_TRANSFER") notFound();

  const [t, instructions] = await Promise.all([
    getTranslations("checkout.wire"),
    getPageContent(LK_PAYMENTS_KEY, DEFAULT_LK_PAYMENTS_CONTENT),
  ]);
  const currency = order.currency === "LKR" ? "LKR" : "USD";

  if (order.status === "CANCELLED") {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center sm:px-8">
        <h1 className="font-serif text-3xl text-charcoal">{order.orderNumber}</h1>
        <p className="mt-4 text-charcoal/70">{t("cancelled")}</p>
        <LinkButton href="/gems" variant="primary" className="mt-8">{t("continueShopping")}</LinkButton>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-16 sm:px-8">
      <p className="text-xs uppercase tracking-widest text-gold-deep">{t("kicker")}</p>
      <h1 className="mt-2 font-serif text-4xl text-charcoal">{t("title")}</h1>
      <p className="mt-4 text-charcoal/70">{t("intro")}</p>

      <dl className="mt-8 grid gap-4 rounded-xl border border-border-subtle bg-surface p-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-charcoal/65">{t("amount")}</dt>
          <dd className="mt-1 font-serif text-2xl text-charcoal">{formatPrice(order.total, currency)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-charcoal/65">{t("reference")}</dt>
          <dd className="mt-1 font-mono text-lg text-charcoal">{order.orderNumber}</dd>
        </div>
      </dl>

      <div className="mt-6 rounded-xl border border-border-subtle bg-surface p-5">
        <p className="text-xs uppercase tracking-wide text-charcoal/65">{t("instructionsTitle")}</p>
        <p className="mt-2 whitespace-pre-line text-charcoal/80">{instructions.wireTransferInstructions}</p>
      </div>

      <p className="mt-6 text-sm text-charcoal/70">{t("afterTransfer")}</p>

      <div className="mt-8 flex flex-wrap items-center gap-6">
        <LinkButton href={`/account/orders/${order.id}`} variant="primary">{t("viewOrders")}</LinkButton>
        {order.status === "PENDING_PAYMENT" && <CancelWireOrderButton orderId={order.id} />}
      </div>
    </div>
  );
}
