/**
 * Organization settings — RTK Query endpoints, injected into the shared
 * `api` slice. Mirrors gateway-b2b's routes exactly (confirmed against
 * `apps/gateway-b2b/src/app/organization/organization.controller.ts` and
 * web's own `src/store/api/organization.api.ts`, 2026-09-04): one read, one
 * write, both behind `billing.view`/`billing.manage`.
 */

import { api } from '@/store/api';

import type { OrganizationPricing, SetCreditRateBody } from './organizationSettings.types';

export const organizationSettingsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /** Every figure is integer pence — see `organizationSettings.types.ts`.
     * `period` degrades to null when the ledger could not be read; the
     * rate itself does not degrade — a failed read here is a real error,
     * shown as the "Pricing is unavailable" state. */
    getOrganizationPricing: builder.query<OrganizationPricing, void>({
      query: () => ({ url: '/organization/pricing' }),
      providesTags: [{ type: 'OrganizationPricing', id: 'RATE_CARD' }],
    }),

    /**
     * Set what this workspace charges for one credit. Applies to the next
     * call only — already-billed usage keeps the rate it was charged at.
     * Returns the whole screen, not just the rate (mirrored in the
     * response type): the period card is a function of consumption as
     * well as price, so re-reading is what stops this app holding figures
     * computed against the rate that was just replaced. The gateway
     * itself does the equivalent re-read server-side; RTK Query's own
     * cache invalidation below achieves the same thing from this side.
     */
    setCreditRate: builder.mutation<OrganizationPricing, SetCreditRateBody>({
      query: (body) => ({ url: '/organization/pricing/credit-rate', method: 'PUT', body }),
      invalidatesTags: [{ type: 'OrganizationPricing', id: 'RATE_CARD' }],
    }),
  }),
});

export const { useGetOrganizationPricingQuery, useSetCreditRateMutation } = organizationSettingsApi;
