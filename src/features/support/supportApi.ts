/**
 * Support — RTK Query endpoints, injected into the shared `api` slice.
 * Mirrors gateway-b2b's real routes exactly (confirmed against
 * `apps/gateway-b2b/src/app/support/{support.controller.ts,dto/
 * support.dto.ts}` — read in full — and web's own `src/store/api/
 * support.api.ts`, 2026-09-04).
 *
 * Two routes are declared as MUTATIONS despite being `GET`s:
 *  - `getSupportAttachmentUrl` — the link is minted fresh each call and
 *    is deliberately never cached (a cached copy would go stale the
 *    moment the storage-side signature expires), matching web's own
 *    choice to fetch it imperatively rather than through a query hook.
 *  - Ticket create/reply use `FormData` — this app's second and third
 *    multipart writes after Branding's logo upload; see the note in
 *    `httpClient.ts` for the `FormData`-body detection that makes this
 *    work without special-casing each call site.
 */

import { api } from '@/store/api';

import type {
  AddSupportTicketNoteRequest,
  CreateSupportTicketRequest,
  EscalateSupportTicketRequest,
  PickedFile,
  ReplyToSupportTicketRequest,
  SupportAttachment,
  SupportAttachmentUrl,
  SupportDeleteResult,
  SupportDraft,
  SupportDraftCancelResult,
  SupportEscalationResult,
  SupportNoteResult,
  SupportReplyResult,
  SupportSlaPolicy,
  SupportSummary,
  SupportTicket,
  SupportTicketDetail,
  SupportTicketList,
  SupportTicketListQuery,
  UpdateSupportSlaPolicyRequest,
  UpdateSupportTicketRequest,
} from './support.types';

function appendPickedFile(form: FormData, field: string, file: PickedFile): void {
  form.append(field, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
}

function buildTicketFormData(req: CreateSupportTicketRequest): FormData {
  const form = new FormData();
  form.append('subject', req.subject);
  if (req.body) form.append('body', req.body);
  /* Omitted for NORMAL — the server applies NORMAL either way, and a
   * request that names the default is a second place it has to be kept
   * in step. */
  if (req.priority && req.priority !== 'NORMAL') form.append('priority', req.priority);
  if (req.customerId) form.append('customerId', req.customerId);
  if (req.assigneeId) form.append('assigneeId', req.assigneeId);
  if (req.escalate) form.append('escalate', 'true');
  (req.files ?? []).forEach((file) => appendPickedFile(form, 'files', file));
  return form;
}

function buildReplyFormData(req: Omit<ReplyToSupportTicketRequest, 'id'>): FormData {
  const form = new FormData();
  if (req.body) form.append('body', req.body);
  (req.files ?? []).forEach((file) => appendPickedFile(form, 'files', file));
  /* `setState` is never sent — see the note on `ReplyToSupportTicketRequest`. */
  return form;
}

export const supportApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /** The four inbox tiles. Cached 60s server-side, so this refetches
     * cheaply on focus/poll without hammering anything. */
    getSupportSummary: builder.query<SupportSummary, void>({
      query: () => ({ url: '/support/tickets/summary' }),
      providesTags: [{ type: 'SupportSummary', id: 'SUMMARY' }],
    }),

    getSupportTickets: builder.query<SupportTicketList, SupportTicketListQuery | void>({
      query: (params) => {
        const { page, limit, search, state } = params ?? {};
        return {
          url: '/support/tickets',
          query: {
            ...(page === undefined ? {} : { page }),
            limit: limit ?? 10,
            ...(search ? { search } : {}),
            ...(state ? { state } : {}),
          },
        };
      },
      providesTags: (result) => [...(result?.items ?? []).map((t) => ({ type: 'SupportTicket' as const, id: t.id })), { type: 'SupportTicket' as const, id: 'LIST' }],
    }),

    getSupportTicket: builder.query<SupportTicketDetail, string>({
      query: (id) => ({ url: `/support/tickets/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'SupportTicket', id }],
    }),

    /**
     * Multipart — the ticket and its files are written in one
     * transaction, so a refused file fails the whole request rather than
     * raising the ticket with the rest.
     */
    createSupportTicket: builder.mutation<SupportTicket, CreateSupportTicketRequest>({
      query: (req) => ({ url: '/support/tickets', method: 'POST', body: buildTicketFormData(req) }),
      invalidatesTags: [{ type: 'SupportTicket', id: 'LIST' }, { type: 'SupportSummary', id: 'SUMMARY' }],
    }),

    /**
     * `state` here is never `'WITH_PLATFORM'` — that is a 400 the server
     * itself refuses; escalation goes through `escalateSupportTicket`
     * instead. `expectedUpdatedAt` is optional but should be sent on
     * every real edit — see `UpdateSupportTicketRequest`.
     */
    updateSupportTicket: builder.mutation<SupportTicket, UpdateSupportTicketRequest>({
      query: ({ id, ...body }) => ({ url: `/support/tickets/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'SupportTicket', id }, { type: 'SupportTicket', id: 'LIST' }, { type: 'SupportSummary', id: 'SUMMARY' }],
    }),

    /** Multipart. `setState` is deliberately never sent — see
     * `ReplyToSupportTicketRequest`'s doc comment. */
    replyToSupportTicket: builder.mutation<SupportReplyResult, ReplyToSupportTicketRequest>({
      query: ({ id, ...req }) => ({ url: `/support/tickets/${id}/replies`, method: 'POST', body: buildReplyFormData(req) }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'SupportTicket', id }, { type: 'SupportTicket', id: 'LIST' }, { type: 'SupportSummary', id: 'SUMMARY' }],
    }),

    /** Gated on `support.update`, not `support.reply` — a note is never
     * customer-facing. Answers with the whole refreshed thread. */
    addSupportTicketNote: builder.mutation<SupportNoteResult, AddSupportTicketNoteRequest>({
      query: ({ id, body }) => ({ url: `/support/tickets/${id}/notes`, method: 'POST', body: { body } }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'SupportTicket', id }],
    }),

    /** 422 if `reason` would carry customer identity — shown as-is via
     * `getErrorMessage`. */
    escalateSupportTicket: builder.mutation<SupportEscalationResult, EscalateSupportTicketRequest>({
      query: ({ id, reason }) => ({ url: `/support/tickets/${id}/escalate`, method: 'POST', body: reason ? { reason } : {} }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'SupportTicket', id }, { type: 'SupportTicket', id: 'LIST' }, { type: 'SupportSummary', id: 'SUMMARY' }],
    }),

    /** `null` for everything but a live PENDING/HELD draft — see
     * `SupportDraft`'s doc comment for why SENT/CANCELLED/FAILED never
     * reach here. Polled every 20s by the ticket screen while open. */
    getSupportDraft: builder.query<SupportDraft | null, string>({
      query: (ticketId) => ({ url: `/support/tickets/${ticketId}/draft` }),
      providesTags: (_r, _e, ticketId) => [{ type: 'SupportDraft', id: ticketId }],
    }),

    /**
     * Deliberately reachable on `support.view` alone — see the doc
     * comment on `SupportDraft`: nobody spent a write grant to trigger
     * an automatic reply, so requiring one to halt it would be
     * asymmetric in the direction that lets an email go out that
     * whoever is looking at it was not allowed to stop.
     */
    cancelSupportDraft: builder.mutation<SupportDraftCancelResult, { ticketId: string; draftId: string }>({
      query: ({ ticketId, draftId }) => ({ url: `/support/tickets/${ticketId}/draft/${draftId}/cancel`, method: 'POST' }),
      invalidatesTags: (_r, _e, { ticketId }) => [{ type: 'SupportDraft', id: ticketId }],
    }),

    /** Idempotent, `support.view`-gated, fire-and-forget from the
     * ticket screen the moment it opens — clears `unread` for the whole
     * desk, not just this viewer. */
    markSupportTicketViewed: builder.mutation<void, string>({
      query: (id) => ({ url: `/support/tickets/${id}/viewed`, method: 'POST' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'SupportTicket', id }, { type: 'SupportTicket', id: 'LIST' }],
    }),

    /** Soft delete — the thread is removed from the inbox; anything
     * already sent to the customer stays sent. */
    deleteSupportTicket: builder.mutation<SupportDeleteResult, string>({
      query: (id) => ({ url: `/support/tickets/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'SupportTicket', id: 'LIST' }, { type: 'SupportSummary', id: 'SUMMARY' }],
    }),

    /** Only a bare `*` full-access role holds `support.sla.manage` today
     * — see `slugs.ts`; the screen gates on `useHasFullAccess()` rather
     * than a dedicated slug. */
    getSupportSlaPolicy: builder.query<SupportSlaPolicy, void>({
      query: () => ({ url: '/support/sla-policy' }),
      providesTags: [{ type: 'SupportSlaPolicy', id: 'POLICY' }],
    }),

    /** A PUT, not a PATCH — every field, always. See
     * `UpdateSupportSlaPolicyRequest`'s doc comment for why. */
    updateSupportSlaPolicy: builder.mutation<SupportSlaPolicy, UpdateSupportSlaPolicyRequest>({
      query: (body) => ({ url: '/support/sla-policy', method: 'PUT', body }),
      invalidatesTags: [{ type: 'SupportSlaPolicy', id: 'POLICY' }, { type: 'SupportSummary', id: 'SUMMARY' }],
    }),

    /** One file, added to a ticket that already exists — the detail
     * screen's own attachment control (distinct from the files chosen
     * inline while raising or replying). */
    uploadSupportAttachment: builder.mutation<SupportAttachment, { ticketId: string; file: PickedFile }>({
      query: ({ ticketId, file }) => {
        const form = new FormData();
        appendPickedFile(form, 'file', file);
        return { url: `/support/tickets/${ticketId}/attachments`, method: 'POST', body: form };
      },
      invalidatesTags: (_r, _e, { ticketId }) => [{ type: 'SupportTicket', id: ticketId }],
    }),

    /** Never cached — see this file's top doc comment. A link good for
     * a few minutes, minted fresh on every call. */
    getSupportAttachmentUrl: builder.mutation<SupportAttachmentUrl, { ticketId: string; attachmentId: string }>({
      query: ({ ticketId, attachmentId }) => ({ url: `/support/tickets/${ticketId}/attachments/${attachmentId}/url` }),
    }),

    removeSupportAttachment: builder.mutation<void, { ticketId: string; attachmentId: string }>({
      query: ({ ticketId, attachmentId }) => ({ url: `/support/tickets/${ticketId}/attachments/${attachmentId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { ticketId }) => [{ type: 'SupportTicket', id: ticketId }],
    }),
  }),
});

export const {
  useGetSupportSummaryQuery,
  useGetSupportTicketsQuery,
  useGetSupportTicketQuery,
  useCreateSupportTicketMutation,
  useUpdateSupportTicketMutation,
  useReplyToSupportTicketMutation,
  useAddSupportTicketNoteMutation,
  useEscalateSupportTicketMutation,
  useGetSupportDraftQuery,
  useCancelSupportDraftMutation,
  useMarkSupportTicketViewedMutation,
  useDeleteSupportTicketMutation,
  useGetSupportSlaPolicyQuery,
  useUpdateSupportSlaPolicyMutation,
  useUploadSupportAttachmentMutation,
  useGetSupportAttachmentUrlMutation,
  useRemoveSupportAttachmentMutation,
} = supportApi;
