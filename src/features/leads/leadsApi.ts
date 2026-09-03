/**
 * Leads API — RTK Query endpoints, ported from the web app's
 * `src/store/api/leads.api.ts` (confirmed against that source and against
 * `apps/gateway-b2b/src/app/leads/leads.controller.ts` on the backend).
 * Injected into the shared `api` slice, same convention as Customers/Chat.
 *
 * The wire response already matches this app's `Lead` shape field for
 * field (see the mapper's `toLeadResponse` on the gateway) — `stage` and
 * `leadType` arrive pre-humanised ("New", "Manual"), so no `toX` mapping
 * layer is needed the way Customers' cents-to-pounds conversion needs one.
 */
import { api } from '@/store/api';

import type {
  CreateLeadInput,
  Lead,
  LeadAttachment,
  LeadScoringAccepted,
  LeadStats,
  MoveLeadStageRequest,
  UpdateLeadInput,
} from './leads.types';

function listQuery(params: { skip?: number; take?: number }) {
  const query: Record<string, number> = {};
  if (params.skip !== undefined) query.skip = params.skip;
  if (params.take !== undefined) query.take = params.take;
  return query;
}

export const leadsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getLeads: builder.query<Lead[], { skip?: number; take?: number } | void>({
      query: (params) => ({ url: '/leads', query: listQuery(params ?? {}) }),
      providesTags: (result) => [
        ...(result ?? []).map((lead) => ({ type: 'Lead' as const, id: lead.id })),
        { type: 'Lead' as const, id: 'LIST' },
      ],
    }),

    getLead: builder.query<Lead, string>({
      query: (id) => ({ url: `/leads/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'Lead', id }],
    }),

    /** Server-aggregated board counts — never derived from a page of the list. */
    getLeadStats: builder.query<LeadStats, void>({
      query: () => ({ url: '/leads/stats' }),
      providesTags: () => [{ type: 'Lead', id: 'LIST' }],
    }),

    createLead: builder.mutation<Lead, CreateLeadInput>({
      query: (body) => ({ url: '/leads', method: 'POST', body }),
      invalidatesTags: () => [{ type: 'Lead', id: 'LIST' }],
    }),

    updateLead: builder.mutation<Lead, UpdateLeadInput>({
      query: ({ id, ...body }) => ({ url: `/leads/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Lead', id }, { type: 'Lead', id: 'LIST' }],
    }),

    deleteLead: builder.mutation<{ id: string; name: string }, string>({
      query: (id) => ({ url: `/leads/${id}`, method: 'DELETE' }),
      invalidatesTags: () => [{ type: 'Lead', id: 'LIST' }],
    }),

    /** The card's forward/back arrows send `direction`; naming a `stage`
     * directly is the alternative shape the same route accepts. Exactly
     * one — never both. */
    moveLeadStage: builder.mutation<Lead, MoveLeadStageRequest>({
      query: ({ id, ...body }) => ({ url: `/leads/${id}/stage`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Lead', id }, { type: 'Lead', id: 'LIST' }],
    }),

    /**
     * Fire-and-forget: `202 { accepted: true }`. Nothing is invalidated —
     * the board is unchanged at the moment this answers. The refresh
     * belongs to the `lead:evaluation-completed` socket frame instead
     * (see `useLeads.ts`'s listener), which fires once ML has actually
     * written something.
     */
    runLeadScoring: builder.mutation<LeadScoringAccepted, void>({
      query: () => ({ url: '/leads/score', method: 'POST' }),
    }),

    /* --- Attachments ------------------------------------------------------ */

    getLeadAttachments: builder.query<LeadAttachment[], string>({
      query: (leadId) => ({ url: `/leads/${leadId}/attachments` }),
      providesTags: (_r, _e, leadId) => [{ type: 'LeadAttachment', id: leadId }],
    }),

    /** One request for the whole batch, `FormData`, no explicit
     * Content-Type — httpClient must leave FormData alone so the runtime
     * sets its own multipart boundary. */
    addLeadAttachments: builder.mutation<LeadAttachment[], { leadId: string; files: Array<{ uri: string; name: string; type: string }> }>({
      query: ({ leadId, files }) => {
        const body = new FormData();
        files.forEach((file) => {
          // React Native's FormData file shape — {uri, name, type} — not a
          // web File object.
          body.append('files', file as unknown as Blob);
        });
        return { url: `/leads/${leadId}/attachments`, method: 'POST', body };
      },
      invalidatesTags: (_r, _e, { leadId }) => [{ type: 'LeadAttachment', id: leadId }],
    }),

    /** Mints a short-lived link (minutes) — never cached beyond the
     * moment of use, same contract as the chat attachment tile. */
    getLeadAttachmentUrl: builder.mutation<{ url: string }, { leadId: string; attachmentId: string }>({
      query: ({ leadId, attachmentId }) => ({ url: `/leads/${leadId}/attachments/${attachmentId}/url` }),
    }),

    deleteLeadAttachment: builder.mutation<{ removed: boolean; fileName: string }, { leadId: string; attachmentId: string }>({
      query: ({ leadId, attachmentId }) => ({ url: `/leads/${leadId}/attachments/${attachmentId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { leadId }) => [{ type: 'LeadAttachment', id: leadId }],
    }),
  }),
});

export const {
  useGetLeadsQuery,
  useGetLeadQuery,
  useGetLeadStatsQuery,
  useCreateLeadMutation,
  useUpdateLeadMutation,
  useDeleteLeadMutation,
  useMoveLeadStageMutation,
  useRunLeadScoringMutation,
  useGetLeadAttachmentsQuery,
  useAddLeadAttachmentsMutation,
  useGetLeadAttachmentUrlMutation,
  useDeleteLeadAttachmentMutation,
} = leadsApi;
