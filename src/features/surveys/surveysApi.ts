/**
 * Surveys API — RTK Query endpoints, ported from the web app's
 * `src/store/api/surveys.api.ts` and confirmed against the live gateway on
 * 2026-10-15.
 *
 * Surveys have NO delete route — a survey leaves circulation by being
 * ARCHIVED (a status change through `updateSurvey`).
 *
 * Lists here are CURSOR-paged (`?cursor&limit` → `{items, nextCursor,
 * hasMore}`); every screen that pages them uses "Load more" and keeps the
 * rows it already holds, so the cursor queries keep one cache entry per
 * cursor and the screen concatenates.
 */
import { api } from '@/store/api';
import type { ApiQueryError } from '@/store/baseQuery';

import type {
  CreateSurveyRequest,
  CursorPage,
  ReviewSurveyResponseRequest,
  SendSurveyNowResult,
  SetSurveyScheduleRequest,
  Survey,
  SurveyAudiencePreview,
  SurveyAudienceRuleType,
  SurveyChatHistoryMessage,
  SurveyDashboard,
  SurveyEvaluation,
  SurveyField,
  SurveyMapResponse,
  SurveyResponse,
  SurveyRun,
  SurveySchedule,
  SurveyStatus,
  SurveyVersion,
  UpdateSurveyRequest,
  WorkspaceMember,
} from './surveys.types';

/** Rows per page — web's `SURVEYS_PAGE_SIZE`/`RESPONSES_PAGE_SIZE`. */
export const SURVEYS_PAGE_SIZE = 20;

export interface SurveyListParams {
  status?: SurveyStatus;
  cursor?: string;
}

const cursorQuery = (params: { status?: string; cursor?: string }) => {
  const query: Record<string, string | number> = { limit: SURVEYS_PAGE_SIZE };
  if (params.status) query.status = params.status;
  if (params.cursor) query.cursor = params.cursor;
  return query;
};

const page = <T>(wire: Partial<CursorPage<T>> | undefined): CursorPage<T> => ({
  items: wire?.items ?? [],
  nextCursor: wire?.nextCursor ?? null,
  hasMore: Boolean(wire?.hasMore && wire?.nextCursor),
});

export const surveysApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSurveys: builder.query<CursorPage<Survey>, SurveyListParams>({
      query: (params) => ({ url: '/surveys', query: cursorQuery(params) }),
      transformResponse: page<Survey>,
      providesTags: (result) => [
        ...(result?.items ?? []).map((s) => ({ type: 'Survey' as const, id: s.id })),
        { type: 'Survey' as const, id: 'LIST' },
      ],
    }),

    /** Carries `versions` (newest last is NOT guaranteed — readers pick by
     * `currentVersionId`) and `audienceRule`. */
    getSurvey: builder.query<Survey, string>({
      query: (id) => ({ url: `/surveys/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'Survey', id }],
    }),

    /** Currently answers 500 on the live gateway — the screen shows its
     * error state, as web does. */
    getSurveyMap: builder.query<SurveyMapResponse, void>({
      query: () => ({ url: '/surveys/map' }),
      providesTags: [{ type: 'Survey', id: 'LIST' }],
    }),

    createSurvey: builder.mutation<Survey, CreateSurveyRequest>({
      query: (body) => ({ url: '/surveys', method: 'POST', body }),
      invalidatesTags: [{ type: 'Survey', id: 'LIST' }],
    }),

    /** Only the CHANGED fields are sent — see `surveyDetailsPatch`. */
    updateSurvey: builder.mutation<Survey, UpdateSurveyRequest>({
      query: ({ id, ...body }) => ({ url: `/surveys/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Survey', id }, { type: 'Survey', id: 'LIST' }],
    }),

    /** Saving the form captures a NEW version; earlier responses keep
     * pointing at the version they answered. */
    createSurveyVersion: builder.mutation<SurveyVersion, { id: string; schema: SurveyField[] }>({
      query: ({ id, schema }) => ({ url: `/surveys/${id}/versions`, method: 'POST', body: { schema } }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Survey', id }],
    }),

    /* --- Audience -------------------------------------------------------- */

    setSurveyAudience: builder.mutation<
      unknown,
      { id: string; ruleType: SurveyAudienceRuleType; criteria?: Record<string, unknown> }
    >({
      query: ({ id, ...body }) => ({ url: `/surveys/${id}/audience`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Survey', id }, { type: 'SurveyAudience', id }],
    }),

    /** The send-now confirmation's eligible/skipped counts — resolved
     * against the SAVED rule, fresh on every open. */
    getSurveyAudiencePreview: builder.query<SurveyAudiencePreview, string>({
      query: (id) => ({ url: `/surveys/${id}/audience/preview` }),
      providesTags: (_r, _e, id) => [{ type: 'SurveyAudience', id }],
      keepUnusedDataFor: 0,
    }),

    sendSurveyNow: builder.mutation<SendSurveyNowResult, string>({
      query: (id) => ({ url: `/surveys/${id}/send-now`, method: 'POST' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'SurveyDashboard', id },
        { type: 'SurveyRun', id },
        { type: 'SurveyAudience', id },
      ],
    }),

    /** The workspace's members, for the "Specific tenant users" picker. */
    getWorkspaceMembers: builder.query<WorkspaceMember[], void>({
      query: () => ({ url: '/onboarding/invites' }),
      transformResponse: (wire: WorkspaceMember[] | { items?: WorkspaceMember[] }) =>
        (Array.isArray(wire) ? wire : (wire?.items ?? [])).filter((m) => Boolean(m?.userId)),
      providesTags: [{ type: 'WorkspaceMember', id: 'LIST' }],
    }),

    /* --- Schedule & runs ------------------------------------------------- */

    /** A survey with no schedule answers 404 — read as `null`, not an error. */
    getSurveySchedule: builder.query<SurveySchedule | null, string>({
      async queryFn(id, _api, _extra, baseQuery) {
        const result = await baseQuery({ url: `/surveys/${id}/schedule` });
        if (result.error) {
          const err = result.error as ApiQueryError;
          if (err && 'status' in err && err.status === 404) return { data: null };
          return { error: result.error };
        }
        return { data: (result.data as SurveySchedule | null) ?? null };
      },
      providesTags: (_r, _e, id) => [{ type: 'SurveySchedule', id }],
    }),

    /** Replaces any existing schedule outright — one per survey. */
    setSurveySchedule: builder.mutation<SurveySchedule, SetSurveyScheduleRequest>({
      query: ({ id, ...body }) => ({ url: `/surveys/${id}/schedule`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'SurveySchedule', id }, { type: 'SurveyDashboard', id }],
    }),

    getSurveyRuns: builder.query<CursorPage<SurveyRun>, { id: string; cursor?: string }>({
      query: ({ id, cursor }) => ({ url: `/surveys/${id}/runs`, query: cursorQuery({ cursor }) }),
      transformResponse: page<SurveyRun>,
      providesTags: (_r, _e, { id }) => [{ type: 'SurveyRun', id }],
    }),

    getSurveyDashboard: builder.query<SurveyDashboard, string>({
      query: (id) => ({ url: `/surveys/${id}/dashboard` }),
      providesTags: (_r, _e, id) => [{ type: 'SurveyDashboard', id }],
    }),

    /* --- Responses ------------------------------------------------------- */

    getSurveyResponses: builder.query<CursorPage<SurveyResponse>, { id: string; cursor?: string }>({
      query: ({ id, cursor }) => ({ url: `/surveys/${id}/responses`, query: cursorQuery({ cursor }) }),
      transformResponse: page<SurveyResponse>,
      providesTags: (_r, _e, { id }) => [{ type: 'SurveyResponse', id }],
    }),

    reviewSurveyResponse: builder.mutation<unknown, ReviewSurveyResponseRequest>({
      query: ({ surveyId, responseId, ...body }) => ({
        url: `/surveys/${surveyId}/responses/${responseId}/review`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { surveyId }) => [
        { type: 'SurveyResponse', id: surveyId },
        { type: 'SurveyDashboard', id: surveyId },
      ],
    }),

    /** Polled every 4s by the response sheet until DONE or FAILED. */
    getSurveyResponseEvaluation: builder.query<SurveyEvaluation | null, { surveyId: string; responseId: string }>({
      query: ({ surveyId, responseId }) => ({ url: `/surveys/${surveyId}/responses/${responseId}/evaluation` }),
      keepUnusedDataFor: 0,
    }),

    /* --- AI drafting ----------------------------------------------------- */

    /** The persisted "Generate with AI" conversation, oldest first. */
    getSurveyDraftChatHistory: builder.query<SurveyChatHistoryMessage[], string>({
      query: (id) => ({ url: `/surveys/${id}/draft-chat` }),
      transformResponse: (wire: { messages?: SurveyChatHistoryMessage[] } | undefined) => wire?.messages ?? [],
      keepUnusedDataFor: 0,
    }),

    /** Multipart — field `file`. Returns the stable blob URL the next
     * `draft:send` references. */
    uploadSurveyDraftAttachment: builder.mutation<{ blobUrl: string; filename?: string }, { id: string; form: FormData }>({
      query: ({ id, form }) => ({ url: `/surveys/${id}/draft-chat/attachments`, method: 'POST', body: form }),
    }),
  }),
});

export const {
  useGetSurveysQuery,
  useGetSurveyQuery,
  useGetSurveyMapQuery,
  useCreateSurveyMutation,
  useUpdateSurveyMutation,
  useCreateSurveyVersionMutation,
  useSetSurveyAudienceMutation,
  useLazyGetSurveyAudiencePreviewQuery,
  useSendSurveyNowMutation,
  useGetWorkspaceMembersQuery,
  useGetSurveyScheduleQuery,
  useSetSurveyScheduleMutation,
  useGetSurveyRunsQuery,
  useGetSurveyDashboardQuery,
  useGetSurveyResponsesQuery,
  useReviewSurveyResponseMutation,
  useGetSurveyResponseEvaluationQuery,
  useLazyGetSurveyDraftChatHistoryQuery,
  useUploadSurveyDraftAttachmentMutation,
} = surveysApi;
