/**
 * API keys — RTK Query endpoints, injected into the shared `api` slice.
 * Mirrors the gateway's real controllers exactly (confirmed against
 * `apps/gateway-b2b/src/app/api-keys/{api-keys,key-policies}.controller.ts`
 * on 2026-09-03), not the web repo's mock `baseApi` used by its other 19
 * features — this is the one web slice that already talks to a real
 * backend, and this file ports its request shapes, not its plumbing.
 *
 * Neither `GET /keys` nor `GET /key-policies` takes page/limit — both
 * return every row the tenant owns, filtered in Postgres. So, unlike
 * Reports/Leads, there is no growing-list pagination here: the query just
 * refetches on filter change and pull-to-refresh.
 */

import { api } from '@/store/api';

import type {
  ApiKey,
  ApiKeyListParams,
  CreateApiKeyBody,
  CreateKeyPolicyBody,
  IssuedApiKey,
  KeyPolicy,
  KeyPolicyListParams,
  KeyUsage,
  KeyUsageParams,
  RotatedApiKey,
  UpdateApiKeyBody,
  UpdateKeyPolicyBody,
} from './apiKeys.types';

function keysQuery(params: ApiKeyListParams) {
  const query: Record<string, string | boolean> = {};
  if (params.search) query.search = params.search;
  if (params.environment) query.environment = params.environment;
  if (params.status) query.status = params.status;
  if (params.policyId) query.policyId = params.policyId;
  if (params.customerId) query.customerId = params.customerId;
  if (params.includeRevoked !== undefined) query.includeRevoked = params.includeRevoked;
  return query;
}

function policiesQuery(params: KeyPolicyListParams) {
  const query: Record<string, string | boolean> = {};
  if (params.search) query.search = params.search;
  if (params.scopeType) query.scopeType = params.scopeType;
  if (params.allowTraining !== undefined) query.allowTraining = params.allowTraining;
  return query;
}

export const apiKeysApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getApiKeys: builder.query<ApiKey[], ApiKeyListParams | void>({
      query: (params) => ({ url: '/keys', query: keysQuery(params ?? {}) }),
      providesTags: (result) => [
        ...(result ?? []).map((k) => ({ type: 'ApiKey' as const, id: k.id })),
        { type: 'ApiKey' as const, id: 'LIST' },
      ],
    }),

    /** A single key, by id — used to seed the edit form: the registry's own
     * query may be filtered to a status/search that no longer matches the
     * row being edited. */
    getApiKey: builder.query<ApiKey, string>({
      query: (id) => ({ url: `/keys/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'ApiKey', id }],
    }),

    getApiKeyUsage: builder.query<KeyUsage, KeyUsageParams>({
      query: ({ id, days }) => ({ url: `/keys/${id}/usage`, query: days ? { days } : {} }),
      providesTags: (_r, _e, { id }) => [{ type: 'ApiKey', id: `usage-${id}` }],
    }),

    /** Issues a live key and returns its secret ONCE, in this response body.
     * Nothing about the secret is ever cached — only `apiKey` (the record
     * without the secret) is tag-invalidated into the list. */
    createApiKey: builder.mutation<IssuedApiKey, CreateApiKeyBody>({
      query: (body) => ({ url: '/keys', method: 'POST', body }),
      invalidatesTags: [{ type: 'ApiKey', id: 'LIST' }],
    }),

    updateApiKey: builder.mutation<ApiKey, UpdateApiKeyBody>({
      query: ({ id, ...body }) => ({ url: `/keys/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'ApiKey', id }, { type: 'ApiKey', id: 'LIST' }],
    }),

    /** Same shape as issue, plus `previousValidUntil` — the old secret
     * verifies for one more hour, fixed, not configurable. */
    rotateApiKey: builder.mutation<RotatedApiKey, string>({
      query: (id) => ({ url: `/keys/${id}/rotate`, method: 'POST' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'ApiKey', id }, { type: 'ApiKey', id: 'LIST' }],
    }),

    /** A revoke, not a delete — the row stays, `status` becomes REVOKED. */
    revokeApiKey: builder.mutation<ApiKey, string>({
      query: (id) => ({ url: `/keys/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'ApiKey', id }, { type: 'ApiKey', id: 'LIST' }],
    }),

    getKeyPolicies: builder.query<KeyPolicy[], KeyPolicyListParams | void>({
      query: (params) => ({ url: '/key-policies', query: policiesQuery(params ?? {}) }),
      providesTags: (result) => [
        ...(result ?? []).map((p) => ({ type: 'KeyPolicy' as const, id: p.id })),
        { type: 'KeyPolicy' as const, id: 'LIST' },
      ],
    }),

    /** Unfiltered subscription used to populate the key form's policy
     * picker — same reasoning as the registry's own search box never
     * narrowing what a NEW key can be issued against (matches web). */
    getKeyPolicy: builder.query<KeyPolicy, string>({
      query: (id) => ({ url: `/key-policies/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'KeyPolicy', id }],
    }),

    createKeyPolicy: builder.mutation<KeyPolicy, CreateKeyPolicyBody>({
      query: (body) => ({ url: '/key-policies', method: 'POST', body }),
      invalidatesTags: [{ type: 'KeyPolicy', id: 'LIST' }],
    }),

    updateKeyPolicy: builder.mutation<KeyPolicy, UpdateKeyPolicyBody>({
      query: ({ id, ...body }) => ({ url: `/key-policies/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'KeyPolicy', id },
        { type: 'KeyPolicy', id: 'LIST' },
        /* A policy edit changes what every key on it displays (cap, rpm,
         * tpm, scope) — the keys list embeds the full policy object. */
        { type: 'ApiKey', id: 'LIST' },
      ],
    }),

    /** Refused with 409 while any key — including revoked ones — still
     * references the policy; the server names the count. */
    deleteKeyPolicy: builder.mutation<{ id: string }, string>({
      query: (id) => ({ url: `/key-policies/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'KeyPolicy', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetApiKeysQuery,
  useGetApiKeyQuery,
  useGetApiKeyUsageQuery,
  useCreateApiKeyMutation,
  useUpdateApiKeyMutation,
  useRotateApiKeyMutation,
  useRevokeApiKeyMutation,
  useGetKeyPoliciesQuery,
  useGetKeyPolicyQuery,
  useCreateKeyPolicyMutation,
  useUpdateKeyPolicyMutation,
  useDeleteKeyPolicyMutation,
} = apiKeysApi;
