/**
 * Team chat — the pure rules, ported from the web app's
 * `features/Chat/chatThreadMode.ts`, `chatTeamRun.ts`, `teamMeter.ts`,
 * `Chat.data.ts` (copy) and `sections/InteractionBlock/InteractionBlock.data.ts`.
 * No React, no store, no network.
 */
import type { TeamInteraction, TeamRunStatus } from './teamRun.types';

/* -------------------------------------------------------------------------- */
/* Which tab a thread lives under                                             */
/* -------------------------------------------------------------------------- */

export interface ThreadModeFields {
  mode: string;
  agentTeamId?: string | null;
}

/** A thread answered by a team. Both halves, as on web: `mode` alone is not
 * enough on a row a server wrote before the roster existed. */
export const isTeamThread = (thread: ThreadModeFields | null | undefined): boolean =>
  thread?.mode === 'AGENT_TEAM' && Boolean(thread.agentTeamId);

/** Order is the order the tabs render in; `agent` first because most
 * threads are one-agent ones. A SOCKET thread counts as `agent`. */
export const THREAD_KINDS = ['agent', 'team'] as const;
export type ThreadKind = (typeof THREAD_KINDS)[number];

export const THREAD_KIND_LABEL: Record<ThreadKind, string> = {
  agent: 'Chat',
  team: 'Teams',
};

export const threadKindOf = (thread: ThreadModeFields): ThreadKind => (isTeamThread(thread) ? 'team' : 'agent');

/** A FILTER, never a sort — the server's order is kept. It filters what is
 * LOADED: the list API has no `mode` parameter. */
export const threadsOfKind = <T extends ThreadModeFields>(threads: readonly T[], kind: ThreadKind): T[] =>
  threads.filter((t) => threadKindOf(t) === kind);

/** The filtered-empty state — a different fact from "no threads at all". */
export const KIND_EMPTY_COPY = {
  team: { title: 'No team chats here', body: 'Nothing on this page is answered by a team.', switchTo: (n: number) => `Show chats (${n})` },
  agent: { title: 'No one-agent chats here', body: 'Nothing on this page is answered by a single agent.', switchTo: (n: number) => `Show teams (${n})` },
} as const;

/* -------------------------------------------------------------------------- */
/* New thread — "Answered by"                                                 */
/* -------------------------------------------------------------------------- */

export const ANSWERED_BY_OPTIONS = [
  { value: 'agent', label: 'One agent' },
  { value: 'team', label: 'A team of agents' },
] as const;

/** The platform ceiling for a team thread's roster — web's `MAX_THREAD_AGENTS`. */
export const MAX_THREAD_AGENTS = 8;

export const NEW_THREAD_TEAM_COPY = {
  description: 'A thread is answered by one agent, or by one team of agents — pick which.',
  nameLabel: 'Thread name',
  namePlaceholder: 'e.g. Barrow Foods · returns policy',
  nameHint: 'Optional — leave it blank and the first message names the thread.',
  answeredByLabel: 'Answered by *',
  agentLabel: 'Agent *',
  agentsLabel: 'Agents *',
  searchAgents: 'Search agents…',
  agentsUnavailable:
    'Could not load the agent list. The thread cannot be created until it loads — check that the API is reachable, then reopen this dialog.',
  noUsableAgent: 'None of your agents is deployed yet — deploy one to start a thread.',
  kbLabel: 'Knowledge base',
  noKb: 'No knowledge base',
  kbHint: 'Optional — scope this thread to a knowledge base.',
  kbUnavailable: 'Could not load your knowledge bases. The thread can still be created without one.',
  kbEmpty: 'You have no knowledge bases yet — this thread will not be scoped to one.',
  saveFailed: 'Could not save that thread.',
  agentsHint:
    'Pick the agents that answer this thread. They plan together, each answers in its own name, and one final answer is written for you.',
  agentsRequired: 'Agents is required',
  agentsMax: `Agents: pick at most ${MAX_THREAD_AGENTS}`,
} as const;

/** Web's FormModal checklist rules, as one pure check. */
export const validateTeamAgents = (ids: readonly string[]): string | null => {
  if (ids.length === 0) return NEW_THREAD_TEAM_COPY.agentsRequired;
  if (ids.length > MAX_THREAD_AGENTS) return NEW_THREAD_TEAM_COPY.agentsMax;
  return null;
};

/* -------------------------------------------------------------------------- */
/* The transcript — specialist replies folded under the final answer          */
/* -------------------------------------------------------------------------- */

export interface MessageAuthorFields {
  id: string;
  role: string;
  agentId: string | null;
  status: string;
  body: string;
}

export type SpecialistsState = 'writing' | 'answered' | 'no-answer';

export type TeamTranscriptItem<T> =
  | { kind: 'message'; key: string; message: T }
  | { kind: 'specialists'; key: string; messages: T[]; state: SpecialistsState };

/**
 * One turn of a team thread, as web draws it (`groupTeamTranscript`): the
 * USER message, then the final answer (a message with NO agentId), with the
 * specialists' own replies (messages WITH an agentId) folded into one row
 * under it. Until the answer exists the row sits where it will be and says
 * who has finished; if the answer failed, it opens to show what was done.
 *
 * Input and output are CHRONOLOGICAL (oldest first).
 */
export const groupTeamTranscript = <T extends MessageAuthorFields>(ordered: readonly T[]): Array<TeamTranscriptItem<T>> => {
  const items: Array<TeamTranscriptItem<T>> = [];
  let specialists: T[] = [];
  let answers: T[] = [];
  const flush = () => {
    const [first] = specialists;
    let row: TeamTranscriptItem<T> | null = null;
    if (first) {
      const answered = answers.some((a) => a.status === 'COMPLETE' && a.body.trim() !== '');
      const writing = answers.length === 0 || answers.some((a) => a.status === 'PENDING' || a.status === 'STREAMING');
      let state: SpecialistsState = 'no-answer';
      if (answered) state = 'answered';
      else if (writing) state = 'writing';
      row = { kind: 'specialists', key: `specialists-${first.id}`, messages: specialists, state };
    }
    if (row && row.state !== 'answered') items.push(row);
    answers.forEach((a) => items.push({ kind: 'message', key: a.id, message: a }));
    if (row && row.state === 'answered') items.push(row);
    specialists = [];
    answers = [];
  };
  for (const m of ordered) {
    if (m.role === 'USER') {
      flush();
      items.push({ kind: 'message', key: m.id, message: m });
    } else if (m.agentId) {
      specialists.push(m);
    } else {
      answers.push(m);
    }
  }
  flush();
  return items;
};

export const SPECIALIST_REPLIES_COPY = {
  show: (count: number) => (count === 1 ? 'Show 1 specialist reply' : `Show ${count} specialist replies`),
  hide: (count: number) => (count === 1 ? 'Hide specialist reply' : 'Hide specialist replies'),
  writing: (who: string, count: number) => `${who} ${count === 1 ? 'has' : 'have'} finished. The team is preparing the final response.`,
  answered: (count: number) => (count === 1 ? 'Based on 1 specialist reply' : `Based on ${count} specialist replies`),
  noAnswer: (count: number) =>
    count === 1 ? 'The final answer did not finish · 1 specialist reply below' : `The final answer did not finish · ${count} specialist replies below`,
} as const;

/** "A", "A and B", "A, B and 2 others". */
export const listNames = (names: readonly string[]): string => {
  const unique = [...new Set(names)];
  const [first, second] = unique;
  if (!first) return 'A specialist';
  if (!second) return first;
  if (unique.length === 2) return `${first} and ${second}`;
  const rest = unique.length - 2;
  return `${first}, ${second} and ${rest} other${rest === 1 ? '' : 's'}`;
};

export const specialistsSummary = (state: SpecialistsState, count: number, names: readonly string[]): string => {
  if (state === 'writing') return SPECIALIST_REPLIES_COPY.writing(listNames(names), names.length);
  if (state === 'answered') return SPECIALIST_REPLIES_COPY.answered(count);
  return SPECIALIST_REPLIES_COPY.noAnswer(count);
};

/* -------------------------------------------------------------------------- */
/* Who is working — one row per agent, from the run's events                  */
/* -------------------------------------------------------------------------- */

export type AgentRunState = 'working' | 'input' | 'queued' | 'done' | 'failed';

export interface TeamAgentRow {
  agentId: string;
  agentName: string | null;
  state: AgentRunState;
  step: string | null;
  startedAtUnixMs: number | null;
  doneSteps: number;
  totalSteps: number;
}

const STEP_STATE_BY_TASK_STATUS: Record<string, AgentRunState | null> = {
  RUNNING: 'working',
  AWAITING_INPUT: 'input',
  PENDING: 'queued',
  READY: 'queued',
  COMPLETED: 'done',
  FAILED: 'failed',
  TIMED_OUT: 'failed',
  CANCELLED: null,
  SKIPPED: null,
};

const STEP_STATE_BY_EVENT: Record<string, AgentRunState> = {
  'task.queued': 'queued',
  'task.started': 'working',
  'task.progress': 'working',
  'interaction.resolved': 'working',
  'interaction.required': 'input',
  'task.completed': 'done',
  'task.failed': 'failed',
};

const STATE_RANK: Record<AgentRunState, number> = { input: 0, working: 1, queued: 2, failed: 3, done: 4 };

/** `task-requirements-outline` → `Requirements outline`. */
const readableStep = (value: string): string => {
  const words = value.replace(/[-_]+/g, ' ').replace(/^task\s+/i, '').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** A straight port of web's `teamAgentRows`: every task's latest state,
 * folded to one row per agent showing its most urgent step. */
export const teamAgentRows = (
  events: ReadonlyArray<{ sequence: number; type: string; taskKey: string | null; agentId: string | null; occurredAtUnixMs: number | null }>,
  tasks: ReadonlyArray<{ taskKey: string; title: string; status: string; agentId: string | null; startedAt?: string | null }> | null | undefined,
  agentNameById: Record<string, string> | undefined,
): TeamAgentRow[] => {
  interface Step {
    agentId: string | null;
    title: string | null;
    state: AgentRunState | null;
    startedAtUnixMs: number | null;
  }
  const steps = new Map<string, Step>();
  const agentOrder: string[] = [];
  const noteAgent = (id: string | null) => {
    if (id && !agentOrder.includes(id)) agentOrder.push(id);
  };

  for (const task of tasks ?? []) {
    const started = task.startedAt ? Date.parse(task.startedAt) : Number.NaN;
    steps.set(task.taskKey, {
      agentId: task.agentId,
      title: task.title ? readableStep(task.title) : null,
      state: STEP_STATE_BY_TASK_STATUS[task.status] ?? null,
      startedAtUnixMs: Number.isFinite(started) ? started : null,
    });
  }

  const ordered = events.filter((e) => e.taskKey && STEP_STATE_BY_EVENT[e.type]).slice().sort((a, b) => a.sequence - b.sequence);
  for (const event of ordered) {
    const key = event.taskKey ?? '';
    const next = STEP_STATE_BY_EVENT[event.type];
    if (!next) continue;
    const step: Step = steps.get(key) ?? { agentId: null, title: readableStep(key) || null, state: null, startedAtUnixMs: null };
    if (!step.agentId && event.agentId) step.agentId = event.agentId;
    noteAgent(step.agentId);
    const isRetry = step.state === 'failed' && event.type === 'task.started';
    const isFinal = step.state === 'done' || (step.state === 'failed' && !isRetry);
    const isBehind = next === 'queued' && (step.state === 'working' || step.state === 'input');
    if (isFinal || isBehind) {
      steps.set(key, step);
      continue;
    }
    if (next === 'working' && (step.state !== 'working' || step.startedAtUnixMs === null)) {
      step.startedAtUnixMs = event.occurredAtUnixMs ?? step.startedAtUnixMs;
    }
    step.state = next;
    steps.set(key, step);
  }

  for (const step of steps.values()) noteAgent(step.agentId);

  const rows: TeamAgentRow[] = [];
  for (const agentId of agentOrder) {
    const mine = [...steps.values()].filter((s): s is Step & { state: AgentRunState } => s.agentId === agentId && s.state !== null);
    if (mine.length === 0) continue;
    const lead = mine.reduce((best, s) => (STATE_RANK[s.state] < STATE_RANK[best.state] ? s : best));
    rows.push({
      agentId,
      agentName: agentNameById?.[agentId] ?? null,
      state: lead.state,
      step: lead.title,
      startedAtUnixMs: lead.state === 'working' ? lead.startedAtUnixMs : null,
      doneSteps: mine.filter((s) => s.state === 'done').length,
      totalSteps: mine.length,
    });
  }
  return rows;
};

export const TEAM_STATUS_COPY = {
  unnamed: 'Specialist',
  working: 'Working',
  input: 'Needs an answer',
  queued: 'Up next',
  done: 'Done',
  failed: "Couldn't finish",
  idle: 'Idle',
  stepCount: (done: number, total: number) => `${done} of ${total} steps`,
  foot: "Each agent's reply appears above as soon as it is complete.",
  footDone: "Each agent's reply is above. The final answer is being written.",
} as const;

export const agentStateLabel = (state: AgentRunState | 'idle'): string => TEAM_STATUS_COPY[state];

/* -------------------------------------------------------------------------- */
/* The run band above the composer                                            */
/* -------------------------------------------------------------------------- */

export type TeamMeterPhase = 'planning' | 'working' | 'writing' | 'needs-you' | 'ready' | 'failed' | 'stopped' | 'idle';

export const teamMeterPhase = (status: TeamRunStatus | null | undefined, hasOpenRequest: boolean): TeamMeterPhase => {
  if (hasOpenRequest || status === 'AWAITING_INPUT') return 'needs-you';
  switch (status) {
    case 'QUEUED':
    case 'PLANNING':
      return 'planning';
    case 'RUNNING':
      return 'working';
    case 'SYNTHESIZING':
      return 'writing';
    case 'SUCCEEDED':
      return 'ready';
    case 'FAILED':
    case 'TIMED_OUT':
      return 'failed';
    case 'CANCELLED':
      return 'stopped';
    default:
      return 'idle';
  }
};

export const isLivePhase = (phase: TeamMeterPhase): boolean =>
  phase === 'planning' || phase === 'working' || phase === 'writing' || phase === 'needs-you';

/** The run's status can lag its events: every involved agent done while the
 * status still says RUNNING means the answer is being written. */
export const refinePhase = (phase: TeamMeterPhase, rows: readonly TeamAgentRow[]): TeamMeterPhase => {
  const moved = rows.some((r) => r.state !== 'queued');
  const allDone = rows.length > 0 && rows.every((r) => r.state === 'done' || r.state === 'failed');
  if ((phase === 'planning' || phase === 'working') && allDone) return 'writing';
  if (phase === 'planning' && moved) return 'working';
  return phase;
};

const agentCount = (n: number) => `${n} agent${n === 1 ? '' : 's'}`;
const wasWere = (n: number) => (n === 1 ? 'was' : 'were');

export interface RunBandRead {
  phase: TeamMeterPhase;
  rows: readonly TeamAgentRow[];
  teamSize: number;
  waitingName: string | null;
}

/** Web's `TeamMeterBand` headline. */
export const runHeadline = ({ phase, rows, waitingName }: RunBandRead): string => {
  const working = rows.filter((r) => r.state === 'working');
  switch (phase) {
    case 'planning':
      return 'Planner is choosing who to involve';
    case 'working':
      if (working.length === 1) return `${working[0]?.agentName ?? TEAM_STATUS_COPY.unnamed} is working`;
      return working.length > 1 ? `${working.length} agents are working` : 'The team is working';
    case 'writing':
      return 'Writing the final answer';
    case 'needs-you':
      return waitingName ? `${waitingName} needs your approval` : 'The team needs your approval';
    case 'ready':
      return 'Team finished';
    case 'failed':
      return 'The run stopped without finishing';
    case 'stopped':
      return 'Stopped';
    default:
      return 'Team ready';
  }
};

/** Web's subline. A finished run nobody was delegated to is the team lead
 * answering directly — the live portal's wording for that case. */
export const runSubline = ({ phase, rows, teamSize }: RunBandRead): string => {
  const used = rows.length;
  const done = rows.filter((r) => r.state === 'done').length;
  const notNeeded = Math.max(0, teamSize - used);
  const scope = used > 0 && notNeeded > 0 ? ` · ${used} of ${teamSize} agents on this question` : '';
  switch (phase) {
    case 'planning':
      return `${agentCount(teamSize)} available`;
    case 'working':
    case 'writing':
      return `${done} of ${used} done${scope}`;
    case 'needs-you':
      return 'Paused · nothing is spent while it waits';
    case 'ready':
      if (used === 0) return 'The team lead answered directly · the answer is in the chat';
      return notNeeded > 0
        ? `${used} of ${teamSize} agents worked · ${notNeeded} ${wasWere(notNeeded)} not needed`
        : `${agentCount(used)} worked · the answer is in the chat`;
    case 'stopped':
      return 'Work done so far is kept';
    case 'failed':
      return 'Anything already written is kept';
    default:
      return `${agentCount(teamSize)} in this team`;
  }
};

export function formatTokens(n: number): string {
  if (n < 1000) return String(Math.max(0, Math.round(n)));
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
}

/** `m:ss`, or `h:mm:ss` past an hour. Never negative. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** ⚠️ Run cost is in MICRO-cents. */
export const microCentsToCents = (micro: number): number => micro / 1000;

export const RUN_STATUS_LABEL: Record<TeamRunStatus, string> = {
  QUEUED: 'Getting started',
  PLANNING: 'Working out the steps',
  RUNNING: 'Working',
  AWAITING_INPUT: 'Waiting on you',
  SYNTHESIZING: 'Writing the answer',
  SUCCEEDED: 'Done',
  FAILED: 'Stopped',
  CANCELLED: 'Stopped',
  TIMED_OUT: 'Took too long',
};

export const TERMINAL_RUN_STATUSES: ReadonlySet<TeamRunStatus> = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT']);

/** Poll a live run this often — web's `RUN_POLL_MS`. The socket's
 * `team:run:event` frames trigger an immediate refetch on top. */
export const RUN_POLL_MS = 3_000;

/* -------------------------------------------------------------------------- */
/* A pause that waits on a person                                             */
/* -------------------------------------------------------------------------- */

export const INTERACTION_TITLE: Record<TeamInteraction['type'], string> = {
  CONNECTOR_PERMISSION: 'This team needs access to a tool',
  AGENT_REQUIRED: 'This team needs another agent',
  ACTION_APPROVAL: 'This team needs your approval',
  CAPABILITY_GAP: 'This team is missing a skill',
};

export const INTERACTION_BODY: Record<TeamInteraction['type'], string> = {
  CONNECTOR_PERMISSION: 'Approving connects the tool for this team and carries on from where it stopped.',
  AGENT_REQUIRED: 'Approving adds the agent to this thread’s team and carries on from where it stopped.',
  ACTION_APPROVAL: 'This action affects something outside this chat, so it needs your say-so first.',
  CAPABILITY_GAP: 'Nobody on this team covers what the next step needs. Pick how to close the gap.',
};

export const RESOLUTION_FALLBACK_LABEL: Record<string, string> = {
  BIND_EXISTING_CONNECTOR: 'Use a connected account',
  CONFIGURE_CONNECTOR: 'Connect an account',
  ADD_EXISTING_AGENT: 'Add an agent you already have',
  INSTALL_AGENT_TEMPLATE: 'Add a ready-made agent',
  CREATE_AGENT: 'Create a new agent',
  APPROVE_EXTERNAL_ACTION: 'Approve this action',
};

export const DECLINE_COPY = {
  SKIP_TASK_CONTINUE: { label: 'Skip this task and continue', danger: false, hint: 'The team will move on to the rest of the plan without this step.' },
  FAIL_CURRENT_RUN: { label: 'Stop this run', danger: true, hint: 'The team will stop here. You can start a new message when you are ready.' },
} as const;

/** ABSENT MEANS FAIL — an older backend sends no `rejectionOutcome`. */
export const declineCopyFor = (outcome?: keyof typeof DECLINE_COPY) => DECLINE_COPY[outcome ?? 'FAIL_CURRENT_RUN'];

export const INTERACTION_COPY = {
  working: 'Working…',
  /** `CREATE_AGENT` opens the agent builder on web — a desktop flow. */
  createOnWeb: 'Creating a new agent for this team is done on the web portal.',
  noOptions: 'There is nothing this screen can offer for this one yet. Open the team’s run to resolve it.',
  riskMedium: 'Worth a look',
  riskHigh: 'Read this carefully',
  resolveFailed: 'That did not go through. The team is still waiting, so you can try again.',
  alreadyMovedOn: 'This run has already moved on, so that answer was not needed.',
  noPermission: 'Somebody with approval rights needs to answer this before the team can carry on.',
} as const;

/** What a resolution points at — the install, the agent or the template. */
export const referenceFor = (option: { installationId: string | null; agentId: string | null; templateId: string | null }): string | undefined =>
  option.installationId ?? option.agentId ?? option.templateId ?? undefined;

export const openInteractions = <T extends { status: string }>(items: readonly T[] | null | undefined): T[] => (items ?? []).filter((i) => i.status === 'OPEN');

/* -------------------------------------------------------------------------- */
/* Thread details — team threads                                              */
/* -------------------------------------------------------------------------- */

export const TEAM_DETAILS_COPY = {
  model: "Team threads use each agent's own model. Each reply shows the model that wrote it.",
  attachedLabel: 'ATTACHED TO THIS TEAM',
  attachedHint: 'What this team can draw on, on top of what its agents already hold — for every turn from here on.',
  knowledge: 'Knowledge bases',
  connectors: 'Connectors',
  attachedCount: (n: number) => (n === 0 ? 'Nothing attached' : `${n} attached`),
  runLabel: 'TEAM RUN',
  runsLabel: 'RUNS IN THIS THREAD',
  noRuns: 'No runs yet. Ask the team something and its run shows here.',
  notNeeded: (n: number) => `NOT NEEDED FOR THIS QUESTION · ${n}`,
  onQuestion: (used: number, total: number) => `${used} of ${total} on this question`,
} as const;

/** Toggle one id in a list — attach or detach. */
export const toggleAttachment = (ids: readonly string[], id: string): string[] => (ids.includes(id) ? ids.filter((e) => e !== id) : [...ids, id]);

/** Web's `agentBlockedNote`: only a DEPLOYED agent can answer a thread; the
 * rest are listed, unpickable, with the reason. */
export const agentBlockedNote = (status: string | null | undefined): string | null => {
  if (status === 'DEPLOYED') return null;
  if (status === 'DRAFT') return 'not evaluated';
  if (status === 'ARCHIVED') return 'archived';
  return 'not deployed';
};

/** Web's `knowledgeBaseHint` — the hint says which of the three states the
 * picker is in, since "none" and "could not load" look the same. */
export const knowledgeBaseHint = (failed: boolean, settledAndEmpty: boolean): string =>
  failed ? NEW_THREAD_TEAM_COPY.kbUnavailable : settledAndEmpty ? NEW_THREAD_TEAM_COPY.kbEmpty : NEW_THREAD_TEAM_COPY.kbHint;
