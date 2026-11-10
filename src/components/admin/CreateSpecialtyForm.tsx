"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSpecialty } from "@/actions/master-data";
import { Input, Textarea, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function CreateSpecialtyForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    const result = await createSpecialty(formData);
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
      <Button type="button" variant="gold" onClick={() => setOpen(true)}>Add Speciality</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add Speciality">
        <form action={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="sp-name">Name</Label>
            <Input id="sp-name" name="name" required placeholder="E.g. Trapiche" />
          </div>
          <div>
            <Label htmlFor="sp-sortOrder">Sort Order</Label>
            <Input id="sp-sortOrder" name="sortOrder" type="number" defaultValue={0} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="sp-description">Description (optional)</Label>
            <Textarea id="sp-description" name="description" placeholder="Shown beside its checkbox on the gem form" />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="gold" disabled={pending}>
              {pending ? "Adding..." : "Add Speciality"}
            </Button>
          </div>
          <FieldError className="sm:col-span-2">{error ?? undefined}</FieldError>
        </form>
      </Modal>
    </>
  );
}
