"use client";

import { useRouter } from "next/navigation";
import { markOrderPaid, cancelOrderAsAdmin } from "@/actions/orders";
import { useAdminAction } from "@/lib/hooks/useAdminAction";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { Button } from "@/components/ui/Button";

// Shown only for a bank-transfer or COD order still awaiting payment.
// canCancel defaults true (every existing admin caller) — staff-facing
// callers pass false, since cancelling (releasing the held item back to
// sale) wasn't part of what staff was granted, only marking paid.
// canMarkPaid is false for COD (there's nothing to "mark paid" here —
// see ConfirmCodDepositButton/MarkCodCollectedButton instead).
// cancelConfirmText overrides the default cancel confirmation — used for
// a COD order whose deposit already landed, to warn it isn't refunded
// automatically.
export function OrderActions({
  orderId, orderNumber, canCancel = true, canMarkPaid = true, cancelConfirmText,
}: { orderId: string; orderNumber: string; canCancel?: boolean; canMarkPaid?: boolean; cancelConfirmText?: string }) {
  const router = useRouter();
  const { pending, error, run } = useAdminAction();
  const confirm = useConfirm();

  async function handleClick(action: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>, confirmText: string) {
    if (!(await confirm(confirmText))) return;
    run(() => action(orderId), () => router.refresh());
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        {canMarkPaid && (
          <Button
            type="button"
            size="sm"
            variant="gold"
            disabled={pending}
            onClick={() => handleClick(markOrderPaid, `Confirm the bank transfer for ${orderNumber} has arrived? The items will be marked sold.`)}
          >
            Mark paid
          </Button>
        )}
        {canCancel && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => handleClick(cancelOrderAsAdmin, cancelConfirmText ?? `Cancel ${orderNumber}? Its held items go back on sale.`)}
          >
            Cancel
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
