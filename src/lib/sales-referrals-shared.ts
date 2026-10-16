// Split out from lib/sales-referrals.ts (which imports Prisma) so
// src/proxy.ts can read these two constants without pulling the Prisma
// client into the edge middleware bundle — same "edge-safe constants in
// their own file" convention as lib/market-shared.ts.

export const SALES_REF_COOKIE = "sales_ref";
export const SALES_REF_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24; // 1 day
