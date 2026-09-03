/**
 * Lead criteria API — RTK Query endpoints, ported from the web app's
 * `src/store/api/leadCriteria.api.ts` (confirmed against that source and
 * `apps/gateway-b2b/src/app/lead-criteria/lead-criteria.controller.ts`).
 *
 * Pure CRUD — nothing here is read by a scorer or a lead search yet (see
 * the header on `leadCriteria.types.ts`). There is no
 * `GET /lead-criteria/:id/evaluation-criteria`: a set's rules travel on
 * its own detail read, and the three rule mutations below invalidate
 * that same row so the detail re-fetches with the new array.
 */
import { api } from '@/store/api';

import type {
  AddEvaluationCriterionRequest,
  CreateLeadCriteriaRequest,
  EvaluationCriterion,
  LeadCriteriaListParams,
  LeadCriteriaPage,
  LeadCriteriaSet,
  RemoveEvaluationCriterionRequest,
  UpdateEvaluationCriterionRequest,
  UpdateLeadCriteriaRequest,
} from './leadCriteria.types';

type QueryParams = Record<string, string | number | boolean | undefined>;

const definedParams = (params: QueryParams): QueryParams => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));

export const leadCriteriaApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getLeadCriteriaSets: builder.query<LeadCriteriaPage, LeadCriteriaListParams | void>({
      query: (params) => ({ url: '/lead-criteria', query: definedParams({ ...(params ?? {}) }) }),
      providesTags: (result) =>
        result
          ? [...result.items.map((set) => ({ type: 'LeadCriteria' as const, id: set.id })), { type: 'LeadCriteria' as const, id: 'LIST' }]
          : [{ type: 'LeadCriteria', id: 'LIST' }],
    }),

    getLeadCriteriaSet: builder.query<LeadCriteriaSet, string>({
      query: (id) => ({ url: `/lead-criteria/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'LeadCriteria', id }],
    }),

    createLeadCriteriaSet: builder.mutation<LeadCriteriaSet, CreateLeadCriteriaRequest>({
      query: (body) => ({ url: '/lead-criteria', method: 'POST', body }),
      invalidatesTags: () => [{ type: 'LeadCriteria', id: 'LIST' }],
    }),

    updateLeadCriteriaSet: builder.mutation<LeadCriteriaSet, UpdateLeadCriteriaRequest>({
      query: ({ id, ...body }) => ({ url: `/lead-criteria/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'LeadCriteria', id }, { type: 'LeadCriteria', id: 'LIST' }],
    }),

    deleteLeadCriteriaSet: builder.mutation<{ id: string; deleted: true }, string>({
      query: (id) => ({ url: `/lead-criteria/${id}`, method: 'DELETE' }),
      invalidatesTags: () => [{ type: 'LeadCriteria', id: 'LIST' }],
    }),

    /* --- Evaluation criteria (the set's weighted rules) ------------------- */

    /** 400 past 50 rules — surfaced verbatim to the user. */
    addEvaluationCriterion: builder.mutation<EvaluationCriterion, AddEvaluationCriterionRequest>({
      query: ({ leadCriteriaId, ...body }) => ({ url: `/lead-criteria/${leadCriteriaId}/evaluation-criteria`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { leadCriteriaId }) => [{ type: 'LeadEvaluationCriterion', id: leadCriteriaId }, { type: 'LeadCriteria', id: leadCriteriaId }],
    }),

    updateEvaluationCriterion: builder.mutation<EvaluationCriterion, UpdateEvaluationCriterionRequest>({
      query: ({ leadCriteriaId, criterionId, ...body }) => ({ url: `/lead-criteria/${leadCriteriaId}/evaluation-criteria/${criterionId}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { leadCriteriaId }) => [{ type: 'LeadEvaluationCriterion', id: leadCriteriaId }, { type: 'LeadCriteria', id: leadCriteriaId }],
    }),

    /** Immediate, no confirm on this call — a rule is re-addable in seconds. */
    removeEvaluationCriterion: builder.mutation<{ id: string; removed: true }, RemoveEvaluationCriterionRequest>({
      query: ({ leadCriteriaId, criterionId }) => ({ url: `/lead-criteria/${leadCriteriaId}/evaluation-criteria/${criterionId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { leadCriteriaId }) => [{ type: 'LeadEvaluationCriterion', id: leadCriteriaId }, { type: 'LeadCriteria', id: leadCriteriaId }],
    }),
  }),
});

export const {
  useGetLeadCriteriaSetsQuery,
  useGetLeadCriteriaSetQuery,
  useCreateLeadCriteriaSetMutation,
  useUpdateLeadCriteriaSetMutation,
  useDeleteLeadCriteriaSetMutation,
  useAddEvaluationCriterionMutation,
  useUpdateEvaluationCriterionMutation,
  useRemoveEvaluationCriterionMutation,
} = leadCriteriaApi;
