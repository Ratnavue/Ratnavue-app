import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMarket } from "@/lib/market";
import { withMarket } from "@/lib/market-shared";
import { ensureReferralCode } from "@/lib/rewards";
import { getLoyaltySettings } from "@/lib/loyalty-settings";
import { SectionCard, EmptyNote } from "@/components/account/SectionCard";
import { CopyLinkButton } from "@/components/account/CopyLinkButton";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Rewards" };

const REASON_LABELS: Record<string, string> = {
  EARNED_PURCHASE: "Earned from a purchase",
  REDEEMED_CHECKOUT: "Redeemed at checkout",
  REFERRAL_BONUS_REFERRER: "Referral bonus",
  REFERRAL_BONUS_REFEREE: "Welcome bonus (referred)",
  ADMIN_ADJUSTMENT: "Adjustment",
};

const REFERRAL_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  QUALIFIED: "bg-sapphire-soft/15 text-sapphire border-sapphire-soft/30",
  REWARDED: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

const REFERRAL_STATUS_LABELS: Record<string, string> = {
  PENDING: "Signed up",
  QUALIFIED: "Qualified",
  REWARDED: "Rewarded",
};

// Loyalty points and referrals in one place, marketplace-style: a balance,
// a redeemable history, and a shareable code with who it's brought in so
// far. See lib/rewards.ts for how every number here is actually earned/
// redeemed/paid out.
export default async function RewardsPage() {
  const session = await auth();
  if (!session?.user) return null; // proxy.ts guards this route

  const market = await getMarket();
  const [user, referralCode, transactions, referrals, loyalty] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { pointsBalance: true } }),
    ensureReferralCode(session.user.id),
    prisma.pointsTransaction.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.referral.findMany({ where: { referrerId: session.user.id }, orderBy: { createdAt: "desc" }, include: { referee: { select: { name: true, email: true } } } }),
    getLoyaltySettings(),
  ]);

  const shareHref = withMarket(`/r/${referralCode}`, market);
  const shareUrl = `${process.env.AUTH_URL ?? "http://localhost:3000"}${shareHref}`;

  return (
    <div className="w-full space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-gold-deep">Rewards</p>
        <h1 className="mt-2 font-serif text-4xl text-charcoal">Points & Referrals</h1>
      </div>

      <div className="rounded-xl border border-gold/40 bg-gold/10 p-6">
        <p className="text-xs uppercase tracking-wide text-charcoal/65">Your balance</p>
        <p className="mt-1 font-serif text-4xl text-charcoal">{user.pointsBalance.toLocaleString()} <span className="text-lg font-sans text-charcoal/60">points</span></p>
        <p className="mt-2 text-sm text-charcoal/70">
          {loyalty.pointsEnabled
            ? "Earn points on every purchase, and redeem them for a discount at checkout."
            : "The rewards program is currently paused — your existing balance is safe, but no new points are being earned or redeemed."}
        </p>
      </div>

      <SectionCard title="Refer a friend">
        {loyalty.referralsEnabled ? (
          <div className="space-y-3 p-5">
            <p className="text-sm text-charcoal/70">
              Share your link — when a friend signs up and places their first qualifying order, you both earn bonus points.
            </p>
            <CopyLinkButton value={shareUrl} />
          </div>
        ) : (
          <EmptyNote>The referral program is currently paused — check back later.</EmptyNote>
        )}
        {referrals.length === 0 ? (
          loyalty.referralsEnabled && <EmptyNote>No referrals yet — share your link to get started.</EmptyNote>
        ) : (
          <div className="divide-y divide-border-subtle px-5 pb-2">
            {referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-charcoal">{r.referee.name ?? r.referee.email}</p>
                  <p className="text-xs text-charcoal/60">{r.createdAt.toLocaleDateString()}</p>
                </div>
                <Badge className={REFERRAL_STATUS_STYLES[r.status] ?? ""}>{REFERRAL_STATUS_LABELS[r.status] ?? r.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Points history">
        {transactions.length === 0 ? (
          <EmptyNote>No points activity yet.</EmptyNote>
        ) : (
          <div className="divide-y divide-border-subtle px-5">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="text-charcoal">{REASON_LABELS[tx.reason] ?? tx.reason}</p>
                  <p className="text-xs text-charcoal/60">{tx.createdAt.toLocaleDateString()}</p>
                </div>
                <p className={tx.amount >= 0 ? "font-medium text-emerald-700" : "font-medium text-charcoal/70"}>
                  {tx.amount >= 0 ? "+" : ""}{tx.amount.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
