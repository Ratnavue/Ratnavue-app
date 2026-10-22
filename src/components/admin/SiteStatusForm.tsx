"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSiteBannerSettings } from "@/actions/site-banner";
import { Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

interface Settings {
  intlEnabled: boolean;
  intlMessage: string | null;
  lkEnabled: boolean;
  lkMessage: string | null;
}

export function SiteStatusForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateSiteBannerSettings(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="max-w-2xl space-y-6 rounded-xl border border-border-subtle bg-surface p-6">
      <div className="rounded-lg border border-border-subtle bg-ivory-soft p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-charcoal">International site banner</p>
            <p className="mt-0.5 text-xs text-charcoal/60">
              Shows above the navigation on every page — browsing, search and checkout keep working exactly as they do now.
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 pt-0.5 text-sm text-charcoal/80">
            <input type="hidden" name="intlEnabled" value="false" />
            <input type="checkbox" name="intlEnabled" value="true" defaultChecked={settings.intlEnabled} className="accent-gold" />
            Enabled
          </label>
        </div>
        <div className="mt-3">
          <Label htmlFor="intlMessage">Message</Label>
          <textarea
            id="intlMessage"
            name="intlMessage"
            rows={2}
            maxLength={300}
            defaultValue={settings.intlMessage ?? ""}
            placeholder="e.g. We're updating how you can pay — thanks for your patience."
            className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-charcoal focus:border-gold focus:outline-none"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border-subtle bg-ivory-soft p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-charcoal">Sri Lanka site banner</p>
            <p className="mt-0.5 text-xs text-charcoal/60">Independent of the international one, and of any payment method toggle.</p>
          </div>
          <label className="flex shrink-0 items-center gap-2 pt-0.5 text-sm text-charcoal/80">
            <input type="hidden" name="lkEnabled" value="false" />
            <input type="checkbox" name="lkEnabled" value="true" defaultChecked={settings.lkEnabled} className="accent-gold" />
            Enabled
          </label>
        </div>
        <div className="mt-3">
          <Label htmlFor="lkMessage">Message</Label>
          <textarea
            id="lkMessage"
            name="lkMessage"
            rows={2}
            maxLength={300}
            defaultValue={settings.lkMessage ?? ""}
            placeholder="e.g. Card payments are coming back soon — pay by bank transfer or COD for now."
            className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-charcoal focus:border-gold focus:outline-none"
          />
        </div>
      </div>

      <FieldError>{error ?? undefined}</FieldError>
      {saved && <p className="text-sm text-green-700">Saved.</p>}
      <Button type="submit" variant="gold" disabled={pending}>
        {pending ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}
