import { api } from '@/store/api';

export interface TenantSummaryResponse {
  name: string;
  plan: string | null;
  customerCount: number;
  domain: string | null;
}

/**
 * The sidebar/header identity read — "{Tenant name}" + "{plan} · N
 * customers". Deliberately no permission slug and no AmrGuard server-side,
 * so the shell can render this while onboarding or mid-OTP.
 */
export const tenantApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTenantSummary: builder.query<TenantSummaryResponse, void>({
      query: () => ({ url: '/tenant/summary', method: 'GET' }),
      providesTags: ['TenantSummary'],
    }),
  }),
});

export const { useGetTenantSummaryQuery } = tenantApi;
