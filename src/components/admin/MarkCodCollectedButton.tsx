"use client";

import { useRouter } from "next/navigation";
import { markCodCollectedByAdmin } from "@/actions/orders";
import { useAdminAction } from "@/lib/hooks/useAdminAction";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { Button } from "@/components/ui/Button";

// Shown only for a SHIPPED COD order — the courier handed over the parcel
// and collected the remaining cash (or the full amount, if no deposit was
// required). Runs the full paid pipeline and marks DELIVERED in one go —
// see lib/orders.ts's collectCodPaymentAndDeliver for why these are a
// single action for COD, unlike every other payment method.
export function MarkCodCollectedButton({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const router = useRouter();
  const { pending, error, run } = useAdminAction();
  const confirm = useConfirm();

  async function handleClick() {
    if (!(await confirm(`Confirm the remaining balance has been collected in cash and ${orderNumber} delivered?`))) return;
    run(() => markCodCollectedByAdmin(orderId), () => router.refresh());
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" size="sm" variant="gold" disabled={pending} onClick={handleClick}>
        {pending ? "Saving..." : "Mark cash collected"}
      </Button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
