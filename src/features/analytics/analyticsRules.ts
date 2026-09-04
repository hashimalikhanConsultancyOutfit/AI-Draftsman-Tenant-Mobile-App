/**
 * Analytics — copy constants and pure helpers. Ported from web's
 * `AnalyticsPanel.tsx`/`useReportingTabs.tsx` (confirmed against those
 * sources 2026-09-04).
 */

import type { AnalyticsGroupBy, AnalyticsWindow, UsageBreakdownSlice } from './analytics.types';

export const PAGE_DESCRIPTION = 'Where consumption went over the last 7, 30 or 90 days.';
export const UTC_NOTE = 'Data in UTC.';
export const NO_ACTIVITY_NOTE = 'No activity in this window.';

export const AVG_PER_ACTIVE_DAY_CAPTION = 'Averaged over days with activity, not the whole window';

export const WINDOW_TABS: { label: string; value: AnalyticsWindow }[] = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];
export const DEFAULT_WINDOW: AnalyticsWindow = 30;

export const GROUP_BY_TABS: { label: string; value: AnalyticsGroupBy }[] = [
  { label: 'Model', value: 'model' },
  { label: 'Agent', value: 'agent' },
  { label: 'Customer', value: 'customer' },
];
export const DEFAULT_GROUP_BY: AnalyticsGroupBy = 'model';

export const NO_BREAKDOWN_TITLE = 'No usage yet';
export const NO_BREAKDOWN_MESSAGE = 'This breakdown fills in once agents start running.';
export const NO_DAILY_TITLE = 'No spend yet';
export const NO_DAILY_MESSAGE = 'Daily usage appears here once agents start running.';

export const DURATIONS_TITLE = 'Task durations';
export function durationsCoverageCaption(measured: number, total: number): string {
  return `Covers ${measured} of ${total} requests. Chat turns and computer sessions are not individually timed, so they are not counted here.`;
}

export const NOTHING_TO_EXPORT_MESSAGE = 'There is nothing to export for this window.';
export const EXPORT_DESCRIPTION = 'A CSV of the breakdown currently on screen — requests, tokens and credits per row.';

/** RFC 4180 quoting: wrap in quotes and double any embedded quote whenever
 * a field contains a comma, a quote or a newline — matching web's own
 * export function exactly. */
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** `key,requests,tokens,credits_pence`, one row per breakdown slice — the
 * same columns web's `handleExport` writes, built here instead since
 * mobile has no `<a download>`/blob-URL mechanism; see
 * `AnalyticsExportSheet.tsx` for how the result reaches the user. */
export function buildBreakdownCsv(rows: UsageBreakdownSlice[]): string {
  const header = 'key,requests,tokens,credits_pence';
  const lines = rows.map((row) => [csvField(row.key), csvField(row.requests), csvField(row.tokens), csvField(row.costCents)].join(','));
  return [header, ...lines].join('\n');
}
