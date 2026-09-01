/**
 * Customers (the tenant's own customer registry) — types, ported from the
 * web app's `src/types/customer.types.ts` and `src/features/Customers/
 * Customers.interface.ts` (confirmed against that source — see the research
 * notes this port was built from). This is a DIFFERENT feature from
 * "Customer agents" (clone management, `src/features/customer-agents/`) —
 * do not conflate the two.
 *
 * `quota hit` is DERIVED, never stored — the backend only ever sends
 * ACTIVE/SUSPENDED/ARCHIVED (see `CustomerStatusWire`); the UI computes it
 * by merging status with `quotaUsedPct >= 100` (see customersApi.ts's
 * `toState`). `idle` exists in the type for parity with web but is
 * currently unreachable on both platforms — there is no last-activity
 * signal wired up yet.
 */

export type CustomerState = 'active' | 'idle' | 'quota hit' | 'suspended';

export interface Customer {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  /** '' when not supplied. Immutable once set — the attribution key, never
   * editable after create (see UpdateCustomerWire, which omits it). */
  externalId: string;
  email: string | null;
  /** Clone count, derived server-side, never writable from here. */
  agents: number;
  /** % of the monthly token allowance used. null = billing unavailable for
   * this principal (see the `billing.view`-gated fields note below). */
  quota: number | null;
  /** A TOKEN allowance, not money. */
  quotaMonthly: number | null;
  /** GBP unit price charged to this customer per run. */
  price: number | null;
  /** GBP spend to date. */
  spend: number | null;
  state: CustomerState;
  showQuotaToCustomer: boolean;
  /** White-label portal sign-in switch. */
  portalAccessEnabled: boolean;
  suspendReason: string | null;
}

export interface CustomerPage {
  items: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CustomerStats {
  registered: number;
  active: number;
  suspended: number;
  clonesAssigned: number;
  nearOrAtQuota: number | null;
  /** GBP. null when billing rollups haven't shipped/answered yet — see
   * customersRules.ts's stats-fallback logic, distinct from "request
   * failed" (which drops the tile entirely rather than showing a dash). */
  attributedSpend: number | null;
}

export interface SuspendCustomerRequest {
  id: string;
  reason: string;
}

/* -------------------------------------------------------------------------- */
/* Wire shapes — what the gateway actually returns/accepts                   */
/* -------------------------------------------------------------------------- */

export type CustomerStatusWire = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export type CustomerRegistrationChannelWire = 'REST_API' | 'MCP' | 'CSV_IMPORT' | 'INVITE_LINK' | 'PORTAL_SIGNUP';

export interface CustomerWire {
  id: string;
  tenantId: string;
  externalId: string | null;
  name: string;
  email: string | null;
  status: CustomerStatusWire;
  quotaMonthly: number;
  spendCapCents: number;
  agentPool: string[];
  registeredVia: CustomerRegistrationChannelWire;
  showQuotaToCustomer: boolean;
  portalAccessEnabled: boolean;
  suspendedAt: string | null;
  suspendReason: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on list/get only. */
  agentCount?: number;
  quotaUsedPct?: number | null;
  /** These three are OMITTED ENTIRELY (not just null) for a principal
   * without `billing.view` — never rely on their presence to gate UI,
   * gate on the permission itself. */
  sellPricePerRunCents?: number | null;
  spendCents?: number | null;
}

export interface CustomerListWire {
  items: CustomerWire[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CustomerListParams {
  /** 1-based; <1 is a 400. */
  page?: number;
  /** 1..100; the stated ceiling is 100 — asking above it is a 400. Omitted
   * -> gateway default 20. */
  limit?: number;
  status?: CustomerStatusWire;
  /** NOT `search` — that param name is a 400. Matches name/externalId/
   * email server-side. */
  q?: string;
}

export interface CustomerStatsWire {
  registered: number;
  active: number;
  suspended: number;
  clonesAssigned: number;
  nearOrAtQuota: number | null;
  attributedSpendCents?: number | null;
}

/** `forbidNonWhitelisted: true` on the gateway DTO — send exactly these
 * keys, nothing extra, or the request is a 400. */
export interface CreateCustomerWire {
  name: string;
  externalId?: string;
  email?: string;
  quotaMonthly?: number;
  registeredVia: CustomerRegistrationChannelWire;
  showQuotaToCustomer?: boolean;
  portalAccessEnabled?: boolean;
}

/** `externalId` is never accepted here — immutable once set. `email: null`
 * clears it (PATCH-only; create has no such affordance) — the mobile
 * register/edit forms never send that, since both require a non-blank
 * email in the UI, but the wire type allows it for completeness/parity. */
export interface UpdateCustomerWire {
  name?: string;
  email?: string | null;
  quotaMonthly?: number;
  showQuotaToCustomer?: boolean;
  portalAccessEnabled?: boolean;
  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/* UI-facing input shapes — what the form screens build and hand to the API  */
/* -------------------------------------------------------------------------- */

export interface CreateCustomerInput {
  name: string;
  email: string;
  /** null = "unlimited" (the UI's wording for what the DTO spells as
   * omitting the key entirely — see customersApi.ts's toCreateBody). */
  quotaMonthly: number | null;
  showQuotaToCustomer: boolean;
  portalAccessEnabled: boolean;
}

export interface UpdateCustomerInput {
  id: string;
  name: string;
  email: string;
  /** null = "leave unchanged" (omitted from the wire body). */
  quotaMonthly: number | null;
  showQuotaToCustomer: boolean;
  portalAccessEnabled: boolean;
}

/* -------------------------------------------------------------------------- */
/* UI row / detail / modal types                                             */
/* -------------------------------------------------------------------------- */

export interface CustomerRow {
  id: string;
  name: string;
  externalId: string;
  agents: number;
  quota: number | null;
  price: number | null;
  spend: number | null;
  state: CustomerState;
  isSuspended: boolean;
}

export interface CustomerFieldRow {
  id: string;
  label: string;
  value: string;
  moneyAmount?: number;
  suffix?: string;
}

export type CustomersModal = 'register' | 'edit' | 'suspend' | 'resume' | 'delete' | null;
