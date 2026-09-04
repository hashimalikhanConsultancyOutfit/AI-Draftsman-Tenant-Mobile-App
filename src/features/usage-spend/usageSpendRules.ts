/**
 * Usage & spend — copy constants and pure helpers. Ported from web's
 * `UsageSpend.data.ts`/`UsageSpend.tsx`/`sections/UsageTable/
 * UsageTable.tsx` (confirmed against that source 2026-09-04), re-flowed
 * from a table into stacked cards — this app's standard adaptation for
 * anything wider than a phone.
 */
import type { UsageDimension, UsageRow } from './usageSpend.types';

export const PAGE_DESCRIPTION = 'Where the consumption went, broken down four ways.';

export const USAGE_TABS: { value: UsageDimension; label: string; dimension: string }[] = [
  { value: 'model', label: 'By model', dimension: 'Model' },
  { value: 'customer', label: 'By customer', dimension: 'Customer' },
  { value: 'agent', label: 'By agent', dimension: 'Agent' },
  { value: 'key', label: 'By key', dimension: 'Key' },
];

/** The rollup's own bucket for usage it could not attribute — a chat
 * turn has no api key, a tenant's own traffic has no customer. Real
 * figures, relabelled rather than filtered, so every breakdown still
 * sums to the tenant total. */
export const UNATTRIBUTED = '(none)';

export function rowDisplayLabel(row: Pick<UsageRow, 'label'>, dimension: string): string {
  return row.label === UNATTRIBUTED ? `Unattributed ${dimension.toLowerCase()}` : row.label;
}

/* --- Permission-denied captions ------------------------------------------- */

export const NO_EXPORT_MESSAGE = 'You do not have permission to export usage. Reading it on screen and taking a copy away are separate grants.';
export const NO_EXPORT_CAPTION = 'Exporting needs the "Export usage" permission.';

/* --- Export ------------------------------------------------------------- */

export const EXPORT_DESCRIPTION = 'One CSV for the current month, grouped by key, model and customer — the same file finance would reconcile against.';

/** "August 2026", off a `YYYY-MM` period string, UTC-safe like
 * Organization Settings' own `formatPeriod` — a `Date` built from just a
 * year/month string is local-time in JS, which mislabels the period for
 * anyone west of Greenwich. */
export function formatPeriodLabel(period: string): string {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** `YYYY-MM` for the current month, in UTC — matching the backend's own
 * `currentPeriod()`. */
export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

/* --- Month-end projection -------------------------------------------------- */

/**
 * Straight-line projection to month end. Deliberately naive, and labelled
 * as such in the UI (see the "Projected" tile's caption) — a spend
 * projection that looks more precise than it is invites someone to plan
 * against it.
 */
export function projectMonthEnd(spentSoFar: number, elapsedFraction: number): number {
  return elapsedFraction > 0 ? Number((spentSoFar / elapsedFraction).toFixed(2)) : spentSoFar;
}

/**
 * How far through the month we actually are, as a fraction. Counted in
 * days, not milliseconds: the projection is a straight line off a daily
 * spend rate, so sub-day precision would be false precision. `now` is a
 * parameter so this is testable without stubbing the clock — same shape
 * as web's own `monthElapsedFraction`, which this replaces a one-time
 * hardcoded `0.7` with (ported here as real logic, not carried over as
 * a stale constant).
 */
export function monthElapsedFraction(now: Date = new Date()): number {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return now.getDate() / daysInMonth;
}
