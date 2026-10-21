"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setCodDeliveryDetailsByAdmin } from "@/actions/orders";
import { useAdminAction } from "@/lib/hooks/useAdminAction";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

// Who's actually collecting cash at the door for a COD order, and a link
// to track the delivery — distinct from the carrier/tracking fields
// ShipOrderForm sets (those feed 17track; this is plain metadata). Shown
// from SHIPPED onward and freely re-openable to edit — see
// lib/orders.ts's setCodDeliveryDetails.
export function CodDeliveryDetailsForm({
  orderId, orderNumber, defaultAgentName, defaultAgentReference, defaultTrackingUrl,
}: {
  orderId: string;
  orderNumber: string;
  defaultAgentName?: string | null;
  defaultAgentReference?: string | null;
  defaultTrackingUrl?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useAdminAction();
  const hasDetails = !!(defaultAgentName || defaultAgentReference || defaultTrackingUrl);

  function handleSubmit(formData: FormData) {
    run(
      () => setCodDeliveryDetailsByAdmin(orderId, formData),
      () => {
        setOpen(false);
        router.refresh();
      },
    );
  }

  return (
    <>
      <Button type="button" size="sm" variant={hasDetails ? "outline" : "gold"} onClick={() => setOpen(true)}>
        {hasDetails ? "Edit delivery-agent details" : "Add delivery-agent details"}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Delivery-agent details for ${orderNumber}`}>
        <form action={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="agentName">Agent name</Label>
            <Input id="agentName" name="agentName" defaultValue={defaultAgentName ?? ""} placeholder="E.g. Kasun (rider)" />
          </div>
          <div>
            <Label htmlFor="agentReference">Agent reference</Label>
            <Input id="agentReference" name="agentReference" defaultValue={defaultAgentReference ?? ""} placeholder="Their own reference/code" />
          </div>
          <div>
            <Label htmlFor="trackingUrl">Tracking URL</Label>
            <Input id="trackingUrl" name="trackingUrl" type="url" defaultValue={defaultTrackingUrl ?? ""} placeholder="https://..." />
          </div>
          <FieldError>{error ?? undefined}</FieldError>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="gold" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
