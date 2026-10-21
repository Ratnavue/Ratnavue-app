import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPageContent, DEFAULT_LK_PAYMENTS_CONTENT, LK_PAYMENTS_KEY } from "@/lib/page-content";
import { formatPrice } from "@/lib/utils";
import { LinkButton } from "@/components/ui/Button";
import { CancelCodOrderButton } from "@/components/checkout/CancelCodOrderButton";

export const metadata: Metadata = { title: "Cash on Delivery" };

// Where a COD customer is told what's left to pay (if anything) and,
// once there's a deposit, how to send it — mirrors /checkout/wire's own
// session/ownership guards and bank-details content exactly. Unlike
// wire, this order can also be SHIPPED while still unpaid (true COD —
// see lib/orders.ts's markOrderShipped), so there's a fourth state wire
// never has.
export default async function CodInstructionsPage({ searchParams }: PageProps<"/checkout/cod">) {
  const session = await auth();
  if (!session?.user) return null; // proxy guards this route

  const sp = await searchParams;
  const orderId = typeof sp.order === "string" ? sp.order : "";
  const order = orderId
    ? await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true, orderNumber: true, userId: true, status: true, paymentMethod: true, total: true, currency: true,
          codDepositRequired: true, codDepositAmount: true, codDepositPaidAt: true,
          codAgentName: true, codAgentReference: true, codTrackingUrl: true,
        },
      })
    : null;
  if (!order || order.userId !== session.user.id || order.paymentMethod !== "COD") notFound();

  const [t, instructions] = await Promise.all([
    getTranslations("checkout.cod"),
    getPageContent(LK_PAYMENTS_KEY, DEFAULT_LK_PAYMENTS_CONTENT),
  ]);
  const currency = order.currency === "LKR" ? "LKR" : "USD";
  const balanceDue = order.codDepositRequired ? order.total - (order.codDepositAmount ?? 0) : order.total;

  if (order.status === "CANCELLED") {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center sm:px-8">
        <h1 className="font-serif text-3xl text-charcoal">{order.orderNumber}</h1>
        <p className="mt-4 text-charcoal/70">{t("cancelled")}</p>
        <LinkButton href="/gems" variant="primary" className="mt-8">{t("continueShopping")}</LinkButton>
      </div>
    );
  }

  const depositOwed = order.codDepositRequired && !order.codDepositPaidAt;
  const hasAgentDetails = order.codAgentName || order.codAgentReference || order.codTrackingUrl;

  return (
    <div className="mx-auto max-w-xl px-5 py-16 sm:px-8">
      <p className="text-xs uppercase tracking-widest text-gold-deep">{t("kicker")}</p>
      <h1 className="mt-2 font-serif text-4xl text-charcoal">{t("title")}</h1>
      <p className="mt-4 text-charcoal/70">
        {order.status === "SHIPPED"
          ? t("introShipped")
          : depositOwed
            ? t("introDeposit")
            : order.codDepositRequired
              ? t("introDepositReceived")
              : t("introNoDeposit")}
      </p>

      {depositOwed && (
        <>
          <dl className="mt-8 grid gap-4 rounded-xl border border-border-subtle bg-surface p-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-charcoal/65">{t("amount")}</dt>
              <dd className="mt-1 font-serif text-2xl text-charcoal">{formatPrice(order.codDepositAmount!, currency)}</dd>
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
        </>
      )}

      {(order.status === "PENDING_PAYMENT" || order.status === "SHIPPED") && (
        <p className="mt-6 text-sm text-charcoal/70">
          {t("balanceDue")}: <span className="font-medium text-charcoal">{formatPrice(balanceDue, currency)}</span>
        </p>
      )}

      {order.status === "SHIPPED" && hasAgentDetails && (
        <div className="mt-6 rounded-xl border border-border-subtle bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-charcoal/65">{t("agentLabel")}</p>
          {order.codAgentName && <p className="mt-2 text-charcoal/80">{order.codAgentName}</p>}
          {order.codAgentReference && <p className="text-sm text-charcoal/60">{order.codAgentReference}</p>}
          {order.codTrackingUrl && (
            <a href={order.codTrackingUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-gold-deep underline hover:text-charcoal">
              {t("trackDelivery")}
            </a>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-6">
        <LinkButton href={`/account/orders/${order.id}`} variant="primary">{t("viewOrders")}</LinkButton>
        {order.status === "PENDING_PAYMENT" && !order.codDepositPaidAt && <CancelCodOrderButton orderId={order.id} />}
      </div>
    </div>
  );
}
