"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestOwnPayout } from "@/actions/sales-referrals";
import { useOptionalToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";

export function RequestPayoutButton({ currency, amount }: { currency: string; amount: number }) {
  const router = useRouter();
  const toast = useOptionalToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await requestOwnPayout(currency);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast?.(`Payout requested — ${currency} ${amount.toFixed(2)}`, "success");
      router.refresh();
    });
  }

  return (
    <div>
      <Button type="button" size="sm" variant="gold" disabled={pending || amount <= 0} onClick={handleClick}>
        {pending ? "Requesting..." : `Request Payout (${currency} ${amount.toFixed(2)})`}
      </Button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
