/**
 * Branding & domain — RTK Query endpoints, injected into the shared `api`
 * slice. Mirrors gateway-b2b's real routes exactly (confirmed against
 * `apps/gateway-b2b/src/app/{branding/branding.controller.ts,domains/
 * domains.controller.ts}` and web's own `src/store/api/{branding.api.ts,
 * domains.api.ts}`, 2026-09-04).
 *
 * `updateBranding` sends a `FormData` body — the multipart request that
 * carries the palette/font/badge fields plus, when the user picked one, a
 * logo file. This is the app's first multipart write; see the note this
 * added to `httpClient.ts`'s `apiRequest` (skip the JSON `Content-Type`
 * and `JSON.stringify` for a `FormData` body, so RN's own multipart
 * boundary survives) — every other endpoint in the app is unaffected,
 * since none of them ever passed a `FormData` body before.
 */

import { api } from '@/store/api';

import type { AddDomainBody, BrandTheme, Domain } from './branding.types';

export const brandingApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getBranding: builder.query<BrandTheme, void>({
      query: () => ({ url: '/branding' }),
      providesTags: [{ type: 'Branding', id: 'THEME' }],
    }),

    /** `body` is a `FormData`: `palette` (JSON string of `{primary,
     * accent}`), `typography`, `powered` ('true'/'false' — multipart
     * fields are always strings), and optionally `file` (the logo). */
    updateBranding: builder.mutation<BrandTheme, FormData>({
      query: (body) => ({ url: '/branding', method: 'PATCH', body }),
      invalidatesTags: [{ type: 'Branding', id: 'THEME' }],
    }),

    /** A list endpoint with no real pagination need — see
     * `brandingRules.ts`'s `currentDomain`: a workspace has at most one,
     * by product rule rather than by a backend limit. */
    getDomains: builder.query<Domain[], void>({
      query: () => ({ url: '/domains' }),
      providesTags: (result) => [...(result ?? []).map((d) => ({ type: 'Domain' as const, id: d.id })), { type: 'Domain' as const, id: 'LIST' }],
    }),

    /** 400 for an unusable hostname, 409 for one already registered
     * (this tenant's or another's — same message either way). */
    addDomain: builder.mutation<Domain, AddDomainBody>({
      query: (body) => ({ url: '/domains', method: 'POST', body }),
      invalidatesTags: [{ type: 'Domain', id: 'LIST' }],
    }),

    /** Answers 200 even when the check fails — the outcome is
     * `failureReason` in the body and the domain stays PENDING, because
     * the usual cause is DNS that has not propagated. 404 (not this
     * tenant's) and 429 (checked within the last 30s) are the only real
     * rejections; 429 is an expected, silent outcome while polling. */
    verifyDomain: builder.mutation<Domain, string>({
      query: (id) => ({ url: `/domains/${id}/verify`, method: 'POST' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Domain', id }, { type: 'Domain', id: 'LIST' }],
    }),

    /** Traffic stops at once — the gateway drops the routing-cache entry
     * alongside the row, rather than waiting for the cache to expire. */
    removeDomain: builder.mutation<{ id: string }, string>({
      query: (id) => ({ url: `/domains/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Domain', id: 'LIST' }],
    }),
  }),
});

export const { useGetBrandingQuery, useUpdateBrandingMutation, useGetDomainsQuery, useAddDomainMutation, useVerifyDomainMutation, useRemoveDomainMutation } = brandingApi;
