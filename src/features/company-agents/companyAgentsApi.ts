/**
 * Company agents — RTK Query endpoints, injected into the shared `api` slice.
 *
 * Mirrors the web app's `src/store/api/{agents,labs}.api.ts` exactly: same
 * URLs, same request/response shapes, same wire<->UI mapping — confirmed
 * against that source on 2026-09-01. `agents`, `labs`, `customers` and
 * `knowledge-bases` are all live gateway resources (none are mocked on the
 * web app), so this hits the real backend the same way the web app does.
 */

import { api } from '@/store/api';

import type {
  Agent,
  AgentWire,
  CloneAgentRequest,
  CreateAgentWire,
  CustomerLite,
  EvaluateAgentRequest,
  EvaluationRunWire,
  KnowledgeBaseLite,
  Lab,
  LabModel,
  LabModelLookup,
  UpdateAgentWire,
  UpdatedAgentWire,
  AgentVersionWire,
  AgentVersionsPageWire,
  UpdateAgentPromptRequest,
  RestoreAgentVersionRequest,
} from './companyAgents.types';

const PAGE_SIZE = 100;

/** Rows per page of version history — `DEFAULT_LIMIT` on the gateway, mirrors
 * web's `AGENT_VERSIONS_PAGE_SIZE`. */
export const AGENT_VERSIONS_PAGE_SIZE = 20;

/** `"Slack, Drive,  order-lookup"` -> `['Slack', 'Drive', 'order-lookup']`. */
const parseTools = (tools: string): string[] =>
  tools
    .split(',')
    .map((tool) => tool.trim())
    .filter(Boolean);

/** Four backend statuses collapse to three UI states — only DEPLOYED is live. */
const toState = (status: AgentWire['status']): Agent['state'] =>
  status === 'DEPLOYED' ? 'deployed' : 'draft';

export function toAgent(wire: AgentWire): Agent {
  const knowledgeBases =
    wire.knowledgeBases ?? (wire.knowledgeBase ? [wire.knowledgeBase] : []);
  const knowledgeBaseIds = wire.knowledgeBaseIds ?? knowledgeBases.map((b) => b.id);

  return {
    id: wire.id,
    name: wire.name,
    ver: wire._count?.versions ?? 0,
    currentVersion: wire.currentVersion ?? null,
    state: toState(wire.status),
    score: wire.evaluationScore,
    clones: wire.cloneCount ?? 0,
    price: (wire.unitPriceCents ?? 0) / 100,
    mode: wire.pricingMode,
    model: wire.modelSlug,
    tools: (wire.tools ?? []).join(', '),
    kb: knowledgeBases.map((b) => b.name).join(', ') || '—',
    kbs: knowledgeBases,
    kbId: knowledgeBaseIds[0] ?? null,
    kbIds: knowledgeBaseIds,
    prompt: wire.definition?.prompt ?? '',
    locked: wire.lockedFields ?? [],
    isSupportAgent: wire.isSupportAgent ?? false,
    memory: wire.memory,
    creator: wire.creator ?? null,
    clonedFromMarketplaceId: wire.clonedFromMarketplaceId ?? null,
    clonedFromMarketplace: wire.clonedFromMarketplace
      ? {
          id: wire.clonedFromMarketplace.id,
          name: wire.clonedFromMarketplace.name,
          description: wire.clonedFromMarketplace.description ?? null,
          categoryName: wire.clonedFromMarketplace.category?.name ?? null,
        }
      : null,
  };
}

export interface AgentFormInput {
  name: string;
  model: string;
  tools: string;
  memory: Agent['memory'];
  kbIds: string[];
  prompt: string;
  mode: Agent['mode'];
  price: number;
  locked: string[];
  isSupportAgent: boolean;
}

function toCreateBody(agent: AgentFormInput): CreateAgentWire {
  return {
    name: agent.name,
    modelSlug: agent.model,
    tools: parseTools(agent.tools),
    memory: agent.memory,
    knowledgeBaseIds: agent.kbIds,
    prompt: agent.prompt,
    pricingMode: agent.mode,
    unitPriceCents: Math.round(agent.price * 100),
    lockedFields: agent.locked,
    isSupportAgent: agent.isSupportAgent,
  };
}

export interface UpdateAgentPatch extends Partial<AgentFormInput> {
  id: string;
  note?: string;
}

function toUpdateBody(patch: UpdateAgentPatch): UpdateAgentWire {
  const body: UpdateAgentWire = {};
  const note = patch.note?.trim();
  if (note) body.note = note;
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.model !== undefined) body.modelSlug = patch.model;
  if (patch.tools !== undefined) body.tools = parseTools(patch.tools);
  if (patch.memory !== undefined) body.memory = patch.memory;
  if (patch.kbIds !== undefined) body.knowledgeBaseIds = patch.kbIds;
  if (patch.prompt !== undefined) body.prompt = patch.prompt;
  if (patch.mode !== undefined) body.pricingMode = patch.mode;
  if (patch.price !== undefined) body.unitPriceCents = Math.round(patch.price * 100);
  if (patch.locked !== undefined) body.lockedFields = patch.locked;
  if (patch.isSupportAgent !== undefined) body.isSupportAgent = patch.isSupportAgent;
  return body;
}

export interface UpdatedAgent extends Agent {
  definitionInvalidated: boolean;
}

interface PageWire<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Normalises a list response that may arrive as a bare array (the agent
 * service's shape, some environments) or as a `{ items, total, ... }`
 * envelope (the standard paged contract) — mirrors web's `toPageWire`, since
 * both shapes are possible in between rollout stages.
 */
function normalizePage<T>(
  response: T[] | (Partial<Omit<PageWire<T>, 'items'>> & { items: T[] }),
  requestedLimit: number,
): PageWire<T> {
  if (Array.isArray(response)) {
    return { items: response, total: response.length, page: 1, limit: requestedLimit, totalPages: 1 };
  }
  const total = response.total ?? response.items.length;
  const limit = response.limit ?? requestedLimit;
  return {
    items: response.items,
    total,
    page: response.page ?? 1,
    limit,
    totalPages: response.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, limit))),
  };
}

export const companyAgentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAgents: builder.query<Agent[], void>({
      query: () => ({ url: '/agents' }),
      transformResponse: (response: AgentWire[]) => response.map(toAgent),
      providesTags: (result) => [
        ...(result ?? []).map((a) => ({ type: 'Agent' as const, id: a.id })),
        { type: 'Agent' as const, id: 'LIST' },
      ],
    }),

    createAgent: builder.mutation<Agent, AgentFormInput>({
      query: (agent) => ({ url: '/agents', method: 'POST', body: toCreateBody(agent) }),
      transformResponse: (wire: AgentWire) => toAgent(wire),
      invalidatesTags: [{ type: 'Agent', id: 'LIST' }],
    }),

    updateAgent: builder.mutation<UpdatedAgent, UpdateAgentPatch>({
      query: ({ id, ...patch }) => ({
        url: `/agents/${id}`,
        method: 'PATCH',
        body: toUpdateBody({ id, ...patch }),
      }),
      transformResponse: (wire: UpdatedAgentWire): UpdatedAgent => ({
        ...toAgent(wire),
        definitionInvalidated: wire.definitionInvalidated ?? false,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Agent', id },
        { type: 'Agent', id: 'LIST' },
      ],
    }),

    deleteAgent: builder.mutation<{ id: string }, string>({
      query: (id) => ({ url: `/agents/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Agent', id: 'LIST' }],
    }),

    /** Almost always answers RUNNING + an evalRunId — poll `getAgentEvaluation`. */
    evaluateAgent: builder.mutation<EvaluationRunWire, EvaluateAgentRequest>({
      query: ({ id, environment }) => ({
        url: `/agents/${id}/evaluate`,
        method: 'POST',
        body: { environment },
      }),
    }),

    /** Poll a run started by `evaluateAgent`. Caller drives the interval and
     * stops once `status` is terminal. */
    getAgentEvaluation: builder.query<EvaluationRunWire, { id: string; evalRunId: string }>({
      query: ({ id, evalRunId }) => ({ url: `/agents/${id}/evaluations/${evalRunId}` }),
    }),

    /** Promote a draft (or already-evaluated agent) to deployed. 403s server-side
     * if the score has not cleared the gate. */
    publishAgent: builder.mutation<Agent, string>({
      query: (id) => ({ url: `/agents/${id}/publish`, method: 'POST' }),
      transformResponse: (wire: AgentWire) => toAgent(wire),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Agent', id },
        { type: 'Agent', id: 'LIST' },
      ],
    }),

    /** Deploy the agent to a set of customers, creating one clone each. */
    cloneAgentToCustomers: builder.mutation<{ ok: true }, CloneAgentRequest>({
      query: ({ agentId, customerIds }) => ({
        url: `/agents/${agentId}/clone`,
        method: 'POST',
        body: { customerIds },
      }),
      transformResponse: () => ({ ok: true as const }),
      invalidatesTags: (_r, _e, { agentId }) => [{ type: 'Agent', id: agentId }],
    }),

    /**
     * One page of an agent's version history, newest first — pinned
     * `sortBy=version&sortOrder=desc` so page 1 is always the version
     * currently in force. Read by both this module's own detail screen (not
     * wired in yet) and the Playground module.
     */
    getAgentVersions: builder.query<
      AgentVersionsPageWire,
      { agentId: string; page?: number; limit?: number }
    >({
      query: ({ agentId, page = 1, limit = AGENT_VERSIONS_PAGE_SIZE }) => ({
        url: `/agents/${agentId}/versions?page=${String(page)}&limit=${String(limit)}&sortBy=version&sortOrder=desc`,
      }),
      providesTags: (_result, _error, { agentId }) => [{ type: 'Agent', id: agentId }],
    }),

    /** Saves a new prompt version — cuts a new row in the history rather than
     * editing one in place. */
    updateAgentPrompt: builder.mutation<AgentVersionWire, UpdateAgentPromptRequest>({
      query: ({ agentId, ...body }) => ({ url: `/agents/${agentId}/prompt`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { agentId }) => [{ type: 'Agent', id: agentId }, { type: 'Agent', id: 'LIST' }],
    }),

    /** Moves the agent onto an existing version. Writes nothing new — a PUT to
     * "which version is current", not a POST that appends a row — so it can be
     * repeated in either direction as often as needed. */
    restoreAgentVersion: builder.mutation<AgentVersionWire, RestoreAgentVersionRequest>({
      query: ({ agentId, version }) => ({ url: `/agents/${agentId}/versions/${version}/current`, method: 'PUT' }),
      invalidatesTags: (_r, _e, { agentId }) => [{ type: 'Agent', id: agentId }, { type: 'Agent', id: 'LIST' }],
    }),

    /* --- Lab -> Model picker, needed by create/edit ------------------------ */

    getLabs: builder.query<Lab[], void>({
      query: () => ({ url: '/labs' }),
    }),

    getLabModels: builder.query<LabModel[], string>({
      query: (labId) => ({ url: `/labs/${labId}/models` }),
    }),

    /** Which lab does a stored `modelSlug` belong to — resolves the edit
     * dialog's Lab field from an agent that only stores the model. */
    lookupLabModel: builder.query<LabModelLookup, string>({
      query: (slug) => ({ url: '/labs/models/lookup', query: { slug } }),
    }),

    /* --- Lightweight lists for the clone-out and knowledge-base pickers ---- */

    /** Every customer, walking pages at the gateway's ceiling — the clone-out
     * checkbox list needs all of them, not a page (see web's `getAllCustomers`). */
    getAllCustomersLite: builder.query<CustomerLite[], void>({
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        type Row = { id: string; name: string };
        const fetchPage = async (page: number) => {
          const result = await baseQuery({ url: '/customers', query: { page, limit: PAGE_SIZE } });
          return result.error
            ? { error: result.error }
            : { data: normalizePage(result.data as Row[] | (Partial<Omit<PageWire<Row>, 'items'>> & { items: Row[] }), PAGE_SIZE) };
        };

        const first = await fetchPage(1);
        if (first.error) return { error: first.error };
        const head = first.data as PageWire<Row>;

        const rest = await Promise.all(
          Array.from({ length: Math.max(0, head.totalPages - 1) }, (_v, i) => fetchPage(i + 2)),
        );
        const failed = rest.find((r) => r.error);
        if (failed?.error) return { error: failed.error };

        const pages = [head, ...rest.map((r) => r.data as PageWire<Row>)];
        return { data: pages.flatMap((p) => p.items.map((c) => ({ id: c.id, name: c.name }))) };
      },
      // Tagged so a write from the Customers module (create/suspend/
      // resume/delete) invalidates this picker too — it's the same
      // `/customers` collection under a lighter shape.
      providesTags: [{ type: 'Customer', id: 'LIST' }],
    }),

    /** Every knowledge base, same reasoning as above. */
    getAllKnowledgeBasesLite: builder.query<KnowledgeBaseLite[], void>({
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        type Row = { id: string; name: string };
        const fetchPage = async (page: number) => {
          const result = await baseQuery({ url: '/knowledge-bases', query: { page, limit: PAGE_SIZE } });
          return result.error
            ? { error: result.error }
            : { data: normalizePage(result.data as Row[] | (Partial<Omit<PageWire<Row>, 'items'>> & { items: Row[] }), PAGE_SIZE) };
        };

        const first = await fetchPage(1);
        if (first.error) return { error: first.error };
        const head = first.data as PageWire<Row>;

        const rest = await Promise.all(
          Array.from({ length: Math.max(0, head.totalPages - 1) }, (_v, i) => fetchPage(i + 2)),
        );
        const failed = rest.find((r) => r.error);
        if (failed?.error) return { error: failed.error };

        const pages = [head, ...rest.map((r) => r.data as PageWire<Row>)];
        return { data: pages.flatMap((p) => p.items.map((k) => ({ id: k.id, name: k.name }))) };
      },
    }),
  }),
});

export const {
  useGetAgentsQuery,
  useCreateAgentMutation,
  useUpdateAgentMutation,
  useDeleteAgentMutation,
  useEvaluateAgentMutation,
  useGetAgentEvaluationQuery,
  usePublishAgentMutation,
  useCloneAgentToCustomersMutation,
  useGetAgentVersionsQuery,
  useUpdateAgentPromptMutation,
  useRestoreAgentVersionMutation,
  useGetLabsQuery,
  useGetLabModelsQuery,
  useLookupLabModelQuery,
  useGetAllCustomersLiteQuery,
  useGetAllKnowledgeBasesLiteQuery,
} = companyAgentsApi;
