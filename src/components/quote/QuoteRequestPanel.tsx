"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "@/components/ui/MarketLink";
import { useAppPathname } from "@/components/providers/MarketProvider";
import { CircleCheck, AlertTriangle } from "lucide-react";
import { submitQuoteRequest } from "@/actions/quotes";
import { Button } from "@/components/ui/Button";
import { Textarea, Label, Input } from "@/components/ui/Field";
import type { ConfiguredSpec } from "@/lib/validation/quote";

interface QuoteRequestPanelProps {
  isAuthenticated: boolean;
  gemstoneId?: string;
  jewelryId?: string;
  configuredSpec?: ConfiguredSpec;
  productLabel: string;
  /** Unboxed, with a full-width button — for when the panel already sits
   * inside its own card (the configurator). */
  bare?: boolean;
}

export function QuoteRequestPanel({ isAuthenticated, gemstoneId, jewelryId, configuredSpec, productLabel, bare = false }: QuoteRequestPanelProps) {
  const tq = useTranslations("quote");
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pathname = useAppPathname();

  if (!isAuthenticated) {
    return (
      <div className={bare ? "" : "rounded-xl border border-border-subtle bg-ivory-soft p-5"}>
        <p className={bare ? "text-charcoal/80" : "text-sm text-charcoal/75"}>{tq("signInPrompt", { product: productLabel })}</p>
        <Link href={`/account/login?callbackUrl=${encodeURIComponent(pathname)}`} className={bare ? "mt-4 block" : undefined}>
          <Button variant="primary" size={bare ? "lg" : "md"} className={bare ? "w-full" : "mt-3"}>{tq("signInCta")}</Button>
        </Link>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <CircleCheck className="mt-0.5 shrink-0 text-emerald-700" size={20} />
        <div>
          <p className="text-sm font-medium text-emerald-900">Quote request submitted</p>
          <p className="mt-1 text-sm text-emerald-800/80">
            Our gemologists will review it and follow up by email. You can track its status from{" "}
            <Link href="/account/quotes" className="underline">
              your account
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="gold" size="lg" className={bare ? "w-full" : undefined} onClick={() => setOpen(true)}>
        Request a Quote
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-5">
      <p className="font-serif text-lg text-charcoal">Request a Quote</p>
      <p className="mt-1 text-xs text-charcoal/65">for {productLabel}</p>

      <div className="mt-4 flex items-center gap-3">
        <Label htmlFor="quantity" className="mb-0 shrink-0">Quantity</Label>
        <Input
          id="quantity"
          type="number"
          min={1}
          max={20}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="w-24"
        />
      </div>

      <div className="mt-4">
        <Label htmlFor="note">Notes for our gemologist (optional)</Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="E.g. intended setting, timeline, or questions about the stone..."
        />
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-charcoal/65">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-gold-deep" />
          Please don&apos;t include a specific offer price here — we&apos;ll send you a quote based on the piece.
        </p>
      </div>

      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}

      <div className="mt-4 flex gap-3">
        <Button
          variant="gold"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await submitQuoteRequest({ gemstoneId, jewelryId, configuredSpec, quantity, note });
              if (result.ok) {
                setStatus("success");
              } else {
                setError(result.error);
              }
            });
          }}
        >
          {pending ? "Submitting..." : "Submit Request"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
