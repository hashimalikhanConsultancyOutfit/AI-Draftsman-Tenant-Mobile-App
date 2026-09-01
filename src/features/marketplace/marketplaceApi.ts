/**
 * Marketplace module — RTK Query endpoints, injected into the shared `api`
 * slice (unlike web, which used two separate `createApi` instances for
 * connectors and marketplace — this app has one baseQuery, so one shared
 * instance is simpler and lets a marketplace-agent clone invalidate the
 * `Agent` tag directly instead of a cross-instance dispatch).
 */
import { api } from '@/store/api';

import { CONNECTOR_MAX_TAKE } from './marketplaceRules';
import type {
  Connector,
  ConnectorInstall,
  ConnectorListParams,
  ConnectorListResponse,
  CreateSkillPayload,
  MarketplaceAgent,
  MarketplaceCategory,
  MarketplaceListParams,
  MarketplaceListResponse,
  MarketplaceSkill,
  RemoveConnectorInstallResponse,
  StartConnectorOAuthArgs,
  StartConnectorOAuthResponse,
  TenantAgent,
  TenantSkill,
} from './marketplace.types';

function connectorQuery(params: ConnectorListParams) {
  const query: Record<string, string | number> = {};
  if (params.status) query.status = params.status;
  if (params.category) query.category = params.category;
  if (params.search) query.search = params.search;
  if (params.skip !== undefined) query.skip = params.skip;
  if (params.take !== undefined) query.take = params.take;
  return query;
}

function listQuery(params: MarketplaceListParams) {
  const query: Record<string, string | number> = {};
  if (params.page !== undefined) query.page = params.page;
  if (params.limit !== undefined) query.limit = params.limit;
  if (params.search) query.search = params.search;
  return query;
}

export const marketplaceApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * `GET /connectors` — the gateway hard-caps `take` at 200/request. A
     * caller (Discover) can ask for far more than that, so this fires the
     * first chunk alone to learn `total`, then fires every remaining
     * 200-row chunk in parallel and concatenates — a single synthetic
     * envelope so callers page as if it were one response. Mirrors web's
     * `getConnectors` queryFn exactly.
     */
    getConnectors: builder.query<ConnectorListResponse, ConnectorListParams>({
      async queryFn(params, _api, _extraOptions, baseQuery) {
        const requestedSkip = params.skip ?? 0;
        const requestedTake = params.take ?? 50;
        const firstTake = Math.min(CONNECTOR_MAX_TAKE, requestedTake);
        const first = await baseQuery({ url: '/connectors', query: connectorQuery({ ...params, skip: requestedSkip, take: firstTake }) });
        if (first.error) return { error: first.error };
        const head = first.data as ConnectorListResponse;

        const fillable = Math.max(0, Math.min(requestedTake, head.total - requestedSkip));
        const remaining = fillable - head.data.length;
        if (remaining <= 0) {
          return { data: { total: head.total, skip: requestedSkip, take: requestedTake, data: head.data } };
        }

        const chunkCount = Math.ceil(remaining / CONNECTOR_MAX_TAKE);
        const chunks = await Promise.all(
          Array.from({ length: chunkCount }, (_v, i) => {
            const chunkSkip = requestedSkip + head.data.length + i * CONNECTOR_MAX_TAKE;
            return baseQuery({ url: '/connectors', query: connectorQuery({ ...params, skip: chunkSkip, take: CONNECTOR_MAX_TAKE }) });
          }),
        );
        const failed = chunks.find((c) => c.error);
        if (failed?.error) return { error: failed.error };

        const rest = chunks.flatMap((c) => (c.data as ConnectorListResponse).data);
        return { data: { total: head.total, skip: requestedSkip, take: requestedTake, data: [...head.data, ...rest] } };
      },
      providesTags: (result) => [
        ...(result?.data ?? []).map((c) => ({ type: 'Connector' as const, id: c.id })),
        { type: 'Connector' as const, id: 'LIST' },
      ],
      keepUnusedDataFor: 60,
    }),

    getConnector: builder.query<Connector, string>({
      query: (slug) => ({ url: `/connectors/${slug}` }),
      providesTags: (_r, _e, slug) => [{ type: 'Connector', id: slug }],
    }),

    /** No `invalidatesTags` — deliberately. The redirect this kicks off
     * tears the whole app down (web) / hands off to the system browser
     * (mobile); the new install simply appears when `getConnectorInstalls`
     * is refetched on return, which the catalogue screen does on focus. */
    startConnectorOAuth: builder.mutation<StartConnectorOAuthResponse, StartConnectorOAuthArgs>({
      query: ({ slug, ...body }) => ({ url: `/connectors/${slug}/oauth/authorize`, method: 'POST', body }),
    }),

    getConnectorInstalls: builder.query<ConnectorInstall[], void>({
      query: () => ({ url: '/connector-installs' }),
      providesTags: (result) => [
        ...(result ?? []).map((i) => ({ type: 'ConnectorInstall' as const, id: i.id })),
        { type: 'ConnectorInstall' as const, id: 'LIST' },
      ],
    }),

    removeConnectorInstall: builder.mutation<RemoveConnectorInstallResponse, string>({
      query: (id) => ({ url: `/connector-installs/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'ConnectorInstall', id },
        { type: 'ConnectorInstall', id: 'LIST' },
      ],
    }),

    getSkillCategories: builder.query<MarketplaceCategory[], void>({
      query: () => ({ url: '/skill-categories', query: { limit: 100 } }),
      transformResponse: (response: MarketplaceCategory[] | { items: MarketplaceCategory[] }) => (Array.isArray(response) ? response : response.items),
      providesTags: [{ type: 'SkillCategory', id: 'LIST' }],
    }),

    getAgentCategories: builder.query<MarketplaceCategory[], void>({
      query: () => ({ url: '/agent-categories', query: { limit: 100 } }),
      transformResponse: (response: MarketplaceCategory[] | { items: MarketplaceCategory[] }) => (Array.isArray(response) ? response : response.items),
      providesTags: [{ type: 'AgentCategory', id: 'LIST' }],
    }),

    getSkills: builder.query<MarketplaceListResponse<MarketplaceSkill>, MarketplaceListParams>({
      query: (params) => ({ url: '/skill-marketplace', query: listQuery(params) }),
      providesTags: (result) => [
        ...(result?.items ?? []).map((s) => ({ type: 'MarketplaceSkill' as const, id: s.id })),
        { type: 'MarketplaceSkill' as const, id: 'LIST' },
      ],
    }),

    getSkill: builder.query<MarketplaceSkill, string>({
      query: (id) => ({ url: `/skill-marketplace/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'MarketplaceSkill', id }],
    }),

    /** Publishes to the PLATFORM-WIDE catalogue every tenant browses —
     * there is no tenant-scoped create endpoint. Only "Add skill" (the
     * publish-then-clone dance) uses this directly. */
    createSkill: builder.mutation<MarketplaceSkill, CreateSkillPayload>({
      query: (body) => ({ url: '/skill-marketplace', method: 'POST', body }),
      invalidatesTags: [{ type: 'MarketplaceSkill', id: 'LIST' }],
    }),

    /** No body. Idempotent — a repeat clone returns the existing row (201)
     * rather than erroring. No `invalidatesTags`: the copy lands in a tier
     * this slice doesn't cache (tracked in marketplaceClonesSlice instead). */
    cloneSkill: builder.mutation<TenantSkill, string>({
      query: (id) => ({ url: `/skill-marketplace/${id}/clone`, method: 'POST' }),
    }),

    getMarketplaceAgents: builder.query<MarketplaceListResponse<MarketplaceAgent>, MarketplaceListParams>({
      query: (params) => ({ url: '/agent-marketplace', query: listQuery(params) }),
      providesTags: (result) => [
        ...(result?.items ?? []).map((a) => ({ type: 'MarketplaceAgent' as const, id: a.id })),
        { type: 'MarketplaceAgent' as const, id: 'LIST' },
      ],
    }),

    getMarketplaceAgent: builder.query<MarketplaceAgent, string>({
      query: (id) => ({ url: `/agent-marketplace/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'MarketplaceAgent', id }],
    }),

    /** No body, idempotent, creates a REAL runnable `b2b_agent` row (DRAFT
     * v1, default model, no tools) — the exact same row `POST /agents`
     * creates, so it appears on `GET /agents` immediately. Invalidating
     * the `Agent` tag here is what makes it show up there without a
     * manual refetch. */
    cloneAgent: builder.mutation<TenantAgent, string>({
      query: (id) => ({ url: `/agent-marketplace/${id}/clone`, method: 'POST' }),
      invalidatesTags: [{ type: 'Agent', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetConnectorsQuery,
  useGetConnectorQuery,
  useStartConnectorOAuthMutation,
  useGetConnectorInstallsQuery,
  useRemoveConnectorInstallMutation,
  useGetSkillCategoriesQuery,
  useGetAgentCategoriesQuery,
  useGetSkillsQuery,
  useGetSkillQuery,
  useCreateSkillMutation,
  useCloneSkillMutation,
  useGetMarketplaceAgentsQuery,
  useGetMarketplaceAgentQuery,
  useCloneAgentMutation,
} = marketplaceApi;
