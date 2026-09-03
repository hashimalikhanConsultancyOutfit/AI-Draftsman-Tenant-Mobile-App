/**
 * Company agents — types, ported from the web app's
 * `src/types/agent.types.ts` and `src/store/api/{agents,labs}.api.ts`
 * (confirmed against that source on 2026-09-01). Field names mirror the
 * gateway's own wire shape so the mapping in `companyAgentsApi.ts` stays a
 * straight translation rather than a second source of truth.
 */

export type AgentState = 'draft' | 'deployed' | 'error';
export type AgentWireStatus = 'DRAFT' | 'EVALUATED' | 'DEPLOYED' | 'ARCHIVED';
export type AgentPricingMode = 'INCLUDED' | 'PER_RUN' | 'PER_TOKEN';
export type AgentMemory = 'LONG_TERM' | 'SHORT_TERM' | 'NO_MEMORY';

export interface AgentMarketplaceOrigin {
  id: string;
  name: string;
  description: string | null;
  categoryName: string | null;
}

/** UI-shape agent — mirrors web's `Agent` (mapped from `AgentWire` by `toAgent`). */
export interface Agent {
  id: string;
  name: string;
  /** Master version number (head). 0 means never edited. */
  ver: number;
  /** Which version is loaded (the pointer). `null` when `ver` is 0. */
  currentVersion: number | null;
  state: AgentState;
  /** Percentage, 0-100. `null` when never evaluated. */
  score: number | null;
  clones: number;
  /** Unit price in GBP (pounds, not pence — mapped from `unitPriceCents`). */
  price: number;
  mode: AgentPricingMode;
  /** `modelSlug` from the wire. */
  model: string;
  tools: string;
  kb: string;
  kbs: Array<{ id: string; name: string }>;
  kbId: string | null;
  kbIds: string[];
  prompt: string;
  locked: string[];
  isSupportAgent: boolean;
  memory: AgentMemory;
  creator: { id: string; name: string | null } | null;
  clonedFromMarketplaceId: string | null;
  clonedFromMarketplace: AgentMarketplaceOrigin | null;
}

/** The gateway's own shape — `GET /agents` returns an array of these. */
export interface AgentWire {
  id: string;
  name: string;
  modelSlug: string;
  memory: AgentMemory;
  tools: string[];
  knowledgeBaseIds?: string[];
  knowledgeBases?: Array<{ id: string; name: string }>;
  knowledgeBaseId?: string | null;
  knowledgeBase?: { id: string; name: string } | null;
  definition: { prompt?: string } | null;
  status: AgentWireStatus;
  pricingMode: AgentPricingMode;
  unitPriceCents: number;
  evaluationScore: number | null;
  lockedFields: string[];
  isSupportAgent?: boolean;
  _count?: { versions: number };
  currentVersion?: number | null;
  cloneCount?: number;
  createdBy?: string | null;
  creator?: { id: string; name: string | null } | null;
  clonedFromMarketplaceId?: string | null;
  clonedFromMarketplace?: {
    id: string;
    name: string;
    description?: string | null;
    category?: { id: string; slug: string; name: string } | null;
  } | null;
}

/** Body of `POST /agents`. */
export interface CreateAgentWire {
  name: string;
  modelSlug: string;
  tools: string[];
  memory: AgentMemory;
  knowledgeBaseIds: string[];
  prompt: string;
  pricingMode: AgentPricingMode;
  unitPriceCents: number;
  lockedFields: string[];
  isSupportAgent: boolean;
}

/** Body of `PATCH /agents/{id}` — every create field optional, plus a note. */
export type UpdateAgentWire = Partial<CreateAgentWire> & { note?: string };

export interface UpdatedAgentWire extends AgentWire {
  definitionInvalidated?: boolean;
  version?: number;
}

export interface CloneAgentRequest {
  agentId: string;
  customerIds: string[];
}

export type EvaluationEnvironment = 'sandbox' | 'live';

export interface EvaluateAgentRequest {
  id: string;
  environment: EvaluationEnvironment;
}

export type EvaluationRunStatus = 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR' | 'CANCELED';

/** What both `POST /agents/{id}/evaluate` and the poll GET return. */
export interface EvaluationRunWire {
  evalRunId: string;
  status: EvaluationRunStatus;
  agentId: string;
  score: number;
  passRateGate: number;
  passed: boolean;
  scenariosTotal: number;
  scenariosPassed: number;
  failureReason?: string;
}

/* -------------------------------------------------------------------------- */
/* Labs / models — the Lab -> Model picker                                    */
/* -------------------------------------------------------------------------- */

export interface Lab {
  id: string;
  name: string;
  slug: string;
  org: string;
  logoUrl: string | null;
  status: string;
}

export interface LabModel {
  id: string;
  slug: string;
  name: string;
  labId: string;
  description: string;
  tier: string;
}

export interface LabModelLookup {
  slug: string;
  found: boolean;
  model: LabModel | null;
}

/* -------------------------------------------------------------------------- */
/* Lightweight lookups for the create/edit + clone-out pickers                */
/* -------------------------------------------------------------------------- */

export interface CustomerLite {
  id: string;
  name: string;
}

export interface KnowledgeBaseLite {
  id: string;
  name: string;
}

/** One row of the detail screen's field table. */
export interface AgentFieldRow {
  id: string;
  label: string;
  value: string;
  moneyAmount?: number;
  isLocked: boolean;
}

export interface EvaluationBadge {
  label: string;
  tone: 'success' | 'error' | 'neutral';
}

/* -------------------------------------------------------------------------- */
/* Version history — read by both Company agents and Playground              */
/* -------------------------------------------------------------------------- */

/** One row of `GET /agents/{id}/versions`, ported from web's `AgentVersionWire`
 * (confirmed against `src/types/agent.types.ts` on 2026-09-03). */
export interface AgentVersionWire {
  id: string;
  agentId: string;
  version: number;
  evaluationScore: number | null;
  note: string | null;
  restoredFromVersion: number | null;
  createdAt: string;
  creator: { id: string; name: string | null; email: string } | null;
  definition?: {
    prompt?: string;
    modelSlug?: string;
    tools?: string[];
    memory?: AgentMemory;
    knowledgeBaseIds?: string[];
    knowledgeBaseId?: string | null;
  };
  definitionInvalidated?: boolean;
}

export interface AgentVersionsPageWire {
  items: AgentVersionWire[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateAgentPromptRequest {
  agentId: string;
  prompt: string;
  note?: string;
}

/** Moves the agent onto one of its own existing versions — writes nothing new,
 * so it may run in either direction and be repeated freely. */
export interface RestoreAgentVersionRequest {
  agentId: string;
  version: number;
}
