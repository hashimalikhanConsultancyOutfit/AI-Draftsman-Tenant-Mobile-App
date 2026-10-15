/**
 * Team-run endpoints read by a team chat thread — ported from the web app's
 * `src/store/api/agentTeamRuns.api.ts`. Kept inside the Chat feature
 * rather than Agents Teams because a run only exists inside a thread.
 */
import { api } from '@/store/api';
import { newIdempotencyKey } from '@/utils/ids';

import type { ResolutionAction, TeamInteraction, TeamRunDetail, TeamRunEventPage, TeamRunPage } from './teamRun.types';

/** Enough runs for the details screen's "Runs in this thread" list. */
export const THREAD_RUNS_LIMIT = 20;
/** The live band reads the whole log of one run in one page. */
export const RUN_EVENTS_LIMIT = 200;

export const teamRunApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /** Newest first — `items[0]` is the run answering the latest question. */
    getThreadTeamRuns: builder.query<TeamRunPage, { conversationId: string; limit?: number }>({
      query: ({ conversationId, limit = THREAD_RUNS_LIMIT }) => ({ url: '/agent-team-runs', query: { conversationId, limit } }),
      providesTags: (_r, _e, { conversationId }) => [{ type: 'AgentTeamRun', id: `THREAD:${conversationId}` }],
    }),

    getTeamRun: builder.query<TeamRunDetail, string>({
      query: (runId) => ({ url: `/agent-team-runs/${runId}` }),
      providesTags: (_r, _e, runId) => [{ type: 'AgentTeamRun', id: runId }],
    }),

    getTeamRunEvents: builder.query<TeamRunEventPage, string>({
      query: (runId) => ({ url: `/agent-team-runs/${runId}/events`, query: { limit: RUN_EVENTS_LIMIT } }),
      providesTags: (_r, _e, runId) => [{ type: 'AgentTeamRun', id: `EVENTS:${runId}` }],
    }),

    getTeamRunInteractions: builder.query<TeamInteraction[], string>({
      query: (runId) => ({ url: `/agent-team-runs/${runId}/interactions` }),
      providesTags: (_r, _e, runId) => [{ type: 'AgentTeamRun', id: `INTERACTIONS:${runId}` }],
    }),

    cancelTeamRun: builder.mutation<unknown, { runId: string; conversationId: string }>({
      query: ({ runId }) => ({
        url: `/agent-team-runs/${runId}/cancel`,
        method: 'POST',
        headers: { 'Idempotency-Key': newIdempotencyKey() },
        body: { reason: 'Cancelled from the run panel' },
      }),
      invalidatesTags: (_r, _e, { runId, conversationId }) => [
        { type: 'AgentTeamRun', id: runId },
        { type: 'AgentTeamRun', id: `THREAD:${conversationId}` },
      ],
    }),

    /** Answer a pause. The key is stable per interaction, so a double tap
     * on a flaky connection resolves once. */
    resolveTeamInteraction: builder.mutation<
      TeamInteraction,
      {
        interactionId: string;
        runId: string;
        conversationId: string;
        decision: 'APPROVED' | 'REJECTED';
        chosenAction?: ResolutionAction;
        referenceId?: string;
        idempotencyKey: string;
      }
    >({
      query: ({ interactionId, decision, chosenAction, referenceId, idempotencyKey }) => ({
        url: `/agent-team-interactions/${interactionId}/resolve`,
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: { decision, ...(chosenAction ? { chosenAction } : {}), ...(referenceId ? { referenceId } : {}) },
      }),
      invalidatesTags: (_r, _e, { runId, conversationId }) => [
        { type: 'AgentTeamRun', id: `INTERACTIONS:${runId}` },
        { type: 'AgentTeamRun', id: runId },
        { type: 'AgentTeamRun', id: `THREAD:${conversationId}` },
      ],
    }),
  }),
});

export const {
  useGetThreadTeamRunsQuery,
  useGetTeamRunQuery,
  useGetTeamRunEventsQuery,
  useGetTeamRunInteractionsQuery,
  useCancelTeamRunMutation,
  useResolveTeamInteractionMutation,
} = teamRunApi;
