/**
 * Usage and credits — RTK Query endpoints, injected into the shared
 * `api` slice. Mirrors gateway-b2b's real route exactly (confirmed
 * against `apps/gateway-b2b/src/app/auth/my-settings/
 * settings.controller.ts`'s `getUsageCredits` and web's own
 * `src/store/api/settings.api.ts`, 2026-09-04): one read, tenant-scoped,
 * no permission guard server-side (see `UsageCreditsScreen`'s own note on
 * why the screen is reachable by anyone but the money inside is
 * permission-gated).
 */

import { api } from '@/store/api';

import type { CreditSummary, UsageCreditsWindow } from './usageCredits.types';

export const usageCreditsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getUsageCredits: builder.query<CreditSummary, UsageCreditsWindow | void>({
      query: (days) => ({ url: '/auth/my-settings/usage-credits', query: days ? { days } : undefined }),
      providesTags: [{ type: 'UsageCredits', id: 'SUMMARY' }],
    }),
  }),
});

export const { useGetUsageCreditsQuery } = usageCreditsApi;
