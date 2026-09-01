/**
 * Customers — RTK Query endpoints, ported from the web app's
 * `src/store/api/customers.api.ts` (confirmed against that source, see the
 * research this port was built from). Injected into the shared `api`
 * slice, same convention as every other feature.
 *
 * Note: `GET /customers/stats` is ALREADY fetched by
 * `dashboardApi.useGetCustomerStatsQuery` (src/features/dashboard/
 * dashboardApi.ts) — the exact same endpoint the web Customers screen
 * hits for its stat tiles. Rather than inject a second endpoint against
 * the same URL (a second cache entry for identical data), the Customers
 * screen reuses that hook directly and maps its response through
 * `toCustomerStats` in customersRules.ts. This file's mutations still
 * invalidate the `CustomerStats` tag so that dashboard tile — and this
 * screen's own stats row — refresh together after any write here.
 */
import { api } from '@/store/api';
import { newIdempotencyKey } from '@/utils/ids';

import type {
  CreateCustomerInput,
  CreateCustomerWire,
  Customer,
  CustomerListParams,
  CustomerListWire,
  CustomerPage,
  CustomerStatusWire,
  CustomerWire,
  UpdateCustomerInput,
  UpdateCustomerWire,
} from './customers.types';

const toPounds = (cents: number | null | undefined): number | null => (typeof cents === 'number' ? cents / 100 : null);

function toState(wire: CustomerWire): Customer['state'] {
  if (wire.status === 'SUSPENDED') return 'suspended';
  return (wire.quotaUsedPct ?? 0) >= 100 ? 'quota hit' : 'active';
}

export function toCustomer(wire: CustomerWire): Customer {
  return {
    id: wire.id,
    createdAt: wire.createdAt,
    updatedAt: wire.updatedAt,
    name: wire.name,
    externalId: wire.externalId ?? '',
    email: wire.email,
    agents: wire.agentCount ?? 0,
    quota: wire.quotaUsedPct ?? null,
    quotaMonthly: wire.quotaMonthly ?? null,
    price: toPounds(wire.sellPricePerRunCents),
    spend: toPounds(wire.spendCents),
    state: toState(wire),
    showQuotaToCustomer: wire.showQuotaToCustomer,
    portalAccessEnabled: wire.portalAccessEnabled,
    suspendReason: wire.suspendReason,
  };
}

function toCustomerPage(wire: CustomerListWire): CustomerPage {
  return { items: wire.items.map(toCustomer), total: wire.total, page: wire.page, limit: wire.limit, totalPages: wire.totalPages };
}

/** Key-by-key rather than a spread — omitting a falsy/blank optional field
 * is the only way to say "leave it to the gateway default", and the
 * gateway's `forbidNonWhitelisted` rejects any extra key outright. */
function toCreateBody(input: CreateCustomerInput): CreateCustomerWire {
  const body: CreateCustomerWire = {
    name: input.name,
    email: input.email,
    registeredVia: 'REST_API',
    showQuotaToCustomer: input.showQuotaToCustomer,
    portalAccessEnabled: input.portalAccessEnabled,
  };
  if (input.quotaMonthly !== null) body.quotaMonthly = input.quotaMonthly;
  return body;
}

function toUpdateBody(input: UpdateCustomerInput): UpdateCustomerWire {
  const body: UpdateCustomerWire = {
    name: input.name,
    email: input.email,
    showQuotaToCustomer: input.showQuotaToCustomer,
    portalAccessEnabled: input.portalAccessEnabled,
  };
  if (input.quotaMonthly !== null) body.quotaMonthly = input.quotaMonthly;
  return body;
}

function listQuery(params: CustomerListParams) {
  const query: Record<string, string | number> = {};
  if (params.page !== undefined) query.page = params.page;
  if (params.limit !== undefined) query.limit = params.limit;
  if (params.status) query.status = params.status;
  if (params.q) query.q = params.q;
  return query;
}

export const customersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /** `GET /customers` — paginated. `q` is the search param name, never
     * `search` (a 400). */
    getCustomers: builder.query<CustomerPage, CustomerListParams>({
      query: (params) => ({ url: '/customers', query: listQuery(params) }),
      transformResponse: (response: CustomerListWire) => toCustomerPage(response),
      providesTags: (result) => [
        ...(result?.items ?? []).map((c) => ({ type: 'Customer' as const, id: c.id })),
        { type: 'Customer' as const, id: 'LIST' },
      ],
    }),

    /** `GET /customers/:id` — a fresh re-read for the detail screen,
     * deliberately not just reusing the row already in the list cache
     * (the row can be a page or two stale). */
    getCustomer: builder.query<Customer, string>({
      query: (id) => ({ url: `/customers/${id}` }),
      transformResponse: (response: CustomerWire) => toCustomer(response),
      providesTags: (_r, _e, id) => [{ type: 'Customer', id }],
    }),

    createCustomer: builder.mutation<Customer, CreateCustomerInput>({
      query: (input) => ({ url: '/customers', method: 'POST', body: toCreateBody(input), headers: { 'Idempotency-Key': newIdempotencyKey() } }),
      transformResponse: (response: CustomerWire) => toCustomer(response),
      invalidatesTags: [{ type: 'Customer', id: 'LIST' }, 'CustomerStats'],
    }),

    updateCustomer: builder.mutation<Customer, UpdateCustomerInput>({
      query: (input) => ({ url: `/customers/${input.id}`, method: 'PATCH', body: toUpdateBody(input) }),
      transformResponse: (response: CustomerWire) => toCustomer(response),
      invalidatesTags: (_r, _e, input) => [{ type: 'Customer', id: input.id }, 'CustomerStats'],
    }),

    /** Its own POST route with a required `reason` — not a PATCH status
     * field — so a suspension is audited separately from an edit. */
    suspendCustomer: builder.mutation<Customer, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/customers/${id}/suspend`, method: 'POST', body: { reason } }),
      transformResponse: (response: CustomerWire) => toCustomer(response),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Customer', id }, { type: 'Customer', id: 'LIST' }, 'CustomerStats'],
    }),

    resumeCustomer: builder.mutation<Customer, string>({
      query: (id) => ({ url: `/customers/${id}/resume`, method: 'POST' }),
      transformResponse: (response: CustomerWire) => toCustomer(response),
      invalidatesTags: (_r, _e, id) => [{ type: 'Customer', id }, { type: 'Customer', id: 'LIST' }, 'CustomerStats'],
    }),

    /** "Delete" archives server-side, never a hard delete — billing
     * history keeps a denormalized reference to the customer string, so
     * removing the row would orphan it. */
    deleteCustomer: builder.mutation<void, string>({
      query: (id) => ({ url: `/customers/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Customer', id: 'LIST' }, 'CustomerStats'],
    }),
  }),
});

export const {
  useGetCustomersQuery,
  useGetCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useSuspendCustomerMutation,
  useResumeCustomerMutation,
  useDeleteCustomerMutation,
} = customersApi;

export type { CustomerStatusWire };
