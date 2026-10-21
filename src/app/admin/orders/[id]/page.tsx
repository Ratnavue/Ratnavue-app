import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { pollChatMessages } from "@/actions/chat";
import { Badge } from "@/components/ui/Badge";
import { BackLink } from "@/components/admin/BackLink";
import { OrderActions } from "@/components/admin/OrderActions";
import { ShipOrderForm } from "@/components/admin/ShipOrderForm";
import { MarkDeliveredButton } from "@/components/admin/MarkDeliveredButton";
import { ConfirmCodDepositButton } from "@/components/admin/ConfirmCodDepositButton";
import { MarkCodCollectedButton } from "@/components/admin/MarkCodCollectedButton";
import { CodDeliveryDetailsForm } from "@/components/admin/CodDeliveryDetailsForm";
import { ClearShippingToBeArrangedButton } from "@/components/admin/ClearShippingToBeArrangedButton";
import { ClearPointsApprovalButton } from "@/components/admin/ClearPointsApprovalButton";
import { RefundResolutionPanel } from "@/components/admin/RefundResolutionPanel";
import { RevertToUnpaidForm } from "@/components/admin/RevertToUnpaidForm";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { formatPrice } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-50 text-amber-800 border-amber-200",
  PAID: "bg-emerald-50 text-emerald-800 border-emerald-200",
  SHIPPED: "bg-sapphire-soft/15 text-sapphire border-sapphire-soft/30",
  DELIVERED: "bg-gold-soft/25 text-charcoal border-gold/40",
  PAYMENT_FAILED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-charcoal/5 text-charcoal/60 border-charcoal/15",
  PAYMENT_REVERSED: "bg-red-50 text-red-700 border-red-200",
};

const METHOD_LABELS: Record<string, string> = {
  PAYHERE_CARD: "Card (PayHere)",
  WIRE_TRANSFER: "Bank transfer",
  COD: "Cash on delivery",
  CASH: "Cash",
};

export default async function AdminOrderDetailPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const [order, session] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true, pointsBalance: true } },
        items: {
          include: {
            gemstone: { select: { name: true, slug: true, media: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } },
            jewelry: { select: { name: true, slug: true, media: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } },
          },
        },
        refundRequest: true,
      },
    }),
    auth(),
  ]);
  if (!order) notFound();

  // Same "not found" whether the id is wrong or just out of this staff
  // member's assigned market — never confirms an order exists but is out
  // of scope. requireMarketAccess (used by every staff-permitted
  // action on this page) makes the same check again server-side; this is
  // just what decides whether the page renders at all.
  const isStaff = session?.user?.role === "STAFF";
  if (isStaff) {
    const scope = session!.user.staffMarketScope;
    if (scope !== "both" && scope !== order.market) notFound();
  }

  const initialMessages = await pollChatMessages("order", id);
  const currency = order.currency === "LKR" ? "LKR" : "USD";

  return (
    <div className="max-w-6xl">
      <BackLink href="/admin/orders" label="Back to Orders" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl text-charcoal">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-charcoal/60">
            <Link href={`/admin/customers/${order.user.id}`} className="hover:text-gold-deep hover:underline">
              {order.user.name ?? order.user.email}
            </Link>{" "}
            · {order.user.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {order.manualSale && (
            <Badge className="border-sapphire-soft/30 bg-sapphire-soft/15 text-sapphire">Manual Sale</Badge>
          )}
          {order.needsPointsApproval && (
            <Badge className="border-amber-300 bg-amber-50 text-amber-800">Needs Points Approval</Badge>
          )}
          <Badge className={STATUS_STYLES[order.status] ?? ""}>{order.status.replaceAll("_", " ")}</Badge>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface">
            <p className="border-b border-border-subtle px-5 py-3 text-xs font-medium uppercase tracking-wide text-charcoal/65">Items</p>
            <div className="divide-y divide-border-subtle px-5">
              {order.items.map((item) => {
                const product = item.gemstone ?? item.jewelry;
                const image = product?.media[0]?.url;
                return (
                  <div key={item.id} className="flex items-center gap-4 py-4">
                    <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ivory-soft">
                      {image && <Image src={image} alt="" fill sizes="64px" className="object-cover" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-charcoal">{item.label}</p>
                      <p className="mt-0.5 text-xs text-charcoal/60">{formatPrice(item.unitPrice, currency)} × {item.quantity}</p>
                    </div>
                    <p className="shrink-0 text-sm text-charcoal">{formatPrice(item.lineTotal, currency)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">Shipping Address</p>
            {order.needsShippingDetails ? (
              <p className="mt-2 text-sm text-charcoal/60">Awaiting the customer&apos;s shipping details.</p>
            ) : (
              <address className="mt-2 text-sm not-italic leading-relaxed text-charcoal/80">
                {order.shipName}
                <br />
                {order.shipAddressLine1}
                {order.shipAddressLine2 && (
                  <>
                    <br />
                    {order.shipAddressLine2}
                  </>
                )}
                <br />
                {order.shipCity}
                {order.shipPostalCode ? ` ${order.shipPostalCode}` : ""}
                <br />
                {order.shipCountry}
                <br />
                {order.shipPhone}
              </address>
            )}
          </div>

          {session?.user && (
            <ChatPanel requestType="order" requestId={order.id} currentUserId={session.user.id} initialMessages={initialMessages} hasOpenCart={false} />
          )}
        </div>

        <div className="space-y-6 max-lg:order-first">
          <div className="rounded-xl border border-border-subtle bg-surface p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">Total</p>
            <p className="mt-2 font-serif text-xl text-charcoal">{formatPrice(order.total, currency)}</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-charcoal/60">Payment method</dt>
                <dd className="text-charcoal">{METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</dd>
              </div>
              {order.codDepositRequired && (
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal/60">Deposit</dt>
                  <dd className="text-charcoal">
                    {formatPrice(order.codDepositAmount!, currency)} {order.codDepositPaidAt ? "— received" : "— awaiting transfer"}
                  </dd>
                </div>
              )}
              {order.paymentMethod === "COD" && (order.codAgentName || order.codAgentReference || order.codTrackingUrl) && (
                <>
                  {order.codAgentName && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-charcoal/60">Delivery agent</dt>
                      <dd className="text-charcoal">{order.codAgentName}</dd>
                    </div>
                  )}
                  {order.codAgentReference && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-charcoal/60">Agent reference</dt>
                      <dd className="text-charcoal">{order.codAgentReference}</dd>
                    </div>
                  )}
                  {order.codTrackingUrl && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-charcoal/60">Tracking</dt>
                      <dd>
                        <a href={order.codTrackingUrl} target="_blank" rel="noopener noreferrer" className="text-gold-deep underline hover:text-charcoal">
                          Track delivery
                        </a>
                      </dd>
                    </div>
                  )}
                </>
              )}
              {order.pointsRedeemed > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal/60">Points used</dt>
                  <dd className="text-charcoal">{order.pointsRedeemed.toLocaleString()} (−{formatPrice(order.pointsDiscountAmount, currency)})</dd>
                </div>
              )}
              {order.carrier && (
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal/60">Carrier</dt>
                  <dd className="text-charcoal">{order.carrier} · {order.trackingNumber}</dd>
                </div>
              )}
              {order.manualPaymentReference && (
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal/60">Payment reference</dt>
                  <dd className="text-charcoal">{order.manualPaymentReference}</dd>
                </div>
              )}
              {order.manualReceiptUrl && (
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal/60">Receipt</dt>
                  <dd>
                    <a href={order.manualReceiptUrl} target="_blank" rel="noopener noreferrer" className="text-gold-deep underline hover:text-charcoal">
                      View file
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">Customer</p>
            <p className="mt-2 text-sm text-charcoal">{order.user.name ?? order.user.email}</p>
            <p className="text-xs text-charcoal/60">{order.user.email}</p>
            <p className="mt-2 text-sm text-charcoal/70">
              Rewards balance: <span className="font-medium text-charcoal">{order.user.pointsBalance.toLocaleString()}</span> points
            </p>
            {!isStaff && (
              <Link href={`/admin/customers/${order.user.id}`} className="mt-1 inline-block text-xs text-gold underline">
                View customer history
              </Link>
            )}
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">Actions</p>
            <div className="mt-3 space-y-3">
              {!isStaff && order.shippingToBeArranged && <ClearShippingToBeArrangedButton orderId={order.id} />}
              {!isStaff && order.needsPointsApproval && <ClearPointsApprovalButton orderId={order.id} />}
              {order.needsShippingDetails && <p className="text-xs text-charcoal/60">Awaiting customer&apos;s shipping details.</p>}
              {order.status === "PENDING_PAYMENT" && order.paymentMethod === "WIRE_TRANSFER" && (!order.needsShippingDetails || !isStaff) && (
                <OrderActions orderId={order.id} orderNumber={order.orderNumber} canCancel={!isStaff} canMarkPaid={!order.needsShippingDetails} />
              )}
              {order.status === "PENDING_PAYMENT" && order.paymentMethod === "COD" && (
                <OrderActions
                  orderId={order.id}
                  orderNumber={order.orderNumber}
                  canCancel={!isStaff}
                  canMarkPaid={false}
                  cancelConfirmText={
                    order.codDepositPaidAt
                      ? `Cancel ${order.orderNumber}? Its deposit has already been received and will NOT be refunded automatically — arrange that separately before cancelling.`
                      : undefined
                  }
                />
              )}
              {order.paymentMethod === "COD" && order.codDepositRequired && !order.codDepositPaidAt && order.status === "PENDING_PAYMENT" && (
                <ConfirmCodDepositButton orderId={order.id} orderNumber={order.orderNumber} amount={order.codDepositAmount!} currency={currency} />
              )}
              {!order.needsShippingDetails && (
                order.status === "PAID"
                || (order.paymentMethod === "COD" && order.status === "PENDING_PAYMENT" && (!order.codDepositRequired || order.codDepositPaidAt != null))
              ) && <ShipOrderForm orderId={order.id} orderNumber={order.orderNumber} />}
              {order.status === "PAID" && order.paymentMethod !== "COD" && <RevertToUnpaidForm orderId={order.id} orderNumber={order.orderNumber} />}
              {!isStaff && order.status === "SHIPPED" && order.paymentMethod !== "COD" && <MarkDeliveredButton orderId={order.id} orderNumber={order.orderNumber} />}
              {order.paymentMethod === "COD" && (order.status === "SHIPPED" || order.status === "PAID") && (
                <MarkCodCollectedButton orderId={order.id} orderNumber={order.orderNumber} />
              )}
              {order.paymentMethod === "COD" && (order.status === "SHIPPED" || order.status === "PAID" || order.status === "DELIVERED") && (
                <CodDeliveryDetailsForm
                  orderId={order.id}
                  orderNumber={order.orderNumber}
                  defaultAgentName={order.codAgentName}
                  defaultAgentReference={order.codAgentReference}
                  defaultTrackingUrl={order.codTrackingUrl}
                />
              )}
              {order.status === "PAYMENT_REVERSED" && order.paymentReversedReason && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <p className="font-medium">Reverted to unpaid</p>
                  <p className="mt-1">{order.paymentReversedReason}</p>
                  {order.paymentReversedAt && <p className="mt-1 text-red-700/70">{order.paymentReversedAt.toLocaleString()}</p>}
                </div>
              )}
            </div>
          </div>

          {!isStaff && order.refundRequest && (
            <RefundResolutionPanel orderId={order.id} refund={order.refundRequest} currency={order.currency === "LKR" ? "LKR" : "USD"} />
          )}
        </div>
      </div>
    </div>
  );
}
