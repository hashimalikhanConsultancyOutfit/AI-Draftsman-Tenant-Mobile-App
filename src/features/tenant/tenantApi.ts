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
/**
 * `POST /tenant/delete` — closing the workspace.
 *
 * ── THIS IS NOT "DELETE MY ACCOUNT" ─────────────────────────────────────────
 * The route closes the whole TENANT, not the caller's personal account: the
 * workspace goes `TERMINATED`, every member is locked out on their next
 * request, every live API key is revoked, and the Stripe subscription is
 * cancelled at period end. It is owner-only, decided from the membership row
 * rather than the token, so a demoted owner's still-valid session cannot
 * close anything. The caller's own session cookie is cleared by the response.
 *
 * Soft, not erased: rows stay in the database behind the TERMINATED status and
 * a platform admin can restore the workspace. The confirmation copy therefore
 * promises loss of access, not incineration of every byte.
 *
 * ── WHY THE BODY IS EMPTY HERE ──────────────────────────────────────────────
 * Identity comes off the verified session, so a token and `{}` are a complete
 * request. `confirmName` / `confirmEmail` exist for a client that asks a human
 * to retype one — neither is a selector, and a mismatch is a 400. The mobile
 * flow gates on a native confirm dialog instead, which is what the route's own
 * documentation anticipates ("a mobile app own its own confirmation screen and
 * then just call this").
 */
export interface TenantDeleteResponse {
  id: string;
  status: string;
}

export const tenantApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTenantSummary: builder.query<TenantSummaryResponse, void>({
      query: () => ({ url: '/tenant/summary', method: 'GET' }),
      providesTags: ['TenantSummary'],
    }),

    deleteTenant: builder.mutation<TenantDeleteResponse, void>({
      query: () => ({ url: '/tenant/delete', method: 'POST', body: {} }),
      /*
       * No `invalidatesTags`. Every cached read belongs to a workspace that no
       * longer admits anyone, and the caller is signed out immediately after
       * this resolves — refetching on the way out would fire a burst of
       * requests the gateway now refuses. `logout()` purges the whole api
       * slice, which is the correct teardown.
       */
    }),
  }),
});

export const { useGetTenantSummaryQuery, useDeleteTenantMutation } = tenantApi;
