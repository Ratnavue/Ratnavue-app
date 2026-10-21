"use client";

import { useRouter } from "next/navigation";
import { confirmCodDepositReceivedByAdmin } from "@/actions/orders";
import { useAdminAction } from "@/lib/hooks/useAdminAction";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";

// Shown only while a COD order's required deposit is still outstanding —
// see lib/orders.ts's confirmCodDepositReceived. Unlike markOrderPaid,
// this never touches the order's status (it's a partial payment).
export function ConfirmCodDepositButton({
  orderId, orderNumber, amount, currency,
}: { orderId: string; orderNumber: string; amount: number; currency: "USD" | "LKR" }) {
  const router = useRouter();
  const { pending, error, run } = useAdminAction();
  const confirm = useConfirm();

  async function handleClick() {
    if (!(await confirm(`Confirm the ${formatPrice(amount, currency)} deposit for ${orderNumber} has been received by bank transfer?`))) return;
    run(() => confirmCodDepositReceivedByAdmin(orderId), () => router.refresh());
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" size="sm" variant="gold" disabled={pending} onClick={handleClick}>
        {pending ? "Saving..." : "Confirm deposit received"}
      </Button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
