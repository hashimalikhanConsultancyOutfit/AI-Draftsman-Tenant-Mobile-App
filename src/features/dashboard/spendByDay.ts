/**
 * The spend-by-day chart's x-axis.
 *
 * `GET /dashboard` returns only the days that saw spend (see
 * `dashboard.types.ts`'s `SpendByDayPoint` comment) — a sparse list. Drawn as
 * bars in that shape, two days a fortnight apart render as neighbours, which
 * reads as continuous traffic when it was not. This expands the sparse list
 * into one value per calendar day of the period, filling gaps with a measured
 * zero — the same rule the web app's `Dashboard/spendByDay.ts` applies, ported
 * here so the two surfaces draw the same chart from the same response.
 *
 * Bounded at the period's own length, and at TODAY for the current month — a
 * chart that runs to the 30th on the 1st is otherwise almost entirely empty
 * space and reads as a collapse in traffic rather than a month that has not
 * happened yet.
 */

import type { SpendByDayPoint } from './dashboard.types';

export interface SpendSeries {
  /** One value per day, in date order. */
  values: number[];
  /** `YYYY-MM-DD`, one per value, in date order. */
  dates: string[];
}

const EMPTY: SpendSeries = { values: [], dates: [] };

export function expandSpendByDay(
  /** `YYYY-MM`. */
  period: string,
  days: SpendByDayPoint[],
  now: Date = new Date(),
): SpendSeries {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) {
    return EMPTY;
  }

  const byDate = new Map(days.map((day) => [day.date, day.spend]));

  /* Day 0 of the NEXT month is the last day of this one — handles February
     and leap years without a lookup table. */
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const isCurrentPeriod = now.getUTCFullYear() === year && now.getUTCMonth() + 1 === month;
  const lastDay = isCurrentPeriod ? now.getUTCDate() : daysInMonth;

  const values: number[] = [];
  const dates: string[] = [];

  for (let day = 1; day <= lastDay; day += 1) {
    const iso = `${period}-${String(day).padStart(2, '0')}`;
    /* `?? 0` is right here: the server reported on this month, and a day it
       omitted is a day with no spend — a measured zero, not an unanswered one. */
    values.push(byDate.get(iso) ?? 0);
    dates.push(iso);
  }

  return { values, dates };
}

export default expandSpendByDay;
