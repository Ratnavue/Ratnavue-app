import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { marketFilterFor } from "@/lib/rbac";
import type { ReviewStatus } from "@prisma/client";
import { ReviewModerationRow } from "@/components/admin/ReviewModerationRow";
import { Badge } from "@/components/ui/Badge";
import { BackLink } from "@/components/admin/BackLink";
import { Pagination } from "@/components/ui/Pagination";

const TABS: { value: ReviewStatus | "ALL"; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

const STATUS_STYLES: Record<ReviewStatus, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

const PAGE_SIZE = 20;

export default async function AdminReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  const sp = await searchParams;
  const tab = (typeof sp.status === "string" ? sp.status : "PENDING") as ReviewStatus | "ALL";
  const status = TABS.some((t) => t.value === tab) ? tab : "PENDING";
  const page = Math.max(1, Number(sp.page) || 1);

  // A STAFF member scoped to one store only sees reviews of that store's items.
  const session = await auth();
  const market = session?.user ? marketFilterFor(session.user) : undefined;

  const where = {
    ...(status === "ALL" ? {} : { status }),
    ...(market ? { OR: [{ gemstone: { market } }, { jewelry: { market } }] } : {}),
  };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { name: true, email: true } },
        gemstone: { select: { name: true, slug: true } },
        jewelry: { select: { name: true, slug: true } },
      },
    }),
    prisma.review.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <BackLink href="/admin" label="Back to Dashboard" />
      <h1 className="font-serif text-3xl text-charcoal">Reviews</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        Every review is from a verified purchase — nothing here is ever fabricated. Approve or reject before it can
        show on the item&apos;s own product page.
      </p>

      <div className="mt-6 flex gap-2 border-b border-border-subtle">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/admin/reviews?status=${t.value}`}
            className={`border-b-2 px-3 py-2 text-sm ${status === t.value ? "border-gold text-charcoal" : "border-transparent text-charcoal/60 hover:text-charcoal"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {reviews.length === 0 ? (
          <p className="text-sm text-charcoal/60">Nothing here.</p>
        ) : (
          reviews.map((review) => {
            const item = review.gemstone ?? review.jewelry;
            const href = item ? `/${review.gemstone ? "gems" : "jewelry"}/${item.slug}` : null;
            return (
              <div key={review.id} className="rounded-xl border border-border-subtle bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-charcoal">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                      <Badge className={STATUS_STYLES[review.status]}>{review.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-charcoal/60">
                      {review.user.name ?? review.user.email} on{" "}
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:text-charcoal">
                          {item?.name}
                        </a>
                      ) : (
                        item?.name ?? "a deleted item"
                      )}{" "}
                      · {review.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                  {review.status === "PENDING" && <ReviewModerationRow id={review.id} />}
                </div>
                {review.body && <p className="mt-3 text-sm text-charcoal/80">{review.body}</p>}
                {review.adminNotes && <p className="mt-2 text-xs text-charcoal/50">Admin note: {review.adminNotes}</p>}
              </div>
            );
          })
        )}
      </div>

      <Pagination currentPage={page} totalPages={totalPages} searchParams={sp} />
    </div>
  );
}
