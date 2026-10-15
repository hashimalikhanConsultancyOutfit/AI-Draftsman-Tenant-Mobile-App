import { useEffect, useMemo, useRef, useState } from 'react';

import { onChatSocketEvent } from '@/services/chatSocket';

import type { TeamInteraction, TeamRunEventFrame, TeamRunStatus } from './teamRun.types';
import {
  useGetTeamRunEventsQuery,
  useGetTeamRunInteractionsQuery,
  useGetTeamRunQuery,
  useGetThreadTeamRunsQuery,
} from './teamRunApi';
import {
  RUN_POLL_MS,
  TERMINAL_RUN_STATUSES,
  isLivePhase,
  openInteractions,
  refinePhase,
  teamAgentRows,
  teamMeterPhase,
  type TeamAgentRow,
  type TeamMeterPhase,
} from './teamChatRules';

/** Refetch at most this often in response to socket frames — a run emits
 * several events a second while specialists work. */
const SOCKET_REFETCH_THROTTLE_MS = 1_000;

interface UseTeamRunArgs {
  conversationId: string;
  /** Only a team thread has runs. */
  enabled: boolean;
  /** The newest question has no finished answer yet — its run may not exist
   * on the server for a second or two, so the list is polled meanwhile. */
  turnPending: boolean;
  agentNames: Record<string, string>;
}

export interface TeamRunRead {
  runId: string | null;
  status: TeamRunStatus | null;
  phase: TeamMeterPhase;
  isLive: boolean;
  rows: TeamAgentRow[];
  startedAtMs: number | null;
  endedAtMs: number | null;
  tokensIn: number;
  tokensOut: number;
  costMicroCents: number | null;
  interactions: TeamInteraction[];
  refetch: () => void;
}

/**
 * The latest team run of a thread, kept live — the mobile shape of web's
 * `useTeamRunMeter` + the `team:run:event` handler in `messages.api`. Polls
 * every 3 s while the run is live (web's `RUN_POLL_MS`), and refetches at
 * once on a `team:run:event` frame for this conversation.
 */
export function useTeamRun({ conversationId, enabled, turnPending, agentNames }: UseTeamRunArgs): TeamRunRead {
  const [liveHint, setLiveHint] = useState(false);

  const runsQuery = useGetThreadTeamRunsQuery(
    { conversationId },
    { skip: !enabled, pollingInterval: enabled && (turnPending || liveHint) ? RUN_POLL_MS : 0 },
  );
  const latest = runsQuery.data?.items[0] ?? null;
  const summaryLive = latest ? !TERMINAL_RUN_STATUSES.has(latest.status) : false;
  const poll = summaryLive || liveHint ? RUN_POLL_MS : 0;

  const runQuery = useGetTeamRunQuery(latest?.id ?? '', { skip: !enabled || !latest, pollingInterval: poll });
  const eventsQuery = useGetTeamRunEventsQuery(latest?.id ?? '', { skip: !enabled || !latest, pollingInterval: poll });
  const status: TeamRunStatus | null = runQuery.data?.status ?? latest?.status ?? null;
  const interactionsQuery = useGetTeamRunInteractionsQuery(latest?.id ?? '', {
    skip: !enabled || !latest || !(summaryLive || status === 'AWAITING_INPUT'),
    pollingInterval: poll,
  });

  /* Socket frames: refetch now rather than waiting for the next poll. */
  const lastRefetch = useRef(0);
  const refs = useRef({ runsQuery, runQuery, eventsQuery, interactionsQuery });
  refs.current = { runsQuery, runQuery, eventsQuery, interactionsQuery };
  useEffect(() => {
    if (!enabled) return undefined;
    return onChatSocketEvent<[TeamRunEventFrame]>('team:run:event', (frame) => {
      if (!frame || frame.conversationId !== conversationId) return;
      const now = Date.now();
      if (now - lastRefetch.current < SOCKET_REFETCH_THROTTLE_MS) return;
      lastRefetch.current = now;
      const q = refs.current;
      void q.runsQuery.refetch();
      if (!q.runQuery.isUninitialized) void q.runQuery.refetch();
      if (!q.eventsQuery.isUninitialized) void q.eventsQuery.refetch();
      if (!q.interactionsQuery.isUninitialized) void q.interactionsQuery.refetch();
    });
  }, [conversationId, enabled]);

  const rows = useMemo(
    () => teamAgentRows(eventsQuery.data?.items ?? [], runQuery.data?.tasks ?? null, agentNames),
    [eventsQuery.data, runQuery.data, agentNames],
  );
  const interactions = useMemo(() => openInteractions(interactionsQuery.data), [interactionsQuery.data]);
  const phase = refinePhase(teamMeterPhase(status, interactions.length > 0), rows);
  const isLive = isLivePhase(phase);

  useEffect(() => setLiveHint(isLive), [isLive]);

  const started = runQuery.data?.startedAt ?? latest?.startedAt ?? null;
  const finished = runQuery.data?.finishedAt ?? latest?.finishedAt ?? null;
  const startedAtMs = started ? Date.parse(started) : null;
  const endedAtMs = finished ? Date.parse(finished) : null;

  return {
    runId: latest?.id ?? null,
    status,
    phase,
    isLive,
    rows,
    startedAtMs: startedAtMs !== null && Number.isFinite(startedAtMs) ? startedAtMs : null,
    endedAtMs: endedAtMs !== null && Number.isFinite(endedAtMs) ? endedAtMs : null,
    tokensIn: runQuery.data?.totalPromptTokens ?? 0,
    tokensOut: runQuery.data?.totalCompletionTokens ?? 0,
    costMicroCents: runQuery.data?.totalCostMicroCents ?? latest?.costMicroCents ?? null,
    interactions,
    refetch: () => {
      void runsQuery.refetch();
    },
  };
}
