import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

export const metadata: Metadata = { title: "Contact Us" };

function Row({ title, body, email }: { title: string; body: string; email: string }) {
  return (
    <div className="mt-6 rounded-xl border border-border-subtle p-5">
      <h2 className="font-serif text-lg text-charcoal">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-charcoal/70">{body}</p>
      <a href={`mailto:${email}`} className="mt-3 inline-block text-sm text-gold-deep underline hover:text-charcoal">
        {email}
      </a>
    </div>
  );
}

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Contact Us" }]} />
      <p className="text-xs uppercase tracking-widest text-gold-deep">Get in touch</p>
      <h1 className="mt-2 font-serif text-4xl text-charcoal">Contact Us</h1>
      <p className="mt-4 text-sm text-charcoal/60">
        Already have an order with us? The fastest way to reach us about it is through that order&apos;s own message
        thread under <strong>My Orders</strong> — our team is already watching those. For everything else, use
        whichever address below fits best.
      </p>

      <Row
        title="General Inquiries"
        body="Questions about Ratnavue, a piece you've seen, or anything that doesn't fit the categories below."
        email="info@ratnavue.com"
      />
      <Row
        title="Order Support"
        body="Help with an existing order, shipping, or a return."
        email="support@ratnavue.com"
      />
      <Row
        title="Wholesale & Trade"
        body="Bulk orders, trade accounts, or sourcing partnerships."
        email="sales@ratnavue.com"
      />
    </div>
  );
}
