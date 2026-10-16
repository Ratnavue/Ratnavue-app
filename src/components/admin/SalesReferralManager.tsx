"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { searchPromoterCandidates, createPromoter, togglePromoterActive } from "@/actions/sales-referrals";
import { useAdminAction } from "@/lib/hooks/useAdminAction";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CopyLinkButton } from "@/components/account/CopyLinkButton";

type Candidate = { id: string; name: string | null; email: string; role: string };

export interface PromoterSummary {
  id: string;
  name: string | null;
  email: string;
  active: boolean;
  link: string;
  salesCount: number;
  totals: { currency: string; earned: number; pending: number; paid: number }[];
}

export function SalesReferralManager({ promoters }: { promoters: PromoterSummary[] }) {
  const router = useRouter();
  const { pending, error, run } = useAdminAction();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function handleSearch() {
    setSearching(true);
    try {
      setResults(await searchPromoterCandidates(query));
    } finally {
      setSearching(false);
    }
  }

  function handleDesignate(candidate: Candidate) {
    run(
      () => createPromoter(candidate.id),
      () => {
        setQuery("");
        setResults(null);
        router.refresh();
      },
      `${candidate.name ?? candidate.email} is now a sales referral promoter`,
    );
  }

  function handleToggle(promoter: PromoterSummary) {
    run(() => togglePromoterActive(promoter.id, !promoter.active), () => router.refresh());
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border-subtle bg-surface p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">Designate a Promoter</p>
        <p className="mt-1 text-sm text-charcoal/60">
          Search for an existing user with admin portal access (full ADMIN, or STAFF with at least one area) to make
          them a sales referral promoter.
        </p>
        <div className="mt-3 flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email" className="max-w-sm" />
          <Button type="button" variant="outline" size="sm" disabled={searching || query.trim().length < 2} onClick={handleSearch}>
            {searching ? "Searching..." : "Search"}
          </Button>
        </div>
        {results && (
          <ul className="mt-3 divide-y divide-border-subtle rounded-lg border border-border-subtle">
            {results.length === 0 && <li className="px-3 py-2 text-sm text-charcoal/55">No matching admin/staff accounts found.</li>}
            {results.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm text-charcoal">
                  {c.name ?? c.email} <span className="text-charcoal/50">({c.email}, {c.role})</span>
                </span>
                <Button type="button" size="sm" variant="gold" disabled={pending} onClick={() => handleDesignate(c)}>
                  Make Promoter
                </Button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      </div>

      <div className="rounded-xl border border-border-subtle bg-surface p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-charcoal/65">Promoters</p>
        {promoters.length === 0 && <p className="mt-2 text-sm text-charcoal/55">No promoters designated yet.</p>}
        <ul className="mt-3 space-y-4">
          {promoters.map((p) => (
            <li key={p.id} className="rounded-lg border border-border-subtle p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/admin/sales-referrals/${p.id}`} className="text-sm font-medium text-charcoal underline hover:text-gold-deep">
                    {p.name ?? p.email}
                  </Link>
                  <p className="text-xs text-charcoal/55">{p.email} · {p.salesCount} attributed sale{p.salesCount === 1 ? "" : "s"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!p.active && <span className="rounded-full bg-charcoal/5 px-2 py-0.5 text-[11px] text-charcoal/50">Inactive</span>}
                  <Button type="button" size="sm" variant={p.active ? "outline" : "gold"} disabled={pending} onClick={() => handleToggle(p)}>
                    {p.active ? "Deactivate" : "Reactivate"}
                  </Button>
                </div>
              </div>
              <div className="mt-2"><CopyLinkButton value={p.link} /></div>
              {p.totals.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-charcoal/70">
                  {p.totals.map((t) => (
                    <span key={t.currency}>
                      {t.currency}: {t.earned.toFixed(2)} earned · {t.pending.toFixed(2)} pending · {t.paid.toFixed(2)} paid
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
