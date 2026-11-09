import type { Metadata } from "next";
import { XCircle } from "lucide-react";
import { cancelPendingOrder } from "@/actions/checkout";
import { LinkButton } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Payment Cancelled" };

// Public — no session required, same reasoning as /checkout/return (see
// the middleware comment). cancelPendingOrder only ever moves a
// PENDING_PAYMENT order to CANCELLED and never touches the retail
// cart — the customer's items are still there to check out again.
export default async function CheckoutCancelPage({ searchParams }: PageProps<"/checkout/cancel">) {
  const sp = await searchParams;
  const orderRecordId = typeof sp.order === "string" ? sp.order : "";
  if (orderRecordId) await cancelPendingOrder(orderRecordId);

  return (
    <div className="mx-auto max-w-lg px-5 pb-24 pt-10 text-center sm:px-8">
      <XCircle size={40} className="mx-auto text-charcoal/65" />
      <h1 className="mt-4 font-serif text-4xl text-charcoal">No Charge Was Made</h1>
      <p className="mt-4 text-charcoal/70">Your cart is still here whenever you&apos;re ready to try again.</p>
      <LinkButton href="/account/retail-cart" variant="primary" className="mt-8">Back to Cart</LinkButton>
    </div>
  );
}
