import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import Link from "@/components/ui/MarketLink";

export const metadata: Metadata = { title: "Terms & Conditions" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-xl text-charcoal">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-charcoal/75">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Terms & Conditions" }]} />
      <p className="text-xs uppercase tracking-widest text-gold-deep">Legal</p>
      <h1 className="mt-2 font-serif text-4xl text-charcoal">Terms &amp; Conditions</h1>
      <p className="mt-4 text-sm text-charcoal/60">
        These terms apply to every purchase made through Ratnavue, on both our international and Sri Lanka stores.
        By creating an account or placing an order, you agree to them.
      </p>

      <Section title="Orders & Payment">
        <p>
          Placing an order is an offer to buy at the price shown at checkout. An order is confirmed once payment is
          received — for a card payment, that&apos;s at the moment of purchase; for a bank transfer, once we&apos;ve
          confirmed the funds have arrived.
        </p>
      </Section>

      <Section title="One-of-a-Kind Items">
        <p>
          Every gemstone and most jewelry pieces listed on Ratnavue are natural, one-of-a-kind items — not
          reproducible designs. Once an item sells, it will not be restocked. Photos are taken to represent the
          actual piece as closely as possible, but natural stones can show subtle variation under different
          lighting.
        </p>
      </Section>

      <Section title="Shipping">
        <p>
          We ship internationally with tracked, insured courier service. Shipping costs are calculated at checkout
          based on destination and, for some items, weight — an item without a fixed shipping rate may be marked
          &ldquo;Quote Shipping,&rdquo; in which case we&apos;ll follow up with you directly to arrange it.
        </p>
      </Section>

      <Section title="Returns & Refunds">
        <p>
          Returns and refunds are not guaranteed on every sale — but Ratnavue does have a process to handle them.
          If something isn&apos;t right with your order, you can start a return request from{" "}
          <strong>My Orders</strong> once it&apos;s marked paid, choosing the reason that best describes the issue.
          Our team will follow up with you in that order&apos;s own message thread, and once we&apos;ve agreed on an
          outcome, we&apos;ll finalize it as a full refund, a refund minus the original shipping cost, or a partial
          refund — whichever fits the situation.
        </p>
        <p>
          Because most items are natural, one-of-a-kind pieces, we ask that any return request be started as soon
          as possible after delivery.
        </p>
      </Section>

      <Section title="Auctions">
        <p>
          Winning an auction creates an order at your winning bid amount, payable by bank transfer within 24 hours
          of the auction closing. If payment isn&apos;t received within that window, the item is released back for
          sale and the order is cancelled.
        </p>
      </Section>

      <Section title="Rewards Program">
        <p>
          Ratnavue may, at its discretion, award rewards points on completed purchases and change or discontinue
          the rewards program at any time. Points have no cash value outside of redemption on a future Ratnavue
          purchase.
        </p>
      </Section>

      <Section title="Account & Conduct">
        <p>
          You&apos;re responsible for keeping your account credentials secure and for the accuracy of the
          information you provide us, including your shipping address. We reserve the right to refuse or cancel an
          order at our discretion — for example, if we suspect fraud or if an item&apos;s listed availability was in
          error.
        </p>
      </Section>

      <Section title="Changes to These Terms">
        <p>
          We may update these terms from time to time as our services change. The version in effect at the time you
          place an order is the one that applies to it.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms, or about an existing order, can be sent through your account&apos;s message
          threads or our <Link href="/contact" className="text-gold-deep underline hover:text-charcoal">contact page</Link>.
        </p>
      </Section>
    </div>
  );
}
