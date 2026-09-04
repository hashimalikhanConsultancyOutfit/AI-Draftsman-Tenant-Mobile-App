/**
 * Dashboard response shapes — confirmed against api-screen-mapping.md §Dashboard
 * (deliverable/api-screen-mapping.md) and the live capture from
 * https://b2b-fe.aidraftsman.ai/dashboard on 2026-08-31.
 *
 * Money-gating rule the whole module obeys: fields gated by `usage.view`
 * are DELETED from the JSON when the caller lacks the grant — absent, not
 * null, not zero. Every such field is optional here and must render as
 * "—" or be hidden, never as £0.00 (that would misreport an unknown
 * figure as a real one).
 */

export type RunStatus = 'CHARGED' | 'NOT_CHARGED_CACHED' | 'NOT_CHARGED_FAILURE' | 'REVERSED';

export interface SpendByDayPoint {
  date: string;
  spend: number;
}

export interface TopCustomerBySpend {
  id: string;
  name: string;
  quotaUsedPct: number | null;
  spend?: number;
}

export interface RecentRun {
  id: string;
  at: string;
  agent: string | null;
  customer: string | null;
  model: string;
  tokens: number;
  cost?: number;
  status: RunStatus;
}

export interface DashboardResponse {
  period: string;
  currency: string;
  /** 0 means "no ceiling" on this endpoint — NOT the same meaning as
   * `capCents: 0` on /limits, which blocks all spend. Two different
   * screens, opposite meaning for the same number. */
  spendCap?: number;
  summary: {
    spend?: number;
    tokens: number;
    requests: number;
  };
  spendByDay: SpendByDayPoint[];
  topCustomersBySpend: TopCustomerBySpend[];
  recentRuns: RecentRun[];
}

export interface CustomerStatsResponse {
  registered: number;
  active: number;
  suspended: number;
  clonesAssigned: number;
  nearOrAtQuota?: number;
  attributedSpendCents?: number;
}

export interface LimitsResponse {
  capCents: number;
  spentCents: number;
  remainingCents: number;
  balanceCents: number;
  alertAt: number[];
  hardStop: boolean;
  currency: string;
}
