/**
 * Customers — pure helpers and copy, ported verbatim from the web app's
 * `src/features/Customers/Customers.data.ts` and `useCustomers.tsx`
 * (confirmed against that source — see the research this port was built
 * from). Kept in one file per this project's established convention
 * (agentRules.ts, cloneRules.ts, marketplaceRules.ts).
 */
import type { SerializedError } from '@reduxjs/toolkit';

import type { CustomerStatsResponse } from '@/features/dashboard/dashboard.types';
import { getErrorMessage } from '@/services/apiErrorMessage';
import type { ApiQueryError } from '@/store/baseQuery';

import type { Customer, CustomerFieldRow, CustomerRow, CustomerState, CustomerStats } from './customers.types';

/* -------------------------------------------------------------------------- */
/* Page copy                                                                  */
/* -------------------------------------------------------------------------- */

export const CUSTOMERS_DESCRIPTION =
  'Level three of the hierarchy. Every run is attributed, so usage, spend and invoices split by customer with no extra work.';
/** Shown instead, on a first-run (zero-customer, no search) workspace. */
export const CUSTOMERS_EMPTY_DESCRIPTION = 'Your own end customers.';

/* -------------------------------------------------------------------------- */
/* Pagination / search                                                       */
/* -------------------------------------------------------------------------- */

export const CUSTOMERS_PAGE_SIZE = 10;
export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_PLACEHOLDER = 'Search customers';
export const SEARCH_TITLE = 'Search by customer name or external ID';
export const REGISTRY_PANEL_TITLE = 'Registry';
export const SEARCH_EMPTY_TITLE = 'No customers match that search';
export const SEARCH_EMPTY_DESCRIPTION = 'Nothing in this registry matches that search. Clear it to see every customer.';

/* -------------------------------------------------------------------------- */
/* Quota thresholds / state badge colors                                     */
/* -------------------------------------------------------------------------- */

export const NEAR_QUOTA_THRESHOLD = 75;
export const QUOTA_EXHAUSTED = 100;

export type StateVariant = 'success' | 'danger' | 'warning' | 'neutral' | 'accent';

export const CUSTOMER_STATE_VARIANT: Record<CustomerState, StateVariant> = {
  active: 'success',
  'quota hit': 'danger',
  suspended: 'danger',
  idle: 'neutral',
};
export const DEFAULT_STATE_VARIANT: StateVariant = 'neutral';

/** The quota bar deliberately uses 75%, not the shared bar's own 80%
 * default warn threshold — kept in sync with `NEAR_QUOTA_THRESHOLD` so the
 * stats tile count and the bar color always agree. */
export function quotaTone(quota: number): StateVariant {
  if (quota >= QUOTA_EXHAUSTED) return 'danger';
  if (quota >= NEAR_QUOTA_THRESHOLD) return 'warning';
  return 'accent';
}

/* -------------------------------------------------------------------------- */
/* Registration channel                                                      */
/* -------------------------------------------------------------------------- */

export const REGISTRATION_ROUTE_OPTIONS = [
  { label: 'REST API', value: 'REST_API' },
  { label: 'MCP', value: 'MCP' },
  { label: 'CSV import', value: 'CSV_IMPORT' },
  { label: 'Invite link', value: 'INVITE_LINK' },
  { label: 'Portal signup', value: 'PORTAL_SIGNUP' },
] as const;
/** What the Register form always sends — the field is shown read-only,
 * never chosen. */
export const DEFAULT_REGISTRATION_ROUTE = 'REST_API' as const;

export function registrationRouteLabel(value: string): string {
  return REGISTRATION_ROUTE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

/** Loose client pre-check; the gateway's own `@IsEmail()` is authoritative. */
export const BILLING_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* -------------------------------------------------------------------------- */
/* Dialog copy                                                               */
/* -------------------------------------------------------------------------- */

export const CUSTOMER_MODAL_COPY = {
  register: {
    title: 'Register a customer',
    description: 'A customer is the third level of the hierarchy: us, then you, then them. Every run carrying X-AD-Customer attributes usage, spend and invoices to them.',
    submitLabel: 'Register customer',
  },
  edit: {
    title: 'Edit customer',
    description: "The external ID cannot change — it is the attribution key, and moving it would split their usage history. Suspension and quota consumption are not edited here either: each has its own action.",
    submitLabel: 'Save customer',
  },
  suspend: {
    title: 'Suspend customer',
    description: "Their assistants stop responding immediately. Your other customers are unaffected — suspension reaches one customer, never the whole workspace.",
    submitLabel: 'Suspend customer',
  },
} as const;

export function buildDeleteWarning(name: string, cloneCount: number): string {
  const cloneClause = cloneCount > 0 ? `, their ${cloneCount} cloned agent${cloneCount === 1 ? '' : 's'} and their portal access` : ' and their portal access';
  return `Removes ${name}${cloneClause} from the registry. Metered usage stays in the ledger — the record is archived, not deleted, so billing history is never rewritten. There is no undo.`;
}

export function buildResumeMessage(name: string): string {
  return `${name}'s assistants start responding again immediately, on the same quota they had before.`;
}

/* -------------------------------------------------------------------------- */
/* Tooltips / permission-denied toasts                                       */
/* -------------------------------------------------------------------------- */

export const NO_UPDATE_TOOLTIP = 'You do not have permission to edit customers in this workspace.';
export const NO_SUSPEND_TOOLTIP = 'You do not have permission to suspend customers in this workspace.';
export const NO_RESUME_TOOLTIP = 'You do not have permission to resume customers in this workspace.';
export const NO_DELETE_TOOLTIP = 'You do not have permission to delete customers in this workspace.';
export const EDIT_TOOLTIP = 'Edit this customer';
export const SUSPEND_TOOLTIP = 'Suspend this customer';
export const RESUME_TOOLTIP = 'Resume this suspended customer';
export const DELETE_TOOLTIP = 'Delete this customer';

export const NO_PERMISSION_MESSAGE = {
  register: 'You do not have permission to register customers in this workspace.',
  edit: NO_UPDATE_TOOLTIP,
  suspend: NO_SUSPEND_TOOLTIP,
  resume: NO_RESUME_TOOLTIP,
  delete: NO_DELETE_TOOLTIP,
  import: 'You do not have permission to import customers in this workspace.',
} as const;

/* -------------------------------------------------------------------------- */
/* Other copy                                                                 */
/* -------------------------------------------------------------------------- */

export const ISOLATION_NOTE =
  "This customer's knowledge scope is unreachable by any other customer's clone. Your staff can read across customers; your customers cannot.";
/** Suffix beside Sell price in the detail screen: "£0.12/run · our cost £0.09". */
export const PLATFORM_COST_PER_RUN = 0.09;

/* -------------------------------------------------------------------------- */
/* Error fallback copy                                                       */
/* -------------------------------------------------------------------------- */

const STATUS_FALLBACK: Record<number, string> = {
  400: 'Some of those details were rejected. Check the highlighted fields.',
  401: 'Your session has expired. Sign in again to continue.',
  403: 'Your role cannot do that. Customer management sits behind a permission, not a seniority level.',
  404: 'That customer no longer exists — it may have been archived from another tab.',
  409: 'Another customer in this workspace already uses one of those details — the external ID or the billing email.',
  413: 'That file is too large for the importer.',
  429: 'Too many imports started recently. Wait a few minutes and try again.',
};

/** The gateway's own message wins when it's readable; otherwise a
 * code-keyed fallback names what's actually likely wrong, rather than a
 * bare "Could not X." — `action` reads as e.g. "register that customer". */
export function customerErrorFallback(error: ApiQueryError | SerializedError | undefined, action: string): string {
  let fallback = `Could not ${action}.`;
  if (error && 'status' in error && typeof error.status === 'number') {
    const coded = STATUS_FALLBACK[error.status];
    if (coded) {
      fallback = coded;
    } else if (error.status >= 500) {
      fallback = `The server could not ${action} just now. Nothing was changed — try again in a moment.`;
    }
  }
  return getErrorMessage(error, fallback);
}

/* -------------------------------------------------------------------------- */
/* Pure row/field builders                                                   */
/* -------------------------------------------------------------------------- */

export const UNKNOWN = '—';

export function toQuotaLabel(quota: number | null): string {
  return quota === null ? UNKNOWN : `${quota}%`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return UNKNOWN;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return UNKNOWN;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function buildCustomerRows(customers: Customer[]): CustomerRow[] {
  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    externalId: c.externalId,
    agents: c.agents,
    quota: c.quota,
    price: c.price,
    spend: c.spend,
    state: c.state,
    isSuspended: c.state === 'suspended',
  }));
}

/** Order: External ID, [Billing email — only if present], State, Quota
 * used, Assigned agents, Portal access, [Suspended because — only if
 * suspended & has a reason], [Sell price — only if `canViewBilling`],
 * [Spend — only if `canViewBilling`]. The last two are OMITTED entirely
 * (not blanked) without billing access — even the label would leak that a
 * price exists. */
export function buildDetailRows(customer: Customer | null, canViewBilling: boolean): CustomerFieldRow[] {
  if (!customer) return [];

  const rows: CustomerFieldRow[] = [{ id: 'externalId', label: 'External ID', value: customer.externalId || UNKNOWN }];

  if (customer.email) {
    rows.push({ id: 'email', label: 'Billing email', value: customer.email });
  }

  rows.push(
    { id: 'state', label: 'State', value: customer.state },
    { id: 'quota', label: 'Quota used', value: toQuotaLabel(customer.quota) },
    { id: 'agents', label: 'Assigned agents', value: customer.agents > 0 ? `${customer.agents} clone${customer.agents === 1 ? '' : 's'}` : 'none yet' },
    { id: 'portal', label: 'Portal access', value: customer.portalAccessEnabled ? 'Enabled · 2FA enforced' : 'Disabled' },
  );

  if (customer.state === 'suspended' && customer.suspendReason) {
    rows.push({ id: 'suspendReason', label: 'Suspended because', value: customer.suspendReason });
  }

  if (canViewBilling) {
    rows.push(
      customer.price === null
        ? { id: 'price', label: 'Sell price', value: UNKNOWN }
        : { id: 'price', label: 'Sell price', value: '', moneyAmount: customer.price, suffix: `per run · our cost £${PLATFORM_COST_PER_RUN.toFixed(2)}` },
      customer.spend === null ? { id: 'spend', label: 'Spend', value: UNKNOWN } : { id: 'spend', label: 'Spend', value: '', moneyAmount: customer.spend },
    );
  }

  return rows;
}

/* -------------------------------------------------------------------------- */
/* Stats mapping — from dashboardApi's shared /customers/stats response     */
/* -------------------------------------------------------------------------- */

const toPounds = (cents: number | null | undefined): number | null => (typeof cents === 'number' ? cents / 100 : null);

export function toCustomerStats(wire: CustomerStatsResponse): CustomerStats {
  return {
    registered: wire.registered,
    active: wire.active,
    suspended: wire.suspended,
    clonesAssigned: wire.clonesAssigned,
    nearOrAtQuota: wire.nearOrAtQuota ?? null,
    attributedSpend: toPounds(wire.attributedSpendCents),
  };
}
