"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

type ToastFn = (message: string, variant?: ToastVariant) => void;

const ToastContext = createContext<ToastFn | null>(null);

const AUTO_DISMISS_MS = 3500;

/**
 * A minimal, auto-dismissing confirmation toast — same "replace a native,
 * unstyled browser primitive with a real dialog matching the site's own
 * design" reasoning as ConfirmProvider, just for "it worked" instead of
 * "are you sure?". Mounted once at the root (see app/layout.tsx) so any
 * component can call useToast() and fire a message with no local state of
 * its own to manage.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastFn>((message, variant = "success") => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[200] flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg transition-opacity",
              item.variant === "success" ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900",
            )}
          >
            {item.variant === "success" ? <CheckCircle2 size={16} className="shrink-0 text-green-600" /> : <XCircle size={16} className="shrink-0 text-red-600" />}
            <span>{item.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(item.id)} className="ml-1 shrink-0 text-current/50 hover:text-current">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

/** Same context, but returns null instead of throwing outside a
 * ToastProvider — for hooks like useAdminAction that call it internally
 * and should still work (just silently skip the toast) in an isolated
 * unit test that doesn't wrap every provider in the real app tree. */
export function useOptionalToast(): ToastFn | null {
  return useContext(ToastContext);
}
