/**
 * Leads — presentation rules and copy. Ported from the web app's
 * `src/features/Leads/Leads.data.ts` and the pure helpers at the top of
 * `useLeads.tsx` (confirmed against that source).
 *
 * The scoring RULES (source-signal weights, jitter) do not live here or
 * anywhere on this client — assessing a lead is entirely the ML service's
 * job, reached through `POST /leads/score`. What stays here is
 * presentation only: which tone a stage/score/type badge takes.
 */
import type { Lead, LeadColumn, LeadFieldRow, LeadStage, LeadType, ReasoningRow, StatusTone } from './leads.types';
import { LEAD_STAGES } from './leads.types';

/* -------------------------------------------------------------------------- */
/* Tones                                                                      */
/* -------------------------------------------------------------------------- */

export const STAGE_TONE: Record<LeadStage, StatusTone> = {
  New: 'neutral',
  Enriched: 'info',
  Qualified: 'purple',
  Contacted: 'warning',
  Won: 'success',
};

export const LEAD_TYPE_TONE: Record<LeadType, StatusTone> = {
  AI: 'accent',
  Manual: 'neutral',
};

export const LEAD_TYPE_TITLE: Record<LeadType, string> = {
  AI: 'Filed by an agent',
  Manual: 'Entered by a person',
};

/** Score at/above this reads strong; below `WEAK_SCORE`, weak. Same two
 * numbers the scoring engine's own written verdict uses. */
export const STRONG_SCORE = 80;
export const WEAK_SCORE = 70;

export const leadScoreTone = (score: number | null): StatusTone => {
  if (score === null) return 'neutral';
  if (score >= STRONG_SCORE) return 'success';
  return score >= WEAK_SCORE ? 'warning' : 'danger';
};

/** The stage a lead is finished in — the Won stat, the badge that counts
 * everything except it, and the confirmation on a move out of it. */
export const WON_STAGE: LeadStage = 'Won';

export const SOURCE_OPTIONS = [
  { label: 'Web form', value: 'Web form' },
  { label: 'WhatsApp inbound', value: 'WhatsApp inbound' },
  { label: 'Inbound email', value: 'Inbound email' },
  { label: 'Referral', value: 'Referral' },
  { label: 'Outbound', value: 'Outbound' },
  { label: 'Existing customer', value: 'Existing customer' },
  { label: 'Connector', value: 'Connector' },
];

export const STAGE_OPTIONS = LEAD_STAGES.map((stage) => ({ label: stage, value: stage }));

/** The value the owner picker uses for "nobody". Sent as an empty string. */
export const UNASSIGNED_OWNER = 'unassigned';

/* -------------------------------------------------------------------------- */
/* Attachments                                                               */
/* -------------------------------------------------------------------------- */

export const MAX_LEAD_ATTACHMENTS = 10;
export const MAX_LEAD_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const LEAD_ATTACHMENT_ACCEPT = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export const pluraliseFiles = (count: number): string => `${count} file${count === 1 ? '' : 's'}`;

/* -------------------------------------------------------------------------- */
/* Pure builders                                                              */
/* -------------------------------------------------------------------------- */

/** Every lead belonging to one pipeline stage, in board order. */
export const buildColumn = (leads: Lead[], stage: LeadStage): LeadColumn => ({
  id: stage,
  title: stage,
  items: leads.filter((lead) => lead.stage === stage),
});

export const buildColumns = (leads: Lead[]): LeadColumn[] => LEAD_STAGES.map((stage) => buildColumn(leads, stage));

/** Only scored leads have reasoning worth auditing, highest score first. */
export const buildReasoningRows = (leads: Lead[]): ReasoningRow[] =>
  leads
    .filter((lead): lead is Lead & { score: number } => lead.score !== null)
    .map((lead) => ({
      id: lead.id,
      name: lead.name,
      score: lead.score,
      why: lead.why || 'No justification recorded for this score.',
      src: lead.src,
      stage: lead.stage,
    }))
    .sort((a, b) => b.score - a.score);

/** "8 Aug 2026, 14:30", or a dash. Date and time — `scoredAt` answers "how
 * fresh is this", and two runs the same afternoon must stay distinguishable. */
export const formatLeadTimestamp = (iso: string | null): string => {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** The detail screen's label/value rows. `why` is rendered as its own
 * paragraph block elsewhere, not squeezed in here. */
export const buildLeadDetailRows = (lead: Lead | null): LeadFieldRow[] => {
  if (!lead) return [];
  return [
    { id: 'stage', label: 'Stage', value: lead.stage, tone: STAGE_TONE[lead.stage] },
    ...(LEAD_TYPE_TONE[lead.leadType]
      ? [{ id: 'leadType', label: 'Lead type', value: lead.leadType, tone: LEAD_TYPE_TONE[lead.leadType], title: LEAD_TYPE_TITLE[lead.leadType] }]
      : []),
    { id: 'src', label: 'Source', value: lead.src },
    { id: 'owner', label: 'Owner', value: lead.owner || 'Unassigned' },
    { id: 'score', label: 'Score', value: lead.score === null ? 'Unscored' : String(lead.score), tone: leadScoreTone(lead.score) },
    { id: 'scoredAt', label: 'Scored', value: formatLeadTimestamp(lead.scoredAt) },
    { id: 'createdAt', label: 'Added', value: formatLeadTimestamp(lead.createdAt) },
  ];
};

/** What the score field submitted, as the API's `score` — '' means unscored. */
export const parseScoreField = (value: string): number | null => {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

/* -------------------------------------------------------------------------- */
/* Copy                                                                       */
/* -------------------------------------------------------------------------- */

export const LEAD_MODAL_COPY = {
  create: {
    title: 'Add lead',
    description: 'Leave the score empty and the lead arrives unscored — run the scoring agent to give it a score and a written justification. Fill it in yourself only with the reasoning beside it.',
    submitLabel: 'Add lead',
  },
  edit: {
    title: 'Edit lead',
    description: 'Editing does not rescore. Run the scoring agent again if the source or stage has changed materially.',
    submitLabel: 'Save changes',
  },
} as const;

export const SCORING_CALLOUT =
  'Every score the agent writes comes with the reasoning behind it, recorded below. A score you cannot interrogate is a number, not a judgement.';

export const NO_PERMISSION_MESSAGE: Record<'create' | 'edit' | 'delete', string> = {
  create: 'Your role cannot add leads.',
  edit: 'Your role cannot edit leads.',
  delete: 'Your role cannot delete leads.',
};
export const NO_MOVE_MESSAGE = 'Your role cannot move leads along the pipeline.';
export const NO_SCORE_MESSAGE = 'Your role cannot run the scoring agent.';

export const SCORING_STARTED_MESSAGE = 'Scoring agent started — the board will update as leads are assessed.';

export const buildLeadSavedMessage = (name: string, mode: 'create' | 'edit'): string =>
  mode === 'create' ? `${name} added.` : `${name} saved.`;

export const buildLeadDeleteWarning = (name: string): string =>
  `“${name}” and its scoring reasoning and files will be permanently deleted. This cannot be undone.`;

export const buildAttachmentDeleteWarning = (fileName: string): string => `Remove “${fileName}” from this lead? This cannot be undone.`;

export const LEAD_MOVE_FROM_WON_COPY = {
  title: 'Move out of Won?',
  submitLabel: 'Move it',
} as const;

export const buildLeadMoveFromWonWarning = (name: string): string =>
  `“${name}” is marked Won. Moving it back says the deal did not close after all — confirm this is what you mean.`;

/**
 * "This lead's evaluation moved" — the ONLY place an evaluation's outcome
 * is worded. Only fields the socket frame actually carries; the lead's
 * name is never included — the frame is tenant-wide and may name a lead
 * not in this device's cache yet.
 */
export const describeLeadEvaluationCompleted = (payload: {
  status: string;
  verdict: string | null;
  score: number | null;
}): { message: string; tone: 'success' | 'warning' | 'neutral' } => {
  const { status, verdict, score } = payload;
  if (status === 'FAILED' || status === 'STOPPED') {
    return { message: `A lead evaluation ${status === 'FAILED' ? 'failed' : 'was stopped'}.`, tone: 'warning' };
  }
  const parts = [verdict ? `verdict ${verdict}` : null, score !== null ? `scored ${score}` : null].filter((p): p is string => p !== null);
  const opening = status === 'COMPLETE' ? 'A lead evaluation finished' : `A lead evaluation reported ${status}`;
  return { message: parts.length ? `${opening} — ${parts.join(', ')}.` : `${opening}.`, tone: 'success' };
};
