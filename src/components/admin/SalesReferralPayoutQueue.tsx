"use client";

import { useRouter } from "next/navigation";
import { resolvePayoutRequest } from "@/actions/sales-referrals";
import { useAdminAction } from "@/lib/hooks/useAdminAction";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { Input, Label } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export interface PayoutRequestRow {
  id: string;
  promoterName: string;
  currency: string;
  amount: number;
  createdAt: string;
}

export function SalesReferralPayoutQueue({ requests }: { requests: PayoutRequestRow[] }) {
  const router = useRouter();
  const { pending, error, run } = useAdminAction();
  const confirm = useConfirm();

  function handleResolve(id: string, resolution: "PAID" | "DENIED", form: HTMLFormElement) {
    const formData = new FormData(form);
    run(() => resolvePayoutRequest(id, resolution, formData), () => router.refresh(), resolution === "PAID" ? "Payout marked paid" : "Payout denied");
  }

  async function handleDeny(id: string, form: HTMLFormElement) {
    if (!(await confirm("Deny this payout request? Its commissions become eligible for a future request again.", { confirmLabel: "Deny", danger: true }))) return;
    handleResolve(id, "DENIED", form);
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">Payout Requests</p>
        <p className="mt-2 text-sm text-charcoal/55">No pending payout requests.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">Payout Requests</p>
      <ul className="mt-3 space-y-4">
        {requests.map((r) => (
          <li key={r.id} className="rounded-lg border border-border-subtle p-4">
            <p className="text-sm text-charcoal">
              <span className="font-medium">{r.promoterName}</span> requested {r.currency} {r.amount.toFixed(2)} on {new Date(r.createdAt).toLocaleDateString()}
            </p>
            <form
              className="mt-2 flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <div>
                <Label htmlFor={`ref-${r.id}`}>Payment reference</Label>
                <Input id={`ref-${r.id}`} name="paymentReference" placeholder="e.g. bank transfer note" className="w-56" />
              </div>
              <Button type="button" size="sm" variant="gold" disabled={pending} onClick={(e) => handleResolve(r.id, "PAID", e.currentTarget.closest("form")!)}>
                Mark Paid
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={(e) => handleDeny(r.id, e.currentTarget.closest("form")!)}>
                Deny
              </Button>
            </form>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
