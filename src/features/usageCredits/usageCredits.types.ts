/**
 * Usage and credits — the workspace's wallet balance, grants and metered
 * spend. Confirmed against the real backend source, not just its Swagger
 * doc-comment (both agreed — no drift found), 2026-09-04:
 *
 *   apps/gateway-b2b/src/app/auth/my-settings/settings.controller.ts
 *     (`getUsageCredits`, `GET /auth/my-settings/usage-credits`)
 *   apps/b2b-billing/src/app/insights/insights.service.ts
 *     (`getCreditSummary` — the real logic behind the DTO's claims)
 *
 * and web's own `src/store/api/settings.api.ts`, which this mirrors.
 *
 * ── THIS IS A DIFFERENT SURFACE FROM `usage-spend`'s `GET /usage` ────────
 * That module (the drawer's "Usage and spend") is a workspace-wide
 * breakdown by model/customer/agent/key. This one is the Settings tab's
 * wallet view: balance, grants, and a day-by-day/session history — a
 * different endpoint, a different backend service (b2b-billing here vs.
 * gateway-b2b's own usage controller there), and a different mental
 * model (a wallet, not a report).
 *
 * ── £1 = 1 CREDIT ──────────────────────────────────────────────────────────
 * This platform meters in money, not an abstract credit unit: the wallet
 * holds a GBP balance and every usage event carries a cost in pence.
 * There is no separate "credits remaining" counter to render — a balance
 * of `10000` pence is both £100.00 and 100 credits, and dividing by 100
 * once at the render edge (`formatMoneyCents`) states both facts in one
 * figure, exactly as web's own doc comment argues.
 *
 * ── `seatUsedCents` IS ALWAYS NULL, AND THAT'S NOT A BUG ──────────────────
 * The ledger attributes a usage event to an API key, not to the person
 * who triggered the run, so there is no seat-level attribution to report.
 * Render "Not tracked", never a coerced `0` — a zero would claim the
 * figure is known to be nothing, which is a different and false
 * statement.
 *
 * ── `grants` IS THE LAST 100 WALLET TRANSACTIONS, NOT THE FULL HISTORY ────
 * `insights.service.ts` reads the wallet's last 100 transactions and
 * filters to GRANT/TOPUP — a wallet with more than 100 movements can have
 * older grants silently excluded from both this list and the
 * `grantedCents`/`orgUsedCents` totals derived from the same window. A
 * known characteristic of the real endpoint, not something to work
 * around client-side.
 */

export const USAGE_CREDITS_WINDOWS = [7, 30, 90] as const;
export type UsageCreditsWindow = (typeof USAGE_CREDITS_WINDOWS)[number];

export interface CreditGrant {
  id: string;
  /** `'GRANT'` (opening grant) or `'TOPUP'` — see
   * `usageCreditsRules.ts`'s `GRANT_TYPE_LABEL` for the copy. Typed as
   * `string` rather than a union since the wire contract doesn't close
   * the set. */
  type: string;
  amountCents: number;
  balanceAfterCents: number;
  source: string;
  grantedAt: string;
}

export interface UsageHistoryRow {
  id: string;
  modelSlug: string;
  providerServed: string;
  tokens: number;
  cachedTokens: number;
  costCents: number;
  latencyMs: number;
  agentRef: string | null;
  customerRef: string | null;
  occurredAt: string;
}

/** One day of the zero-filled daily series — already zero-filled
 * server-side across the whole window, oldest first; no client-side
 * fill-in needed (unlike Dashboard's `spendByDay.ts`, which fills a
 * sparser response itself). */
export interface DailyUsagePoint {
  date: string;
  costCents: number;
  tokens: number;
  requests: number;
}

export interface CreditSummary {
  currency: string;
  balanceCents: number;
  grantedCents: number;
  orgUsedCents: number;
  /** Always `null` — see module doc. */
  seatUsedCents: number | null;
  lowBalanceAlertAtCents: number;
  grants: CreditGrant[];
  daily: DailyUsagePoint[];
  history: UsageHistoryRow[];
  /** `false` means this tenant has never been funded — a real state
   * (200 with zeroed fields), not an error. */
  walletProvisioned: boolean;
}
