/**
 * Leads — the prospective-customer pipeline. Ported from the web app's
 * `src/types/lead.types.ts` and `src/features/Leads/Leads.interface.ts`
 * (confirmed against that source, plus `apps/gateway-b2b/src/app/leads/
 * leads.controller.ts` on the backend).
 *
 * Board columns are five fixed stages (`LEAD_STAGES`); mobile shows one
 * stage at a time via a segmented control rather than a five-column
 * Kanban board, with the same forward/back arrows the web's cards already
 * carry (web never required drag — see `LeadBoardProps.onMove`).
 */

export type LeadStage = 'New' | 'Enriched' | 'Qualified' | 'Contacted' | 'Won';

export const LEAD_STAGES: readonly LeadStage[] = ['New', 'Enriched', 'Qualified', 'Contacted', 'Won'];

/** Two values only — a person typed this in, or an agent filed it. Read-only here. */
export type LeadType = 'Manual' | 'AI';

export interface Lead {
  id: string;
  name: string;
  /** '' when none, never null. */
  description: string;
  stage: LeadStage;
  score: number | null;
  src: string;
  leadType: LeadType;
  /** '' on an unscored lead. */
  why: string;
  /** '' when unassigned. */
  owner: string;
  scoredAt: string | null;
  createdAt: string;
}

export interface LeadAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export type MoveLeadStageRequest =
  | { id: string; stage: LeadStage; direction?: never }
  | { id: string; direction: 'forward' | 'back'; stage?: never };

export interface LeadStats {
  total: number;
  /** Everything not yet Won — the figure the sidebar badge shows. */
  open: number;
  scored: number;
  unscored: number;
  won: number;
}

/**
 * `POST /leads/score`'s reply — a RECEIPT, not a run. Always `{accepted:
 * true}`. Do not grow this type — see the web's own long note on why it
 * has been wrong twice already in the same direction (`LeadScoringAccepted`
 * in `lead.types.ts`). The evaluation's actual outcome arrives later, on
 * the `lead:evaluation-completed` socket frame.
 */
export interface LeadScoringAccepted {
  accepted: boolean;
}

/** What the socket's `lead:evaluation-completed` frame carries. */
export interface LeadEvaluationCompletedPayload {
  leadId: string;
  status: string;
  verdict: string | null;
  runId: string | null;
  score: number | null;
  scoredAt: string | null;
}

/* -------------------------------------------------------------------------- */
/* Create / update inputs                                                     */
/* -------------------------------------------------------------------------- */

/** `leadType` is never sendable from this app — a lead typed in here is
 * always Manual by the column default; only the enrichment service files
 * `AI` rows. */
export interface CreateLeadInput {
  name: string;
  description?: string;
  src: string;
  stage?: LeadStage;
  owner?: string;
  criteriaId?: string | null;
  /** Only together with `why` — the API refuses a score nobody can explain. */
  score?: number | null;
  why?: string;
}

export interface UpdateLeadInput {
  id: string;
  name?: string;
  description?: string;
  src?: string;
  stage?: LeadStage;
  owner?: string;
  criteriaId?: string | null;
  score?: number | null;
  why?: string;
}

/* -------------------------------------------------------------------------- */
/* UI shapes                                                                  */
/* -------------------------------------------------------------------------- */

export type LeadsModal = 'create' | 'edit' | 'delete' | null;

export interface LeadColumn {
  id: LeadStage;
  title: string;
  items: Lead[];
}

export interface ReasoningRow {
  id: string;
  name: string;
  score: number;
  why: string;
  src: string;
  stage: LeadStage;
}

export type StatusTone = 'neutral' | 'info' | 'purple' | 'warning' | 'success' | 'danger' | 'accent';

export interface LeadFieldRow {
  id: string;
  label: string;
  value: string;
  tone?: StatusTone;
  title?: string;
}

/** How a move was asked for: a named target stage, or one step in a direction. */
export type LeadMoveRequest = { stage: LeadStage; direction?: never } | { direction: 'forward' | 'back'; stage?: never };

/** A move held back until the user confirms leaving Won. */
export interface PendingLeadMove {
  lead: Lead;
  request: LeadMoveRequest;
}
