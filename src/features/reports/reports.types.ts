/**
 * Reports — types, ported from the web app's `src/types/report.types.ts`
 * and `src/store/api/reports.api.ts` (confirmed against that source on
 * 2026-09-03). Field names mirror the gateway's own wire shape.
 */

export type ReportsModal = 'create' | 'edit' | 'delete' | null;

export type ReportFrequency =
  | 'MANUAL'
  | 'ONCE'
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'YEARLY'
  | 'CUSTOM';

/** A scheduled analytics export. */
export interface Report {
  id: string;
  name: string;
  /** Human-readable schedule, e.g. "Mon 07:00". */
  sched: string;
  /** Dimensions the report groups by, joined for display — "model, key". */
  dims: string;
  /** Delivery destination, composed for display — "Email · 4 recipients". */
  dest: string;
  /** Relative time of the last run, or "never". */
  last: string;
  /** e.g. `ok`, `not run`, `failed`. */
  state: string;
  cost?: boolean;
  /** The structured cadence `sched` is rendered from. */
  frequency?: ReportFrequency;
  /** Minutes past midnight UTC — 420 is 07:00. */
  runAtMinute?: number | null;
  /** WEEKLY only. ISO-8601: 1 = Monday … 7 = Sunday. */
  dayOfWeek?: number | null;
  /** MONTHLY, QUARTERLY, YEARLY. 31 means the last day, clamped server-side. */
  dayOfMonth?: number | null;
  /** YEARLY: the month. QUARTERLY: the first month of the cycle. */
  monthOfYear?: number | null;
  /** CUSTOM only. Days between runs. */
  intervalDays?: number | null;
  /** ONCE: the day it fires. CUSTOM: the anchor the interval counts from. */
  customStartAt?: string | null;
  nextRunAt?: string | null;
  timezone?: string;
}

export interface ReportPageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReportPage extends ReportPageMeta {
  items: Report[];
}

export interface ReportRunPage extends ReportPageMeta {
  items: ReportRun[];
}

export interface ReportListParams {
  page?: number;
  limit?: number;
}

export interface RunListParams {
  id: string;
  page?: number;
  limit?: number;
}

/** What a create/update sends. `dest`/`destDetail` split apart because the
 * row's `dest` is the composed display cell ("Email · 4 recipients"), not
 * what the form writes back. */
export interface ReportWriteBody {
  name: string;
  dims?: string[];
  dest?: string;
  destDetail?: string;
  cost?: boolean;
  frequency?: ReportFrequency;
  runAtMinute?: number | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
  intervalDays?: number | null;
  customStartAt?: string | null;
}

export type UpdateReportBody = ReportWriteBody & { id: string };

/** One attempt at producing a report — a row in the run log. */
export interface ReportRun {
  id: string;
  trigger: 'MANUAL' | 'SCHEDULED' | 'CATCHUP';
  status: 'RUNNING' | 'OK' | 'PARTIAL' | 'FAILED';
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  rowCount: number | null;
  periodFrom: string | null;
  periodTo: string | null;
  message: string | null;
  error: string | null;
  truncated?: boolean;
  delivery?: ReportRunDelivery | Record<string, never>;
}

export interface ReportRunDeliveryChannel {
  channel: 'email' | 'slack' | 'webhook';
  state: 'DELIVERED' | 'FAILED' | 'UNAVAILABLE' | 'SKIPPED';
  target: string | null;
  attempts: number;
  at: string;
  message: string;
  waitingOn?: string;
}

export interface ReportRunDelivery {
  version: 1;
  outcome: 'OK' | 'PARTIAL' | 'FAILED';
  channels: ReportRunDeliveryChannel[];
}

/** What `POST /reports/:id/run` answers with — a 202 and a run id. */
export interface StartedRun {
  runId: string;
  replayed: boolean;
}

/** What `GET /reports/:id/runs/:runId/download` answers with — a link, never
 * the bytes (confirmed against `reports.controller.ts` on 2026-09-03). */
export interface ReportDownload {
  url: string;
  filename: string;
  expiresInSeconds: number;
}
