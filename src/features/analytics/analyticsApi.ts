/**
 * Analytics — RTK Query endpoints, injected into the shared `api` slice.
 * Mirrors gateway-b2b's real route exactly (confirmed against
 * `apps/gateway-b2b/src/app/auth/my-settings/settings.controller.ts`'s
 * `getAnalytics` and web's own `src/store/api/settings.api.ts`,
 * 2026-09-04): one read, tenant-scoped, no permission guard server-side —
 * see `AnalyticsScreen`'s own note on why the screen is reachable by
 * anyone but the figures inside are permission-gated.
 */

import { api } from '@/store/api';

import type { AnalyticsWindow, UsageAnalytics } from './analytics.types';

export const analyticsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAnalytics: builder.query<UsageAnalytics, AnalyticsWindow | void>({
      query: (days) => ({ url: '/auth/my-settings/analytics', query: days ? { days } : undefined }),
      providesTags: [{ type: 'Analytics', id: 'SUMMARY' }],
    }),
  }),
});

export const { useGetAnalyticsQuery } = analyticsApi;
