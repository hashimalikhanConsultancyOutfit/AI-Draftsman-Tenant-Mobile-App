/**
 * Customers CSV import — RTK Query endpoints, ported from the web app's
 * `src/store/api/customerImport.api.ts` (confirmed against that source).
 * Four of the five calls live here; the fifth (upload) is deliberately
 * not an RTK Query endpoint — see `src/services/csvUpload.ts`.
 *
 * ── WHAT INVALIDATES THE CUSTOMER LIST ───────────────────────────────────
 * Not `apply` — it answers 202 (accepted, queued, nothing written yet), so
 * invalidating the registry there would refetch the same rows and leave
 * them stale for the whole import. The registry moves when the JOB reaches
 * `COMPLETED`, which only the poller can see — `customersChangedByImport()`
 * is dispatched from `useCustomerImport`'s settle effect, not from here.
 */
import { api } from '@/store/api';
import { newIdempotencyKey } from '@/utils/ids';

import type {
  ImportErrorPage,
  ImportErrorReportUrl,
  ImportJob,
  ImportJobAccepted,
  ImportJobListItem,
  ImportJobListWire,
  ListImportErrorsRequest,
} from './customerImport.types';

/** `/api/v1` lives on the base URL — see env.ts. */
const IMPORT_PATH = '/customers/import';

/** "The registry has actually changed" — invalidated by the poller on
 * `COMPLETED`, and also on a `FAILED` that wrote some rows before it
 * stopped (a partial import moved the registry too). */
export function customersChangedByImport() {
  return api.util.invalidateTags([{ type: 'Customer', id: 'LIST' }, 'CustomerStats']);
}

export const customerImportApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /** Step 2 — the one polling endpoint. The caller sets `pollingInterval`;
     * the cadence rule lives in customerImportRules.ts so the screen and
     * the hook cannot disagree about it. Nothing here re-derives
     * `canApply` — the response carries it. */
    getImportJob: builder.query<ImportJob, string>({
      query: (jobId) => ({ url: `${IMPORT_PATH}/${jobId}` }),
      providesTags: (_r, _e, jobId) => [{ type: 'CustomerImport', id: jobId }],
    }),

    /** Recent imports, newest first — exists for recovery: the job runs
     * server-side, so leaving the screen does not stop it, and this is
     * how it is found again. */
    listImportJobs: builder.query<ImportJobListItem[], number | void>({
      query: (limit) => ({ url: limit ? `${IMPORT_PATH}?limit=${String(limit)}` : IMPORT_PATH }),
      transformResponse: (wire: ImportJobListWire) => wire.items,
      providesTags: () => [{ type: 'CustomerImport', id: 'LIST' }],
    }),

    /** Validation errors, paginated and ordered by (row, field). The
     * polling response already carries the first ten; this carries the
     * rest — with 10,000 rows one bad column produces 10,000 errors. */
    listImportErrors: builder.query<ImportErrorPage, ListImportErrorsRequest>({
      query: ({ jobId, page = 1, pageSize = 50 }) => ({ url: `${IMPORT_PATH}/${jobId}/errors?page=${String(page)}&pageSize=${String(pageSize)}` }),
      providesTags: (_r, _e, { jobId }) => [{ type: 'CustomerImport', id: jobId }],
    }),

    /** A link to the full CSV report, including errors past the
     * collection cap. `keepUnusedDataFor: 0` because the link expires in
     * minutes — a cached one would hand back a dead URL with no sign
     * that is what happened. Used through its lazy hook so the link is
     * minted on press, not for every job that failed. */
    getImportErrorReport: builder.query<ImportErrorReportUrl, string>({
      query: (jobId) => ({ url: `${IMPORT_PATH}/${jobId}/errors/download` }),
      keepUnusedDataFor: 0,
    }),

    /** Step 3 — confirm, and start writing customers. Allowed only from
     * `READY_TO_IMPORT`; no force flag, no partial apply. Idempotent on
     * the server through a conditional status update, so a double-tap
     * answers 202 with the same body rather than importing twice — the
     * `Idempotency-Key` is belt to that braces, not what makes it safe.
     * Deliberately does NOT invalidate the customer list; see the file header. */
    applyImport: builder.mutation<ImportJobAccepted, string>({
      query: (jobId) => ({ url: `${IMPORT_PATH}/${jobId}/apply`, method: 'POST', headers: { 'Idempotency-Key': newIdempotencyKey() } }),
      invalidatesTags: (_r, _e, jobId) => [{ type: 'CustomerImport', id: jobId }, { type: 'CustomerImport', id: 'LIST' }],
    }),
  }),
});

export const { useGetImportJobQuery, useListImportJobsQuery, useListImportErrorsQuery, useLazyGetImportErrorReportQuery, useApplyImportMutation } = customerImportApi;
