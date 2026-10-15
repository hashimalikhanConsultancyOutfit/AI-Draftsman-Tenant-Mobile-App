/**
 * My Surveys — the respondent's side, ported from web's
 * `store/api/mySurveys.api.ts`. A separate controller from the manager's
 * `/surveys` (guarded by sign-in only; the server scopes every read to the
 * caller), so it never shares cache tags with the manager screens.
 */
import { api } from '@/store/api';

import type { CursorPage, MySurveyAssignment, MySurveyMapResponse, SurveyAnswer } from './surveys.types';

/** Web's `MY_SURVEY_PAGE_LIMIT`. */
export const MY_SURVEYS_PAGE_SIZE = 20;

export const mySurveysApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getMySurveys: builder.query<CursorPage<MySurveyAssignment>, { cursor?: string }>({
      query: ({ cursor }) => ({ url: '/my/surveys', query: { limit: MY_SURVEYS_PAGE_SIZE, ...(cursor ? { cursor } : {}) } }),
      transformResponse: (wire: Partial<CursorPage<MySurveyAssignment>> | undefined) => ({
        items: wire?.items ?? [],
        nextCursor: wire?.nextCursor ?? null,
        hasMore: Boolean(wire?.hasMore && wire?.nextCursor),
      }),
      providesTags: (result) => [
        ...(result?.items ?? []).map((a) => ({ type: 'MySurvey' as const, id: a.id })),
        { type: 'MySurvey' as const, id: 'LIST' },
      ],
    }),

    getMySurveyMap: builder.query<MySurveyMapResponse, void>({
      query: () => ({ url: '/my/surveys/map' }),
      providesTags: [{ type: 'MySurvey', id: 'LIST' }],
    }),

    getMySurvey: builder.query<MySurveyAssignment, string>({
      query: (id) => ({ url: `/my/surveys/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'MySurvey', id }],
    }),

    /** PENDING → SEEN, sent once when a new assignment is first opened. */
    markMySurveySeen: builder.mutation<MySurveyAssignment, string>({
      query: (id) => ({ url: `/my/surveys/${id}`, method: 'PATCH' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'MySurvey', id }, { type: 'MySurvey', id: 'LIST' }],
    }),

    submitMySurveyResponse: builder.mutation<unknown, { assignmentId: string; answers: SurveyAnswer[] }>({
      query: ({ assignmentId, answers }) => ({ url: `/my/surveys/${assignmentId}/responses`, method: 'POST', body: { answers } }),
      invalidatesTags: (_r, _e, { assignmentId }) => [{ type: 'MySurvey', id: assignmentId }, { type: 'MySurvey', id: 'LIST' }],
    }),
  }),
});

export const { useGetMySurveysQuery, useGetMySurveyMapQuery, useGetMySurveyQuery, useMarkMySurveySeenMutation, useSubmitMySurveyResponseMutation } = mySurveysApi;
