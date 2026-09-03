/**
 * Reports — RTK Query endpoints, injected into the shared `api` slice.
 * Mirrors the web app's `src/store/api/reports.api.ts` exactly: same URLs,
 * same request/response shapes (confirmed against that source, and against
 * `apps/gateway-b2b/src/app/reports/reports.controller.ts`, on 2026-09-03).
 */

import { api } from '@/store/api';

import type {
  Report,
  ReportDownload,
  ReportListParams,
  ReportPage,
  ReportRunPage,
  ReportWriteBody,
  RunListParams,
  StartedRun,
  UpdateReportBody,
} from './reports.types';

function listQuery(params: ReportListParams) {
  const query: Record<string, number> = {};
  if (params.page !== undefined) query.page = params.page;
  if (params.limit !== undefined) query.limit = params.limit;
  return query;
}

function runsQuery(params: Omit<RunListParams, 'id'>) {
  const query: Record<string, number> = {};
  if (params.page !== undefined) query.page = params.page;
  if (params.limit !== undefined) query.limit = params.limit;
  return query;
}

export const reportsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getReports: builder.query<ReportPage, ReportListParams | void>({
      query: (params) => ({ url: '/reports', query: listQuery(params ?? {}) }),
      providesTags: (result) => [
        ...(result?.items ?? []).map((r) => ({ type: 'Report' as const, id: r.id })),
        { type: 'Report' as const, id: 'LIST' },
      ],
    }),

    /** A single report, by id — used to seed the edit form: the registry's
     * own list is paginated, so a report opened for edit is not guaranteed
     * to still be in that query's cache once its screen has unmounted. */
    getReport: builder.query<Report, string>({
      query: (id) => ({ url: `/reports/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'Report', id }],
    }),

    createReport: builder.mutation<Report, ReportWriteBody>({
      query: (body) => ({ url: '/reports', method: 'POST', body }),
      invalidatesTags: [{ type: 'Report', id: 'LIST' }],
    }),

    updateReport: builder.mutation<Report, UpdateReportBody>({
      query: ({ id, ...body }) => ({ url: `/reports/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Report', id }, { type: 'Report', id: 'LIST' }],
    }),

    deleteReport: builder.mutation<{ id: string }, string>({
      query: (id) => ({ url: `/reports/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Report', id: 'LIST' }],
    }),

    /** Starts a run and answers 202 with its id — does not wait for it to
     * finish. Also invalidates the run log: a manual run adds a RUNNING row
     * to it immediately, and the log would otherwise show yesterday's
     * history until the screen remounts. */
    runReportNow: builder.mutation<StartedRun, string>({
      query: (id) => ({ url: `/reports/${id}/run`, method: 'POST' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Report', id }, { type: 'Report', id: `runs-${id}` }],
    }),

    /** Run history — its own cache entry per report, keyed on the report id
     * alone (not the page), so a manual run's invalidation reaches whichever
     * page of the log is on screen. */
    getReportRuns: builder.query<ReportRunPage, RunListParams>({
      query: ({ id, ...params }) => ({ url: `/reports/${id}/runs`, query: runsQuery(params) }),
      providesTags: (_r, _e, { id }) => [{ type: 'Report', id: `runs-${id}` }],
    }),

    /**
     * A signed, short-lived download link — NOT cached (the URL expires in
     * minutes, so a cached one would hand out a link that has already
     * died). Modelled as a mutation for exactly that reason, same pattern as
     * Leads' `getLeadAttachmentUrl`.
     */
    getReportRunDownloadUrl: builder.mutation<ReportDownload, { reportId: string; runId: string }>({
      query: ({ reportId, runId }) => ({ url: `/reports/${reportId}/runs/${runId}/download` }),
    }),
  }),
});

export const {
  useGetReportsQuery,
  useGetReportQuery,
  useCreateReportMutation,
  useUpdateReportMutation,
  useDeleteReportMutation,
  useRunReportNowMutation,
  useGetReportRunsQuery,
  useGetReportRunDownloadUrlMutation,
} = reportsApi;
