"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import { updateCertLab, deleteCertLab, toggleCertLabActive, uploadCertLabLogo, removeCertLabLogo } from "@/actions/master-data";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CARD_TR, CARD_TD, CARD_FIRST, CARD_SECOND, CARD_TD_ACTIONS } from "@/components/admin/responsive-table";

interface CertLab {
  id: string;
  name: string;
  websiteUrl: string | null;
  verifyUrlTemplate: string | null;
  logoUrl: string | null;
  active: boolean;
}

export function CertLabRow({ lab }: { lab: CertLab }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  async function handleSave(formData: FormData) {
    setError(null);
    const result = await updateCertLab(lab.id, formData);
    if (result && !result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <tr className={CARD_TR}>
        <td data-label="Logo" className={CARD_TD}>
          <LogoThumb name={lab.name} src={lab.logoUrl} />
        </td>
        <td className={`${CARD_FIRST} text-charcoal`}>
          {lab.websiteUrl ? (
            <a href={lab.websiteUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-charcoal/25 underline-offset-2 hover:text-gold">
              {lab.name}
            </a>
          ) : (
            lab.name
          )}
        </td>
        <td data-label="Verification URL" className={`${CARD_TD} max-w-xs truncate font-mono text-xs text-charcoal/70 max-lg:max-w-none max-lg:[overflow-wrap:anywhere] max-lg:whitespace-normal`} title={lab.verifyUrlTemplate ?? undefined}>
          {lab.verifyUrlTemplate || <span className="text-charcoal/35">— no public lookup —</span>}
        </td>
        <td data-label="Status" className={`${CARD_SECOND} text-charcoal/70`}>{lab.active ? "Active" : "Inactive"}</td>
        <td className={`${CARD_TD_ACTIONS} space-x-3`}>
          <button className="text-xs text-gold underline" onClick={() => setEditing(true)}>Edit</button>
          <button
            className="text-xs text-charcoal/60 underline"
            disabled={pending}
            onClick={() => startTransition(async () => { await toggleCertLabActive(lab.id, !lab.active); router.refresh(); })}
          >
            {lab.active ? "Deactivate" : "Activate"}
          </button>
          <button
            className="text-xs text-red-700 underline"
            disabled={pending}
            onClick={async () => {
              if (await confirm(`Delete "${lab.name}"? Any gemstones citing it will keep their report number but lose the lab link.`, { confirmLabel: "Delete", danger: true })) {
                startTransition(async () => { await deleteCertLab(lab.id); router.refresh(); });
              }
            }}
          >
            Delete
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border-subtle bg-ivory-soft last:border-0 max-lg:block">
      <td colSpan={5} className="px-4 py-4 max-lg:block">
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <LogoUploader labId={lab.id} logoUrl={lab.logoUrl} name={lab.name} />
          <form action={handleSave} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`lab-name-${lab.id}`}>Name</Label>
              <Input id={`lab-name-${lab.id}`} name="name" defaultValue={lab.name} required />
            </div>
            <div>
              <Label htmlFor={`lab-website-${lab.id}`}>Website</Label>
              <Input id={`lab-website-${lab.id}`} name="websiteUrl" defaultValue={lab.websiteUrl ?? ""} placeholder="https://..." />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`lab-verify-${lab.id}`}>Verification URL</Label>
              <Input id={`lab-verify-${lab.id}`} name="verifyUrlTemplate" defaultValue={lab.verifyUrlTemplate ?? ""} placeholder="https://...{certId}" />
              <p className="mt-1.5 text-xs text-charcoal/50">
                If the lab lets buyers verify a report online, paste its lookup URL and replace the report number in
                it with the literal text <code className="rounded bg-ivory-soft px-1 py-0.5">{"{certId}"}</code>.
                Ratnavue substitutes each gemstone&apos;s own certificate number into that spot automatically. Leave
                blank if the lab has no public lookup tool.
              </p>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" size="sm" variant="gold">Save</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
            <input type="hidden" name="active" value={lab.active ? "true" : "false"} />
            <FieldError className="sm:col-span-2">{error ?? undefined}</FieldError>
          </form>
        </div>
      </td>
    </tr>
  );
}

function LogoThumb({ name, src }: { name: string; src: string | null }) {
  if (!src) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border-subtle text-[9px] uppercase tracking-wide text-charcoal/30">
        None
      </div>
    );
  }
  return (
    <div className="relative h-10 w-10 overflow-hidden rounded-md border border-border-subtle bg-white">
      <Image src={src} alt={`${name} logo`} fill className="object-contain p-1" sizes="40px" />
    </div>
  );
}

// Uploads immediately on file select (its own action call), independent of
// the Name/Website/Verify URL form's Save button — same immediate-upload
// pattern as ContentImageField/CertificateManager elsewhere in admin.
function LogoUploader({ labId, logoUrl, name }: { labId: string; logoUrl: string | null; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  function handleUpload() {
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadCertLabLogo(labId, formData);
      if (!result.ok) setError(result.error);
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
    });
  }

  async function handleRemove() {
    if (!(await confirm("Remove this lab's logo?"))) return;
    startTransition(async () => { await removeCertLabLogo(labId); router.refresh(); });
  }

  return (
    <div className="w-32">
      <Label>Logo</Label>
      <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border border-border-subtle bg-white">
        {logoUrl ? (
          <Image src={logoUrl} alt={`${name} logo`} fill className="object-contain p-2" sizes="80px" />
        ) : (
          <span className="text-[9px] uppercase tracking-wide text-charcoal/30">No logo</span>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="w-32 text-[11px] text-charcoal/70 file:mr-2 file:cursor-pointer file:rounded-full file:border-0 file:bg-gold file:px-2.5 file:py-1 file:text-[10px] file:font-medium file:tracking-wide file:text-charcoal file:transition-colors hover:file:bg-gold-soft"
        />
        <p className="text-[10px] text-charcoal/45">Images only</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleUpload} disabled={pending} className="!px-2.5 !py-1 text-[11px]">
            {pending ? "..." : logoUrl ? "Replace" : "Upload"}
          </Button>
          {logoUrl && (
            <button type="button" onClick={handleRemove} disabled={pending} title="Remove logo" className="rounded p-1 text-charcoal/50 hover:bg-charcoal/10 hover:text-red-700">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <FieldError>{error ?? undefined}</FieldError>
    </div>
  );
}
