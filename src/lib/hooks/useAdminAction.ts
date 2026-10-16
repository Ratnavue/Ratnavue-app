"use client";

import { useState, useTransition } from "react";
import { useOptionalToast } from "@/components/providers/ToastProvider";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Runs a server action with pending/error state, and a try/catch safety
 * net around it. Without the catch, an action that *throws* (a network
 * hiccup, a DB timeout — not the same as it returning `{ok:false}`) skips
 * straight past any error-handling code the caller had after the await,
 * leaving nothing shown to the user; under `useTransition` `pending`
 * still resolves, but under a plain `useState` pending flag it doesn't
 * either, so the button is stuck on its loading label forever.
 *
 * On success, also fires a brief confirmation toast (see ToastProvider) —
 * `successMessage` defaults to "Saved" since most call sites are a plain
 * edit-and-save; pass a more specific one (e.g. "Order marked paid") where
 * it's worth being precise. useOptionalToast (not useToast) so this still
 * works in an isolated unit test that renders the hook with no provider
 * tree around it — it just silently skips the toast in that case.
 */
export function useAdminAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useOptionalToast();

  function run(fn: () => Promise<ActionResult>, onSuccess?: () => void, successMessage = "Saved") {
    setError(null);
    startTransition(async () => {
      try {
        const result = await fn();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast?.(successMessage, "success");
        onSuccess?.();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return { pending, error, run, setError };
}
