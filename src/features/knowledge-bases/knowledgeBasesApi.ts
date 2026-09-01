/**
 * Knowledge bases — RTK Query endpoints, injected into the shared `api`
 * slice. Mirrors the web app's `src/store/api/knowledgeBases.api.ts` exactly:
 * same URLs, same wire<->UI mapping (`toKnowledgeBase`, `toRelative`,
 * `toFreshness`) — confirmed against that source on 2026-09-01.
 */

import { api } from '@/store/api';

import type {
  AddKnowledgeBaseDocumentsArgs,
  CreateKnowledgeBaseArgs,
  CreateUploadIntentArgs,
  DeleteKnowledgeBaseDocumentArgs,
  DeleteKnowledgeBaseDocumentResult,
  KbFreshness,
  KbScope,
  KbSourceInput,
  KnowledgeBase,
  KnowledgeBaseDocumentsPage,
  KnowledgeBasePage,
  ListKnowledgeBaseDocumentsArgs,
  ListKnowledgeBasesArgs,
  PresignedUploadCredential,
  UpdateKnowledgeBaseArgs,
  UpdateKnowledgeBaseDocumentArgs,
} from './knowledgeBases.types';

const KB_PAGE_SIZE = 20;
/** The gateway's ceiling on `?limit`, same as company-agents' lite pickers. */
const MAX_PAGE_SIZE = 100;

export { KB_PAGE_SIZE };

interface PageWire<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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

/** Wire shape — `GET /knowledge-bases` and friends. */
interface KnowledgeBaseWire {
  id: string;
  name: string;
  scope: 'COMPANY_WIDE' | 'COMPANY' | 'AGENT' | 'CUSTOMER';
  scopeId?: string | null;
  sourceUrls?: Array<{ id: string; url: string }>;
  agentIds?: string[];
  agents?: Array<{ id: string; name: string }>;
  lastIndexedAt: string | null;
  createdAt: string;
  _count?: { documents: number };
  docCount?: number;
  freshness?: 'FRESH' | 'STALE' | 'EMPTY';
  creator?: { id: string; name: string | null } | null;
}

const SCOPE_LABELS: Record<KnowledgeBaseWire['scope'], KbScope> = {
  COMPANY: 'Internal',
  COMPANY_WIDE: 'Internal',
  AGENT: 'Agent',
  CUSTOMER: 'Customer',
};

const SCOPE_VALUES: Record<KbScope, 'COMPANY_WIDE' | 'AGENT' | 'CUSTOMER'> = {
  Internal: 'COMPANY_WIDE',
  Agent: 'AGENT',
  Customer: 'CUSTOMER',
};

const STALE_AFTER_DAYS = 7;
const DAY_MS = 86_400_000;

/** `lastIndexedAt` -> the relative string the row shows. */
const toRelative = (iso: string | null): string => {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${String(days)} days ago`;
};

/** Empty is not the same as stale — a stale base has documents that need
 * re-indexing, an empty one has nothing to serve at all. */
const toFreshness = (wire: KnowledgeBaseWire): KbFreshness => {
  if (wire.freshness) return wire.freshness.toLowerCase() as KbFreshness;
  if ((wire._count?.documents ?? wire.docCount ?? 0) === 0) return 'empty';
  if (!wire.lastIndexedAt) return 'stale';
  const days = (Date.now() - new Date(wire.lastIndexedAt).getTime()) / DAY_MS;
  return days > STALE_AFTER_DAYS ? 'stale' : 'fresh';
};

const toKnowledgeBase = (wire: KnowledgeBaseWire): KnowledgeBase => {
  const agents = wire.agents ?? [];
  const agentIds = wire.agentIds ?? agents.map((a) => a.id);
  const sourceUrls = wire.sourceUrls ?? [];
  const urls = sourceUrls.map((s) => s.url);

  return {
    id: wire.id,
    name: wire.name,
    scope: SCOPE_LABELS[wire.scope],
    scopeId: agents.map((a) => a.name).join(', '),
    agentIds,
    agents,
    sourceUrls,
    src: urls.join(', ') || '—',
    docs: wire._count?.documents ?? wire.docCount ?? 0,
    idx: toRelative(wire.lastIndexedAt),
    fresh: toFreshness(wire),
    creator: wire.creator ?? null,
  };
};

interface KnowledgeBaseWriteBody {
  name?: string;
  scope?: 'COMPANY_WIDE' | 'AGENT' | 'CUSTOMER';
  sourceUrls?: KbSourceInput[];
  agentIds?: string[];
}

const knowledgeBasesUrl = (page: number, limit: number) => ({
  url: '/knowledge-bases',
  query: { page, limit },
});

export const knowledgeBasesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /** One page of the tenant's bases — the list screen's pager. */
    getKnowledgeBases: builder.query<KnowledgeBasePage, ListKnowledgeBasesArgs | void>({
      query: (args) => knowledgeBasesUrl(args?.page ?? 1, args?.limit ?? KB_PAGE_SIZE),
      transformResponse: (response: KnowledgeBaseWire[] | (Partial<Omit<PageWire<KnowledgeBaseWire>, 'items'>> & { items: KnowledgeBaseWire[] }), _meta, arg) => {
        const wire = normalizePage(response, arg?.limit ?? KB_PAGE_SIZE);
        return { items: wire.items.map(toKnowledgeBase), total: wire.total, page: wire.page, limit: wire.limit, totalPages: wire.totalPages };
      },
      providesTags: (result) => [
        ...(result?.items ?? []).map((kb) => ({ type: 'KnowledgeBase' as const, id: kb.id })),
        { type: 'KnowledgeBase' as const, id: 'LIST' },
      ],
    }),

    /** Every base — the agent-form picker needs the whole set, same
     * reasoning as `getAllClones`/`getAllCustomersLite`. */
    getAllKnowledgeBases: builder.query<KnowledgeBase[], void>({
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        const fetchPage = async (page: number) => {
          const result = await baseQuery(knowledgeBasesUrl(page, MAX_PAGE_SIZE));
          return result.error ? { error: result.error } : { data: normalizePage(result.data as KnowledgeBaseWire[] | (Partial<Omit<PageWire<KnowledgeBaseWire>, 'items'>> & { items: KnowledgeBaseWire[] }), MAX_PAGE_SIZE) };
        };

        const first = await fetchPage(1);
        if (first.error) return { error: first.error };
        const head = first.data as PageWire<KnowledgeBaseWire>;

        const rest = await Promise.all(
          Array.from({ length: Math.max(0, head.totalPages - 1) }, (_v, i) => fetchPage(i + 2)),
        );
        const failed = rest.find((r) => r.error);
        if (failed?.error) return { error: failed.error };

        const pages = [head, ...rest.map((r) => r.data as PageWire<KnowledgeBaseWire>)];
        return { data: pages.flatMap((p) => p.items.map(toKnowledgeBase)) };
      },
      providesTags: (result) => [
        ...(result ?? []).map((kb) => ({ type: 'KnowledgeBase' as const, id: kb.id })),
        { type: 'KnowledgeBase' as const, id: 'LIST' },
      ],
    }),

    getKnowledgeBase: builder.query<KnowledgeBase, string>({
      query: (id) => ({ url: `/knowledge-bases/${id}` }),
      transformResponse: (response: KnowledgeBaseWire) => toKnowledgeBase(response),
      providesTags: (_r, _e, id) => [{ type: 'KnowledgeBase', id }],
    }),

    getKnowledgeBaseDocuments: builder.query<KnowledgeBaseDocumentsPage, ListKnowledgeBaseDocumentsArgs>({
      query: ({ id, page = 1, limit = 10 }) => ({ url: `/knowledge-bases/${id}/documents`, query: { page, limit } }),
      providesTags: (_r, _e, { id }) => [{ type: 'KnowledgeBase', id: `DOCUMENTS:${id}` }],
    }),

    createKnowledgeBase: builder.mutation<KnowledgeBase, CreateKnowledgeBaseArgs>({
      query: (body) => ({
        url: '/knowledge-bases',
        method: 'POST',
        body: { name: body.name, scope: SCOPE_VALUES[body.scope], sourceUrls: body.sourceUrls, agentIds: body.agentIds } satisfies KnowledgeBaseWriteBody,
      }),
      transformResponse: (response: KnowledgeBaseWire) => toKnowledgeBase(response),
      invalidatesTags: [{ type: 'KnowledgeBase', id: 'LIST' }],
    }),

    updateKnowledgeBase: builder.mutation<KnowledgeBase, UpdateKnowledgeBaseArgs>({
      query: ({ id, ...patch }) => ({
        url: `/knowledge-bases/${id}`,
        method: 'PATCH',
        body: { name: patch.name, scope: SCOPE_VALUES[patch.scope], sourceUrls: patch.sourceUrls, agentIds: patch.agentIds } satisfies KnowledgeBaseWriteBody,
      }),
      transformResponse: (response: KnowledgeBaseWire) => toKnowledgeBase(response),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'KnowledgeBase', id }, { type: 'KnowledgeBase', id: 'LIST' }],
    }),

    deleteKnowledgeBase: builder.mutation<{ id: string }, string>({
      query: (id) => ({ url: `/knowledge-bases/${id}`, method: 'DELETE' }),
      transformResponse: (_r, _m, id) => ({ id }),
      invalidatesTags: [{ type: 'KnowledgeBase', id: 'LIST' }],
    }),

    /** Re-crawl the sources and rebuild the index. */
    reindexKnowledgeBase: builder.mutation<KnowledgeBase, string>({
      query: (id) => ({ url: `/knowledge-bases/${id}/reindex`, method: 'POST' }),
      transformResponse: (response: KnowledgeBaseWire) => toKnowledgeBase(response),
      invalidatesTags: (_r, _e, id) => [{ type: 'KnowledgeBase', id }, { type: 'KnowledgeBase', id: 'LIST' }],
    }),

    /** Presign a single upload slot — the browser (here, the device) PUTs
     * bytes straight to Azure with this credential; the app never sees the
     * storage key. */
    createKnowledgeBaseUploadIntent: builder.mutation<PresignedUploadCredential, CreateUploadIntentArgs>({
      query: (body) => ({ url: '/knowledge-bases/uploads/presigned-upload', method: 'POST', body }),
    }),

    /** Register documents already sitting in storage (an upload's blobUrl)
     * or a public link (source `CRAWL`) against a base. Queues re-indexing. */
    addKnowledgeBaseDocuments: builder.mutation<KnowledgeBase, AddKnowledgeBaseDocumentsArgs>({
      query: ({ id, documents }) => ({ url: `/knowledge-bases/${id}/documents`, method: 'POST', body: { documents } }),
      transformResponse: (response: KnowledgeBaseWire) => toKnowledgeBase(response),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'KnowledgeBase', id }, { type: 'KnowledgeBase', id: `DOCUMENTS:${id}` }, { type: 'KnowledgeBase', id: 'LIST' }],
    }),

    /** Swap the file behind an existing document row, keeping its id and
     * reference — see `handleReplaceDocument` on the web hook for why this
     * is not delete-then-upload. */
    updateKnowledgeBaseDocument: builder.mutation<{ knowledgeBase: KnowledgeBase }, UpdateKnowledgeBaseDocumentArgs>({
      query: ({ id, documentId, ...body }) => ({ url: `/knowledge-bases/${id}/documents/${documentId}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'KnowledgeBase', id }, { type: 'KnowledgeBase', id: `DOCUMENTS:${id}` }, { type: 'KnowledgeBase', id: 'LIST' }],
    }),

    deleteKnowledgeBaseDocument: builder.mutation<DeleteKnowledgeBaseDocumentResult, DeleteKnowledgeBaseDocumentArgs>({
      query: ({ id, documentId }) => ({ url: `/knowledge-bases/${id}/documents/${documentId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'KnowledgeBase', id }, { type: 'KnowledgeBase', id: `DOCUMENTS:${id}` }, { type: 'KnowledgeBase', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetKnowledgeBasesQuery,
  useGetAllKnowledgeBasesQuery,
  useGetKnowledgeBaseQuery,
  useGetKnowledgeBaseDocumentsQuery,
  useCreateKnowledgeBaseMutation,
  useUpdateKnowledgeBaseMutation,
  useDeleteKnowledgeBaseMutation,
  useReindexKnowledgeBaseMutation,
  useCreateKnowledgeBaseUploadIntentMutation,
  useAddKnowledgeBaseDocumentsMutation,
  useUpdateKnowledgeBaseDocumentMutation,
  useDeleteKnowledgeBaseDocumentMutation,
} = knowledgeBasesApi;
