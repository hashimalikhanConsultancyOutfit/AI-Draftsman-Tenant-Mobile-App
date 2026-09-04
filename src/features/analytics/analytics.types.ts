/**
 * Analytics — where consumption went over a 7/30/90-day window. Confirmed
 * against the real backend source, not just Swagger doc-comments (both
 * agreed — no drift found), 2026-09-04:
 *
 *   apps/gateway-b2b/src/app/auth/my-settings/settings.controller.ts
 *     (`getAnalytics`, `GET /auth/my-settings/analytics`)
 *   apps/b2b-billing/src/app/insights/insights.service.ts
 *     (`getUsageAnalytics` — the real logic; the controller's own local
 *     `AnalyticsFromLedger` interface is a minimal relabel-step typing,
 *     not the full contract)
 *
 * and web's own `src/store/api/settings.api.ts`, which this mirrors.
 *
 * ── A DIFFERENT SURFACE FROM `usage-credits` AND THE DRAWER'S `usage-spend` ─
 * Same backend service (b2b-billing) and window shape as `usage-credits`,
 * but a different read — this is a usage REPORT (totals, breakdowns,
 * durations), not a wallet. Money here is still integer pence, and the
 * £1 = 1 credit rule still applies (see `usageCredits.types.ts`'s note),
 * but there is no balance/grant concept on this screen.
 *
 * ── THREE USAGE METERS, UNION'D SERVER-SIDE ───────────────────────────────
 * `b2b_usage_event` (API-key traffic — the only meter with real
 * `latencyMs`), `b2b_usage_ledger_entry` (chat turns) and
 * `b2b_computer_usage_ledger_entry` (computer sessions, costed off
 * `sellPriceCents`, not `platformCostCents` — a deliberate difference
 * from the other two meters). `byAgent` can legitimately sum to LESS than
 * the headline total: a computer session has no agent to attribute to,
 * so those events are simply absent from that one breakdown.
 *
 * ── NAME RESOLUTION IS FAIL-SOFT AND INVISIBLE TO THE CLIENT ──────────────
 * `byAgent`/`byCustomer`'s `key` is a resolved NAME when the gateway's
 * lookup succeeds and the raw id when it doesn't (missing `customer.view`
 * on this role, a transport error, or an id nothing resolves to). There
 * is no field anywhere in this response distinguishing the two cases —
 * both are just strings in `key`. Render it as-is; there is nothing to
 * gate or flag client-side for this.
 */

export const ANALYTICS_WINDOWS = [7, 30, 90] as const;
export type AnalyticsWindow = (typeof ANALYTICS_WINDOWS)[number];

/** Same shape as `usageCredits.types.ts`'s `DailyUsagePoint` — the two
 * are structurally identical (both `{date, costCents, tokens, requests}`,
 * zero-filled server-side the same way), which is why this screen reuses
 * `CreditsBarChart` directly rather than forking it — see
 * `AnalyticsScreen.tsx`'s doc comment. */
export interface DailyUsagePoint {
  date: string;
  costCents: number;
  tokens: number;
  requests: number;
}

/** One row of a by-model / by-agent / by-customer breakdown. `key` is
 * either the dimension's name or its raw id — see the module doc. Rows
 * with no value for the grouping column (e.g. no agent) are dropped
 * server-side, never bucketed under a synthetic placeholder. */
export interface UsageBreakdownSlice {
  key: string;
  costCents: number;
  tokens: number;
  requests: number;
}

/** One of the 5 fixed latency buckets (`<2s`, `2s–10s`, `10s–1min`,
 * `1–10min`, `>10min`, the last with no upper bound). Only requests with
 * a measured `latencyMs` are bucketed at all — chat and computer-session
 * events never have one and are skipped entirely, not folded into a
 * "not timed" bucket. */
export interface DurationBucket {
  label: string;
  requests: number;
}

export interface UsageAnalytics {
  days: number;
  lastEventAt: string | null;
  totalCostCents: number;
  totalTokens: number;
  totalRequests: number;
  /** Days within the window that saw at least one request — the
   * denominator `averageCostPerActiveDayCents` actually divides by,
   * never the size of the window itself. */
  activeDays: number;
  averageCostPerActiveDayCents: number;
  daily: DailyUsagePoint[];
  byModel: UsageBreakdownSlice[];
  byAgent: UsageBreakdownSlice[];
  byCustomer: UsageBreakdownSlice[];
  durations: DurationBucket[];
  /** How many of `totalRequests` had a measurable duration. Only the
   * API-key meter records one — render the durations section only when
   * this is greater than 0, and the "covers X of Y" caption only when
   * it's less than `totalRequests` (partial coverage), matching web
   * exactly. */
  durationsMeasuredRequests: number;
}

export type AnalyticsGroupBy = 'model' | 'agent' | 'customer';
