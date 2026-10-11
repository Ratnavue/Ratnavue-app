"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCustomLocale, toggleCustomLocaleActive, removeCustomLocale } from "@/actions/locales";
import { useAdminAction } from "@/lib/hooks/useAdminAction";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { Input, Label } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { CustomLocale } from "@/lib/locales";

export function LocaleManager({ locales }: { locales: CustomLocale[] }) {
  const router = useRouter();
  const { pending, error, run } = useAdminAction();
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();

  function handleCreate(formData: FormData) {
    run(() => createCustomLocale(formData), () => {
      setOpen(false);
      router.refresh();
    });
  }

  async function handleToggle(code: string, active: boolean) {
    run(() => toggleCustomLocaleActive(code, active), () => router.refresh());
  }

  async function handleRemove(code: string) {
    if (!(await confirm(`Remove "${code}"? Any translations entered for it are removed too — this can't be undone, though the language (and its text) can always be added back later.`, { confirmLabel: "Remove", danger: true }))) return;
    run(() => removeCustomLocale(code), () => router.refresh());
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">Languages</p>
          <p className="mt-1 text-sm text-charcoal/60">
            7 languages ship with the app. Add more here — a new one starts on the English fallback until you fill in
            its translations below.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "Add Language"}
        </Button>
      </div>

      {open && (
        <form action={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="locale-code">Code</Label>
            <Input id="locale-code" name="code" placeholder="e.g. ja" maxLength={3} required />
          </div>
          <div>
            <Label htmlFor="locale-name">Name</Label>
            <Input id="locale-name" name="name" placeholder="Japanese" required />
          </div>
          <div>
            <Label htmlFor="locale-native">Native name</Label>
            <Input id="locale-native" name="nativeName" placeholder="日本語" required />
          </div>
          <Button type="submit" size="sm" variant="gold" disabled={pending}>
            {pending ? "Adding..." : "Add"}
          </Button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}

      {locales.length > 0 && (
        <ul className="mt-4 divide-y divide-border-subtle">
          {locales.map((l) => (
            <li key={l.code} className="flex items-center justify-between gap-3 py-2">
              <div>
                <span className="font-mono text-xs text-charcoal/55">{l.code}</span>{" "}
                <span className="text-sm text-charcoal">{l.name}</span>{" "}
                <span className="text-sm text-charcoal/60">({l.nativeName})</span>
                {!l.active && <span className="ml-2 rounded-full bg-charcoal/5 px-2 py-0.5 text-[11px] text-charcoal/50">Hidden</span>}
              </div>
              <div className="flex items-center gap-3">
                <button type="button" className="text-xs text-gold underline disabled:opacity-50" disabled={pending} onClick={() => handleToggle(l.code, !l.active)}>
                  {l.active ? "Hide" : "Show"}
                </button>
                <button type="button" className="text-xs text-red-700 underline disabled:opacity-50" disabled={pending} onClick={() => handleRemove(l.code)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
