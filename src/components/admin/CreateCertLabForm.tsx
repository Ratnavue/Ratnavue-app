"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCertLab } from "@/actions/master-data";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function CreateCertLabForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    const result = await createCertLab(formData);
    setPending(false);
    if (result && !result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="gold" onClick={() => setOpen(true)}>Add Lab</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add Certification Lab">
        <form action={handleSubmit} className="grid gap-3">
          <div>
            <Label htmlFor="new-lab-name">Name</Label>
            <Input id="new-lab-name" name="name" required placeholder="E.g. GIA" />
          </div>
          <div>
            <Label htmlFor="new-lab-website">Website (optional)</Label>
            <Input id="new-lab-website" name="websiteUrl" placeholder="https://www.gia.edu" />
          </div>
          <div>
            <Label htmlFor="new-lab-logo">Logo (optional)</Label>
            <input
              id="new-lab-logo"
              name="logo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full text-sm text-charcoal/70 file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-gold file:px-4 file:py-2 file:text-xs file:font-medium file:tracking-wide file:text-night file:transition-colors hover:file:bg-gold-soft"
            />
            <p className="mt-1.5 text-xs text-charcoal/50">
              Only images are supported (JPEG, PNG, or WEBP) — shown as the &ldquo;Certified&rdquo; badge on that
              lab&apos;s gems.
            </p>
          </div>
          <div>
            <Label htmlFor="new-lab-url">Verification URL (optional)</Label>
            <Input
              id="new-lab-url"
              name="verifyUrlTemplate"
              placeholder="https://www.example-lab.org/verify?reportno={certId}"
            />
            <p className="mt-2 text-xs text-charcoal/50">
              If the lab lets buyers verify a report online, paste its lookup URL and replace the report number in it
              with the literal text <code className="rounded bg-ivory-soft px-1 py-0.5">{"{certId}"}</code>. Ratnavue
              substitutes each gemstone&apos;s own certificate number into that spot automatically. Leave blank if the
              lab has no public lookup tool.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="gold" disabled={pending}>{pending ? "Adding..." : "Add Lab"}</Button>
          </div>
          <FieldError>{error ?? undefined}</FieldError>
        </form>
      </Modal>
    </>
  );
}
