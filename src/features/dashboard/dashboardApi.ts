import { api } from '@/store/api';

import type {
  CustomerStatsResponse,
  DashboardResponse,
  LimitsResponse,
  UnreadCountResponse,
} from './dashboard.types';

/**
 * Query params accept ONLY `period` (YYYY-MM) — sending anything else
 * (e.g. tenantId) is a 400 per the backend's whitelist validation pipe.
 */
export const dashboardApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getDashboard: builder.query<DashboardResponse, { period?: string } | void>({
      query: (arg) => ({
        url: '/dashboard',
        method: 'GET',
        query: arg?.period ? { period: arg.period } : undefined,
      }),
      providesTags: ['Dashboard'],
    }),
    getCustomerStats: builder.query<CustomerStatsResponse, void>({
      query: () => ({ url: '/customers/stats', method: 'GET' }),
      providesTags: ['CustomerStats'],
    }),
    /** Owner/admin/finance only (MoneyGuard, gated by role NAME server-side).
     * A 403 here is expected for other roles — callers should skip this
     * query rather than surface the 403 as an error. */
    getLimits: builder.query<LimitsResponse, void>({
      query: () => ({ url: '/limits', method: 'GET' }),
      providesTags: ['Limits'],
    }),
    getUnreadNotificationCount: builder.query<UnreadCountResponse, void>({
      query: () => ({ url: '/notifications/unread-count', method: 'GET' }),
      providesTags: ['Notifications'],
    }),
  }),
});

export const {
  useGetDashboardQuery,
  useGetCustomerStatsQuery,
  useGetLimitsQuery,
  useGetUnreadNotificationCountQuery,
} = dashboardApi;
