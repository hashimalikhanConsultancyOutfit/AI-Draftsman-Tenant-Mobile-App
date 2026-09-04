/**
 * Usage & spend — RTK Query endpoint, injected into the shared `api`
 * slice. Mirrors gateway-b2b's real route exactly (confirmed against
 * `apps/gateway-b2b/src/app/usage/usage.controller.ts` and web's own
 * `src/store/api/usage.api.ts`, 2026-09-04).
 *
 * One cache entry per dimension (`providesTags` keys on it), so
 * switching tabs does not refetch a tab already loaded — the same
 * reasoning web's own comment gives. Nothing ever invalidates this tag:
 * usage is server-derived and no mutation in this app can alter it,
 * exactly as web's own comment states; the tag exists for consistency
 * with every other feature slice, not because a write here needs it.
 */
import { api } from '@/store/api';

import type { UsageQueryArgs, UsageResponse } from './usageSpend.types';

export const usageSpendApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getUsage: builder.query<UsageResponse, UsageQueryArgs>({
      query: ({ dimension, period }) => ({
        url: '/usage',
        query: { dimension, ...(period ? { period } : {}) },
      }),
      providesTags: (_r, _e, { dimension }) => [{ type: 'Usage', id: `usage-${dimension}` }],
    }),
  }),
});

export const { useGetUsageQuery } = usageSpendApi;
