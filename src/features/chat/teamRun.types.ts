/**
 * Team runs — the types a team chat thread reads, mirrored from the web
 * app's `src/types/agentTeamRun.types.ts` and confirmed against live
 * `GET /agent-team-runs*` responses on 2026-10-15.
 *
 * One run per question asked in a team thread. Its user-visible agent
 * messages are REAL message rows (they arrive through the ordinary
 * transcript and `message:*` socket frames); the run itself carries the
 * status, the timings, the token totals, the event log and any pause that
 * waits on a person.
 */

export type TeamRunStatus =
  | 'QUEUED'
  | 'PLANNING'
  | 'RUNNING'
  | 'AWAITING_INPUT'
  | 'SYNTHESIZING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT';

/** One row of `GET /agent-team-runs?conversationId=` — newest first. */
export interface TeamRunSummary {
  id: string;
  teamId: string;
  teamRevision: number;
  conversationId: string | null;
  /** The USER message that started it. */
  messageId: string | null;
  status: TeamRunStatus;
  startedAt: string | null;
  createdAt: string;
  finishedAt: string | null;
  plannedTaskCount: number;
  completedTaskCount: number;
  failedTaskCount: number;
  /** ⚠️ Micro-cents: divide by 100,000 for pounds. */
  costMicroCents: number | null;
  failureCode: string | null;
}

export interface TeamRunPage {
  items: TeamRunSummary[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface TeamRunAgentTokens {
  agentId: string | null;
  promptTokens: number;
  completionTokens: number;
  cachedTokens?: number;
  costMicroCents?: number;
}

export interface TeamRunTask {
  taskKey: string;
  title: string;
  status: string;
  agentId: string | null;
  dependsOn?: string[];
  startedAt?: string | null;
}

/** `GET /agent-team-runs/:id`. */
export interface TeamRunDetail {
  status: TeamRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCachedTokens: number;
  totalCostMicroCents: number | null;
  priced: boolean;
  plannedTaskCount: number;
  completedTaskCount: number;
  failedTaskCount: number;
  tasks: TeamRunTask[] | null;
  byAgent: TeamRunAgentTokens[] | null;
}

/** One event of `GET /agent-team-runs/:id/events` (sequence ascending). */
export interface TeamRunEvent {
  eventId: string;
  sequence: number;
  type: string;
  taskKey: string | null;
  agentId: string | null;
  visibility: string;
  payload: unknown;
  occurredAtUnixMs: number | null;
}

export interface TeamRunEventPage {
  items: TeamRunEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

export type TeamInteractionType = 'CAPABILITY_GAP' | 'CONNECTOR_PERMISSION' | 'AGENT_REQUIRED' | 'ACTION_APPROVAL';
export type TeamInteractionStatus = 'OPEN' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

export type ResolutionAction =
  | 'BIND_EXISTING_CONNECTOR'
  | 'CONFIGURE_CONNECTOR'
  | 'ADD_EXISTING_AGENT'
  | 'INSTALL_AGENT_TEMPLATE'
  | 'CREATE_AGENT'
  | 'APPROVE_EXTERNAL_ACTION';

/** A pause the run is waiting on a person to answer. */
export interface TeamInteraction {
  id: string;
  runId: string;
  taskKey: string | null;
  type: TeamInteractionType;
  status: TeamInteractionStatus;
  reason: string;
  requestedCapability: string | null;
  requestedConnectorSlug: string | null;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  options: Array<{
    action: ResolutionAction;
    label: string;
    installationId: string | null;
    connectorSlug: string | null;
    agentId: string | null;
    templateId: string | null;
  }>;
  taskOptional?: boolean;
  rejectionOutcome?: 'SKIP_TASK_CONTINUE' | 'FAIL_CURRENT_RUN';
  expiresAt?: string | null;
}

/** The `team:run:event` socket frame — only the routing keys are read. */
export interface TeamRunEventFrame {
  runId: string;
  conversationId: string | null;
  type: string;
}
