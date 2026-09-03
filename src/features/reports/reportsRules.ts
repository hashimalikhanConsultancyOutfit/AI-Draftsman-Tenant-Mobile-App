/**
 * Reports — pure business rules and copy, ported from the web app's
 * `Reports.data.ts` / `useReports.tsx` (confirmed against that source, and
 * against `apps/gateway-b2b/src/app/reports/dto/report.dto.ts` for every
 * numeric bound, on 2026-09-03).
 */

import type { Report, ReportRun, ReportRunDeliveryChannel, ReportsModal } from './reports.types';

/* -------------------------------------------------------------------------- */
/* Option lists — every one a closed vocabulary the server validates against  */
/* -------------------------------------------------------------------------- */

/** Mirrors the server's `REPORT_DIMENSIONS`. `day`, `stage` and `owner` are in
 * the server's vocabulary and deliberately absent here — not servable yet. */
export const GROUP_BY_OPTIONS = [
  { label: 'Model', value: 'model' },
  { label: 'Agent', value: 'agent' },
  { label: 'Customer', value: 'customer' },
  { label: 'API key', value: 'key' },
] as const;

/** Matches `REPORT_DESTINATIONS` in the gateway's DTO exactly. Slack and
 * Webhook are withheld from what can be chosen (existing reports on either
 * keep delivering); `PDF` delivers nowhere by design — the file appears
 * under Logs to download either way. */
export const DESTINATION_OPTIONS = [
  { label: 'Email', value: 'Email' },
  { label: 'PDF', value: 'PDF' },
  { label: 'Email + PDF', value: 'Email + PDF' },
] as const;

/**
 * "Manual" covers two wire cadences: blank date -> `MANUAL` (fires only on
 * "Run now"), a date set -> `ONCE` (fires itself once, then never again).
 * One entry because from a user's side it's one decision.
 */
export const FREQUENCY_OPTIONS = [
  { label: 'Manual — run now, or pick a date and time', value: 'MANUAL' },
  { label: 'Daily', value: 'DAILY' },
  { label: 'Weekly', value: 'WEEKLY' },
  { label: 'Monthly', value: 'MONTHLY' },
  { label: 'Quarterly', value: 'QUARTERLY' },
  { label: 'Yearly', value: 'YEARLY' },
  { label: 'Every N days', value: 'CUSTOM' },
] as const;

/** ISO-8601 order: 1 = Monday … 7 = Sunday. Matches the server exactly. */
export const WEEKDAY_OPTIONS = [
  { label: 'Monday', value: '1' },
  { label: 'Tuesday', value: '2' },
  { label: 'Wednesday', value: '3' },
  { label: 'Thursday', value: '4' },
  { label: 'Friday', value: '5' },
  { label: 'Saturday', value: '6' },
  { label: 'Sunday', value: '7' },
] as const;

const ordinal = (day: number): string => {
  const lastTwo = day % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${day}th`;
  const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
  return `${day}${suffixes[day % 10] ?? 'th'}`;
};

/** 1st … 31st, where 31 is labelled "last day" — the server clamps to the
 * month's real length, so 31 runs on the 30th in April, the 28th in Feb. */
export const DAY_OF_MONTH_OPTIONS = Array.from({ length: 31 }, (_, index) => {
  const day = index + 1;
  return { label: day === 31 ? 'Last day of the month' : ordinal(day), value: String(day) };
});

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const MONTH_OPTIONS = MONTH_NAMES.map((label, index) => ({ label, value: String(index + 1) }));

/** `monthOfYear` means two things by frequency: for YEARLY it's THE month,
 * for QUARTERLY it's the FIRST month of a three-month cycle. */
export const QUARTER_START_OPTIONS = MONTH_NAMES.slice(0, 3).map((label, index) => ({
  label: `${label} — then every 3 months`,
  value: String(index + 1),
}));

/* -------------------------------------------------------------------------- */
/* HH:MM <-> minutes past midnight, and the schedule builder                  */
/* -------------------------------------------------------------------------- */

export const minutesToHhmm = (minutes: number): string => {
  const safe = Number.isFinite(minutes) ? Math.max(0, Math.min(1439, minutes)) : 0;
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

export const hhmmToMinutes = (value: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 23 || mins > 59) return null;
  return hours * 60 + mins;
};

/** `YYYY-MM-DD`, and only a real calendar date — matches the server's own
 * validation, since an invalid date sent through would 400 anyway. */
export const isValidIsoDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
  return date.getUTCFullYear() === Number(y) && date.getUTCMonth() + 1 === Number(m) && date.getUTCDate() === Number(d);
};

/** Which cadence fields each frequency reads — mirrors the server's own list
 * (and web's `FIELDS_USED`) exactly. */
export const FIELDS_USED: Record<string, readonly string[]> = {
  MANUAL: [],
  ONCE: ['runAtMinute', 'customStartAt'],
  DAILY: ['runAtMinute'],
  WEEKLY: ['runAtMinute', 'dayOfWeek'],
  MONTHLY: ['runAtMinute', 'dayOfMonth'],
  QUARTERLY: ['runAtMinute', 'dayOfMonth', 'monthOfYear'],
  YEARLY: ['runAtMinute', 'dayOfMonth', 'monthOfYear'],
  CUSTOM: ['runAtMinute', 'intervalDays'],
};

export interface ReportFormValues {
  name: string;
  frequency: string;
  onceDate: string;
  dayOfWeek: string;
  dayOfMonth: string;
  monthOfYear: string;
  quarterStart: string;
  intervalDays: string;
  runAtMinute: string;
  dims: string[];
  dest: string;
}

export const REPORT_FORM_DEFAULTS: ReportFormValues = {
  name: '',
  frequency: 'MANUAL',
  onceDate: '',
  dayOfWeek: '1',
  dayOfMonth: '1',
  monthOfYear: '1',
  quarterStart: '1',
  intervalDays: '14',
  runAtMinute: '06:00',
  dims: [],
  dest: 'Email',
};

/** A report's stored fields, as the form's values — mirrors web's own seed
 * step in `modalFields`. `frequency` comes back as `MANUAL` for a stored
 * `ONCE`, since that's the one entry the picker offers for both. */
export function toFormValues(report: Report): ReportFormValues {
  return {
    name: report.name,
    frequency: report.frequency === 'ONCE' ? 'MANUAL' : (report.frequency ?? 'MANUAL'),
    onceDate: report.customStartAt ? report.customStartAt.slice(0, 10) : '',
    dayOfWeek: String(report.dayOfWeek ?? 1),
    dayOfMonth: String(report.dayOfMonth ?? 1),
    monthOfYear: String(report.monthOfYear ?? 1),
    quarterStart: String(report.monthOfYear ?? 1),
    intervalDays: String(report.intervalDays ?? 14),
    runAtMinute: minutesToHhmm(report.runAtMinute ?? 360),
    dims: splitDimensions(report.dims),
    dest: deliveryChannelOf(report),
  };
}

/**
 * The form's values, as the structured cadence the API stores. Every field
 * the chosen frequency does NOT use is sent as an explicit `null`, never
 * omitted — an absent key on a PATCH means "leave this alone", so switching
 * weekly -> monthly without this would store a day-of-month next to the old
 * day-of-week, which describes no schedule at all.
 */
export function scheduleFromValues(values: ReportFormValues) {
  const picked = values.frequency || 'MANUAL';
  const frequency = picked === 'MANUAL' && values.onceDate ? 'ONCE' : picked;
  const used = FIELDS_USED[frequency] ?? [];
  const when = (field: string, value: number | null) => (used.includes(field) ? value : null);

  const onceAt = used.includes('customStartAt') && values.onceDate ? new Date(`${values.onceDate}T00:00:00.000Z`).toISOString() : null;
  const timeOfDay = used.includes('runAtMinute') ? (hhmmToMinutes(values.runAtMinute) ?? 360) : null;

  return {
    frequency: frequency as Report['frequency'],
    runAtMinute: timeOfDay,
    dayOfWeek: when('dayOfWeek', Number(values.dayOfWeek)),
    dayOfMonth: when('dayOfMonth', Number(values.dayOfMonth)),
    monthOfYear: when('monthOfYear', Number(frequency === 'QUARTERLY' ? values.quarterStart : values.monthOfYear)),
    intervalDays: when('intervalDays', Number(values.intervalDays)),
    customStartAt: onceAt,
  };
}

/** `"model, key"` -> `['model', 'key']`. */
export const splitDimensions = (joined: string | undefined): string[] =>
  (joined ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

/** "Email · 4 recipients" -> "Email" — the edit form's Delivery picker only
 * has the three channels, so the detail is stripped before seeding it. */
export const deliveryChannelOf = (report: Report): string => report.dest.split(' · ')[0] ?? report.dest;

export const buildReportDeleteWarning = (name: string): string =>
  `${name} will be removed along with its schedule. Reports already delivered are not recalled, and historical runs are not deleted from the audit log.`;

/* -------------------------------------------------------------------------- */
/* Run history — status/trigger/delivery copy, and formatting                */
/* -------------------------------------------------------------------------- */

export const STATUS_LABEL: Record<ReportRun['status'], string> = {
  OK: 'generated',
  FAILED: 'failed',
  PARTIAL: 'partly done',
  RUNNING: 'running',
};

export const TRIGGER_LABEL: Record<ReportRun['trigger'], string> = {
  MANUAL: 'run by hand',
  SCHEDULED: 'on schedule',
  CATCHUP: 'catch-up for a missed window',
};

export const DELIVERY_LABEL: Record<ReportRunDeliveryChannel['state'], string> = {
  DELIVERED: 'sent',
  FAILED: 'failed',
  UNAVAILABLE: 'not sent',
  SKIPPED: 'nothing to send',
};

export const channelsOf = (run: ReportRun): ReportRunDeliveryChannel[] =>
  run.delivery && 'channels' in run.delivery ? run.delivery.channels : [];

export const formatDuration = (ms: number | null): string => {
  if (ms === null) return '—';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
};

/** "3 Sep, 11:42" — no `Intl`/locale dependency, matching this app's own
 * zero-dependency date helpers elsewhere (see e.g. Lead criteria's
 * `relativeTime`). */
export const formatRunWhen = (iso: string): string => {
  const date = new Date(iso);
  const day = date.getDate();
  const month = SHORT_MONTH_NAMES[date.getMonth()];
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month}, ${hh}:${mm}`;
};

/* -------------------------------------------------------------------------- */
/* Manual-run polling                                                        */
/* -------------------------------------------------------------------------- */

/** 3s between reads: a real run is seconds to tens of seconds. */
export const RUN_POLL_MS = 3000;
/** 20 x 3s = one minute, well past a real run. Bounded because this loop
 * lives in a button handler, not a background subscription. */
export const RUN_POLL_MAX_ATTEMPTS = 20;

const TERMINAL_RUN_STATUSES = ['OK', 'PARTIAL', 'FAILED'] as const;
export const isRunTerminal = (status: string | null | undefined): boolean =>
  !!status && (TERMINAL_RUN_STATUSES as readonly string[]).includes(status);

/* -------------------------------------------------------------------------- */
/* Authorisation copy                                                        */
/* -------------------------------------------------------------------------- */

export const NO_PERMISSION_MESSAGE: Record<Exclude<ReportsModal, null>, string> = {
  create: 'You do not have permission to create or edit reports.',
  edit: 'You do not have permission to create or edit reports.',
  delete: 'You do not have permission to delete reports.',
};

export const NO_RUN_MESSAGE = 'You do not have permission to run reports. That is a separate grant from editing a schedule.';
export const NO_DOWNLOAD_MESSAGE = 'You do not have permission to download report files. That is a separate grant from running one.';
/* Web's `useReports.tsx` rewords the backend's raw 404 ("No file for that
 * run...") into this friendlier line rather than showing it verbatim —
 * mirrored here so mobile matches. The backend 404s whenever the run's
 * artifact row is missing or its retention window (7 days) has expired. */
export const FILE_EXPIRED_MESSAGE = 'That file is no longer available — exports are kept for 7 days.';
export const NO_CREATE_DESCRIPTION = 'No reports yet. Scheduling one needs the "Manage reports" permission — ask an owner or an admin to grant it.';

export const EXPORT_BRANDING_NOTE =
  "Exports carry YOUR branding, never AiDraftsman's — the filename and the document's own name already do, and logo, colours and sending address follow when the branding pipeline and a configured email sender land.";

export const REPORT_MODAL_COPY = {
  create: {
    title: 'New scheduled report',
    description:
      'Reports run on their schedule and the file appears under Logs, ready to download. Delivery to the channel you pick is not switched on yet. Reports can also be run on demand.',
    submitLabel: 'Create report',
  },
  edit: {
    title: 'Edit report',
    description: "Changing the schedule takes effect from the next run; it does not backfill.",
    submitLabel: 'Save changes',
  },
} as const;

export const REPORT_STATE_TONE: Record<string, 'success' | 'neutral' | 'error'> = {
  ok: 'success',
  'not run': 'neutral',
  failed: 'error',
};
