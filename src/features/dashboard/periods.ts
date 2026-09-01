/**
 * The Dashboard's month filter — a pure module for the same reason
 * `spendByDay.ts` is one: the range has an edge case worth pinning (year
 * rollover, e.g. October 2026 walking back into 2025) and a node spec
 * cannot import it out of a `.tsx` that pulls in React and the store.
 *
 * Confirmed live against the web app's own picker on 2026-09-01
 * (https://b2b-fe.aidraftsman.ai/dashboard): the list is exactly 13
 * entries — the current month first, then the trailing 12 — not tied to
 * account creation date or any server-driven range. `GET /dashboard`
 * takes a `period` query param shaped `YYYY-MM`, sent explicitly once a
 * month is selected (including the current one).
 */

/** "YYYY-MM" for the given date (today, by default). */
export function currentPeriod(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** The current month plus the preceding `count - 1`, newest first. */
export function getTrailingPeriods(count = 13, now: Date = new Date()): string[] {
  const periods: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return periods;
}
