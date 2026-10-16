"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/ui/MarketLink";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { getPublicOrderStatus, type PublicOrderStatus } from "@/actions/checkout";
import { LinkButton } from "@/components/ui/Button";
import { useMarket } from "@/components/providers/MarketProvider";
import { withMarket } from "@/lib/market-shared";

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 40; // ~100s — the webhook is usually near-instant; this just bounds the wait

// This page is public (see the middleware comment on why) and never
// renders order details — only a status, animated while it's still
// unresolved. Once PayHere's notify webhook confirms payment, this hands
// off to the authenticated /account/orders?highlight=... for anything
// actually sensitive (amount, items, address), rather than showing that
// here.
export function ReturnStatus({ orderRecordId, initial }: { orderRecordId: string; initial: PublicOrderStatus | null }) {
  const router = useRouter();
  const market = useMarket();
  const [result, setResult] = useState(initial);
  const [pollsRemaining, setPollsRemaining] = useState(MAX_POLLS);
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!result || result.status !== "PENDING_PAYMENT" || pollsRemaining <= 0) return;
    const timer = setTimeout(async () => {
      const fresh = await getPublicOrderStatus(orderRecordId);
      setResult(fresh);
      setPollsRemaining((n) => n - 1);
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [result, pollsRemaining, orderRecordId]);

  useEffect(() => {
    if (result?.status === "PAID" && !redirectedRef.current) {
      redirectedRef.current = true;
      const timer = setTimeout(() => {
        router.push(withMarket(`/account/orders/${orderRecordId}`, market));
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [result, router, market, orderRecordId]);

  if (!result) {
    return (
      <StatusShell icon={<HelpCircle size={40} className="text-charcoal/65" />} title="Order Not Found" animated={false}>
        <p className="mt-4 text-charcoal/70">We couldn&apos;t find that order.</p>
      </StatusShell>
    );
  }

  if (result.status === "PAID") {
    return (
      <StatusShell icon={<CheckCircle2 size={40} className="text-emerald-600" />} title="Payment Received" animated={false}>
        <p className="mt-4 text-charcoal/70">
          Order <span className="font-mono">{result.orderNumber}</span> is confirmed. Taking you to your orders...
        </p>
      </StatusShell>
    );
  }

  if (result.status === "PAYMENT_FAILED") {
    return (
      <StatusShell icon={<XCircle size={40} className="text-red-600" />} title="Payment Failed" animated={false}>
        <p className="mt-4 text-charcoal/70">
          Order <span className="font-mono">{result.orderNumber}</span> couldn&apos;t be charged. No further action was
          taken — your items are still in your cart.
        </p>
        <LinkButton href="/account/retail-cart" variant="primary" className="mt-8">Back to Cart</LinkButton>
      </StatusShell>
    );
  }

  if (result.status === "CANCELLED") {
    return (
      <StatusShell icon={<XCircle size={40} className="text-charcoal/65" />} title="Payment Cancelled" animated={false}>
        <p className="mt-4 text-charcoal/70">No charge was made. Your cart is still here whenever you&apos;re ready.</p>
        <LinkButton href="/account/retail-cart" variant="primary" className="mt-8">Back to Cart</LinkButton>
      </StatusShell>
    );
  }

  // PENDING_PAYMENT — still animated/waiting.
  if (pollsRemaining <= 0) {
    return (
      <StatusShell icon={<HelpCircle size={40} className="text-charcoal/65" />} title="Still Confirming" animated={false}>
        <p className="mt-4 text-charcoal/70">
          This is taking longer than usual. Order <span className="font-mono">{result.orderNumber}</span> will update
          automatically once PayHere confirms it — check your orders in a few minutes.
        </p>
        <LinkButton href={`/account/orders/${orderRecordId}`} variant="primary" className="mt-8">View Order</LinkButton>
      </StatusShell>
    );
  }

  return (
    <StatusShell icon={<Loader2 size={40} className="animate-spin text-gold-deep" />} title="Confirming Your Payment" animated>
      <p className="mt-4 text-charcoal/70">
        Order <span className="font-mono">{result.orderNumber}</span> — this usually only takes a few seconds.
      </p>
    </StatusShell>
  );
}

function StatusShell({ icon, title, animated, children }: { icon: React.ReactNode; title: string; animated: boolean; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-5 py-24 text-center sm:px-8">
      <div className={animated ? "inline-flex animate-pulse" : "inline-flex"}>{icon}</div>
      <h1 className="mt-4 font-serif text-4xl text-charcoal">{title}</h1>
      {children}
      <p className="mt-8 text-sm text-charcoal/65">
        <Link href="/gems" className="underline hover:text-charcoal">Continue Shopping</Link>
      </p>
    </div>
  );
}
