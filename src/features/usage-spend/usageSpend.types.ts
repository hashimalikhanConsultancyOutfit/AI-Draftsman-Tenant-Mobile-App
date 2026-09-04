/**
 * Usage & spend — the wire contract with `gateway-b2b`. Mirrors
 * `apps/gateway-b2b/src/app/usage/{usage.controller.ts,dto/usage.dto.ts}`
 * (read in full) and web's own `src/store/api/usage.api.ts`, confirmed
 * against source 2026-09-04.
 *
 * `GET /usage` reads `b2b_meter_rollup` — never the raw event table —
 * grouped by one of four dimensions, for one calendar month at a time
 * (the rollup has no day-grain column). `label` and `cached` both carry
 * real values today: the gateway resolves customer/agent/key ids to
 * names in-memory (there is no cross-database join at the data layer),
 * and derives the cache-hit rate from `cachedTokens` — despite what an
 * out-of-date line in the DTO's own Swagger description still claims;
 * the controller's actual behaviour (read in full) is the source of
 * truth here, not that comment.
 */

export const USAGE_DIMENSIONS = ['model', 'customer', 'agent', 'key'] as const;
export type UsageDimension = (typeof USAGE_DIMENSIONS)[number];

/** One row of any breakdown — the four dimensions share this shape. */
export interface UsageRow {
  /** The raw key (model slug, customer/agent/key id, or the `(none)`
   * unattributed bucket) — a row's identity, never shown. */
  id: string;
  /** Display label. A resolved name where one exists, otherwise the raw
   * id — never invented, per the gateway's own "an id that resolves to
   * nothing stays an id" rule. */
  label: string;
  requests: number;
  tokens: number;
  /** GBP. */
  cost: number;
  /** Cache hit rate, percent. `null` only when the bucket served no
   * tokens at all — a percentage of nothing is unanswerable, not zero. */
  cached: number | null;
}

export interface UsageTotals {
  requests: number;
  tokens: number;
  /** GBP — what the platform charged this workspace. */
  cost: number;
  /** GBP saved by cache hits this period, priced at the rate frozen onto
   * each ledger entry — a later rate change cannot reprice history. */
  cachedSavings: number;
  /** A COUNT of turns that ran, cost something, and were not charged —
   * never an amount. The usage writer zeroes cost on every non-CHARGED
   * status, so what was absorbed is not recoverable from the row. */
  unbilledFailures: number;
  /** GBP — what this workspace charged its OWN customers this period. */
  sell: number;
  /** GBP kept — the resale margin. Summed independently server-side,
   * never `sell - cost`: usage with no sell price contributes to `cost`
   * alone, so that subtraction would post an unpriced workspace as
   * having lost its entire bill. */
  margin: number;
}

export interface UsageResponse {
  /** `YYYY-MM`. */
  period: string;
  dimension: UsageDimension;
  rows: UsageRow[];
  totals: UsageTotals;
}

export interface UsageQueryArgs {
  dimension: UsageDimension;
  /** `YYYY-MM`. Omitted means the current month — the only window this
   * screen offers; web itself has no period picker either. */
  period?: string;
}
