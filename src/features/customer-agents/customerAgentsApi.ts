/**
 * Customer agents (clones) — RTK Query endpoints, injected into the shared
 * `api` slice. Mirrors the web app's `src/store/api/clones.api.ts` exactly:
 * same URLs, same request/response shapes — confirmed against that source
 * AND against a live `fetch()` of `GET /agents/customer-agents` on
 * 2026-09-01 (see customerAgents.types.ts).
 */

import { api } from '@/store/api';

import type {
  Clone,
  CustomerAgentsPage,
  ListCustomerAgentsArgs,
  PinCloneArgs,
  RecloneCloneArgs,
  UpdateCloneArgs,
  UpdatedClone,
} from './customerAgents.types';

const CLONES_PAGE_SIZE = 10;
/** The gateway's ceiling on `?limit` — matches company-agents' `getAllCustomersLite`. */
const MAX_PAGE_SIZE = 100;

export { CLONES_PAGE_SIZE };

const customerAgentsUrl = (page: number, limit: number) => ({
  url: '/agents/customer-agents',
  query: { page, limit },
});

/** `"Slack, Drive,  order-lookup"` -> `['Slack', 'Drive', 'order-lookup']`. */
const parseTools = (tools: string): string[] =>
  tools
    .split(',')
    .map((tool) => tool.trim())
    .filter(Boolean);

function toCloneUpdateBody(patch: Omit<UpdateCloneArgs, 'id'>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (patch.prompt !== undefined) body.prompt = patch.prompt;
  if (patch.model !== undefined) body.modelSlug = patch.model;
  if (patch.tools !== undefined) body.tools = parseTools(patch.tools);
  if (patch.ver !== undefined) body.clonedFromVersion = patch.ver;
  const note = patch.note?.trim();
  if (note) body.note = note;
  return body;
}

export const customerAgentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /** One page of the tenant's clones — the list screen's All clones tab. */
    getClones: builder.query<CustomerAgentsPage, ListCustomerAgentsArgs>({
      query: ({ page = 1, limit = CLONES_PAGE_SIZE }) => customerAgentsUrl(page, limit),
      providesTags: (result) => [
        ...(result?.items ?? []).map((c) => ({ type: 'Clone' as const, id: c.id })),
        { type: 'Clone' as const, id: 'LIST' },
      ],
    }),

    /**
     * Every clone, assembled from as many pages as it takes. Three things
     * need the whole set rather than a page: the tab counts, the
     * Diverged/Pinned filtered views, and the push planner, which
     * classifies every clone of the chosen master — see web's own
     * `getAllClones` for the same reasoning.
     */
    getAllClones: builder.query<Clone[], void>({
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        const fetchPage = (page: number) => baseQuery(customerAgentsUrl(page, MAX_PAGE_SIZE));

        const first = await fetchPage(1);
        if (first.error) return { error: first.error };
        const head = first.data as CustomerAgentsPage;

        const rest = await Promise.all(
          Array.from({ length: Math.max(0, head.totalPages - 1) }, (_v, i) => fetchPage(i + 2)),
        );
        const failed = rest.find((r) => r.error);
        if (failed?.error) return { error: failed.error };

        const pages = [head, ...rest.map((r) => r.data as CustomerAgentsPage)];
        return { data: pages.flatMap((p) => p.items) };
      },
      providesTags: (result) => [
        ...(result ?? []).map((c) => ({ type: 'Clone' as const, id: c.id })),
        { type: 'Clone' as const, id: 'LIST' },
      ],
    }),

    /** Edit one customer's copy. `div` and `state` are never sent — both are
     * derived server-side against the master's current definition. */
    updateClone: builder.mutation<UpdatedClone, UpdateCloneArgs>({
      query: ({ id, ...patch }) => ({
        url: `/clones/${id}`,
        method: 'PATCH',
        body: toCloneUpdateBody(patch),
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Clone', id },
        { type: 'Clone', id: 'LIST' },
      ],
    }),

    /** Reset one copy to its master's CURRENT definition — resolved
     * server-side, not from whatever this screen happened to load. */
    recloneClone: builder.mutation<UpdatedClone, RecloneCloneArgs>({
      query: ({ id, note }) => ({
        url: `/clones/${id}/reclone`,
        method: 'POST',
        body: note ? { note } : {},
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Clone', id },
        { type: 'Clone', id: 'LIST' },
      ],
    }),

    deleteClone: builder.mutation<{ id: string }, string>({
      query: (id) => ({ url: `/clones/${id}`, method: 'DELETE' }),
      transformResponse: (_r, _m, id) => ({ id }),
      invalidatesTags: [{ type: 'Clone', id: 'LIST' }],
    }),

    /** Pin or unpin a clone. Pinned clones are skipped by master pushes. */
    pinClone: builder.mutation<Clone, PinCloneArgs>({
      query: ({ id, pinned }) => ({
        url: `/clones/${id}/pin`,
        method: 'POST',
        body: { pinned },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Clone', id },
        { type: 'Clone', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetClonesQuery,
  useGetAllClonesQuery,
  useUpdateCloneMutation,
  useRecloneCloneMutation,
  useDeleteCloneMutation,
  usePinCloneMutation,
} = customerAgentsApi;
