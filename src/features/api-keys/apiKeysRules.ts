/**
 * API keys — pure rules and copy. Ported verbatim where the string is
 * user-facing (confirmed against web's `ApiKeys.data.ts` / `useApiKeys.tsx`
 * and `apps/gateway-b2b/.../dto/api-key.dto.ts` on 2026-09-03).
 */

import type { ApiKeyStatus, BudgetResetCadence, KeyScopeType, RequestOutcome } from './apiKeys.types';

/* -------------------------------------------------------------------------- */
/* Labels + tones                                                            */
/* -------------------------------------------------------------------------- */

export const ENV_LABEL: Record<'LIVE' | 'SANDBOX', string> = { LIVE: 'live', SANDBOX: 'sandbox' };

/** ROTATING is called out rather than folded into ACTIVE: while it shows,
 * two secrets verify, and that is a state worth seeing and finishing. */
export const STATUS_LABEL: Record<ApiKeyStatus, string> = { ACTIVE: 'Active', ROTATING: 'Rotating', REVOKED: 'Revoked' };
export const STATUS_TONE: Record<ApiKeyStatus, 'success' | 'warning' | 'error'> = {
  ACTIVE: 'success',
  ROTATING: 'warning',
  REVOKED: 'error',
};

/** How much of the key is shown. The rest is never returned by the API. */
export const VISIBLE_PREFIX_LENGTH = 12;
export const maskPrefix = (prefix: string): string => `${prefix.slice(0, VISIBLE_PREFIX_LENGTH)}${'•'.repeat(8)}`;

export const SCOPE_LABEL: Record<KeyScopeType, string> = {
  ALL_MODELS_ALL_AGENTS: 'All models',
  CHEAP_MODELS_ONLY: 'Cheap models only',
  CUSTOMER_SCOPED: 'Customer-scoped',
};
export const SCOPE_OPTIONS = (Object.keys(SCOPE_LABEL) as KeyScopeType[]).map((value) => ({ label: SCOPE_LABEL[value], value }));

export const CADENCE_LABEL: Record<BudgetResetCadence, string> = {
  MONTHLY: 'Monthly',
  WEEKLY: 'Weekly',
  DAILY: 'Daily',
  NONE: 'Never (lifetime cap)',
};
export const CADENCE_OPTIONS = [
  { label: 'Monthly', value: 'MONTHLY' },
  { label: 'Weekly', value: 'WEEKLY' },
  { label: 'Daily', value: 'DAILY' },
  { label: 'Never (lifetime cap)', value: 'NONE' },
];

/**
 * The environment every NEW key issued from the portal gets. The API itself
 * still defaults an omitted `environment` to SANDBOX for anyone scripting
 * against it directly — this constant narrows the mobile app only, sent
 * explicitly rather than omitted.
 */
export const ISSUED_ENVIRONMENT = 'LIVE' as const;

export const OUTCOME_LABEL: Record<RequestOutcome, string> = {
  ALLOWED: 'Allowed',
  REJECTED_AUTH: 'Auth refused',
  REJECTED_IP: 'IP refused',
  REJECTED_SCOPE: 'Out of scope',
  REJECTED_RATE_LIMIT: 'Rate limited',
  REJECTED_BUDGET: 'Over cap',
  UPSTREAM_ERROR: 'Upstream error',
};
export const OUTCOME_TONE: Record<RequestOutcome, 'success' | 'warning' | 'error' | 'neutral'> = {
  ALLOWED: 'success',
  REJECTED_AUTH: 'error',
  REJECTED_IP: 'error',
  REJECTED_SCOPE: 'error',
  REJECTED_RATE_LIMIT: 'warning',
  REJECTED_BUDGET: 'warning',
  UPSTREAM_ERROR: 'neutral',
};

/* -------------------------------------------------------------------------- */
/* Filter tabs                                                               */
/* -------------------------------------------------------------------------- */

export const ANY_VALUE = '';
/** Not a real status — the deliberate way to see revoked keys alongside
 * everything else; maps to `includeRevoked: true` with no status filter. */
export const KEY_STATUS_ALL = 'ALL';

export const KEY_STATUS_TABS: { label: string; value: string }[] = [
  { label: 'Active & rotating', value: ANY_VALUE },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Rotating', value: 'ROTATING' },
  { label: 'Revoked', value: 'REVOKED' },
  { label: 'All', value: KEY_STATUS_ALL },
];

export const POLICY_SCOPE_TABS: { label: string; value: string }[] = [{ label: 'All scopes', value: ANY_VALUE }, ...SCOPE_OPTIONS];

export const POLICY_TRAINING_TABS: { label: string; value: string }[] = [
  { label: 'Any training', value: ANY_VALUE },
  { label: 'Training allowed', value: 'true' },
  { label: 'Training off', value: 'false' },
];

export const SEARCH_DEBOUNCE_MS = 300;

/* -------------------------------------------------------------------------- */
/* Rotation window                                                           */
/* -------------------------------------------------------------------------- */

/** Fixed at one hour, both here and server-side — not configurable. A
 * tenant who could set it to a month would keep a compromised secret
 * alive for one. */
export const ROTATION_WINDOW_MS = 3_600_000;

/** A window is still open only while `previousValidUntil` is in the
 * future — the server-reported ROTATING status can go stale while the
 * screen sits open, so every read re-checks it against the same clock the
 * badge uses. */
export const isRotationOpen = (previousValidUntil: string | null, nowMs: number): boolean =>
  previousValidUntil !== null && new Date(previousValidUntil).getTime() > nowMs;

/** The status actually worth showing right now — corrects a stale
 * ROTATING back to ACTIVE the instant its window has closed, without
 * waiting for the next fetch or the server's own sweep. */
export const displayStatus = (status: ApiKeyStatus, previousValidUntil: string | null, nowMs: number): ApiKeyStatus =>
  status === 'ROTATING' && !isRotationOpen(previousValidUntil, nowMs) ? 'ACTIVE' : status;

/** "42m 07s" — zero-padded seconds so the width does not jitter as it
 * counts down. */
export const formatCountdown = (msLeft: number): string => {
  const total = Math.max(0, Math.round(msLeft / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
};

/** Local time, spelled out — a rotation deadline read wrong is an outage. */
export const formatDeadline = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

/* -------------------------------------------------------------------------- */
/* Modal copy                                                                */
/* -------------------------------------------------------------------------- */

export const KEY_MODAL_COPY = {
  create: {
    title: 'Create API key',
    description:
      'This issues a LIVE key: it reaches real models and spends real money from the moment it is first used, bounded only by its policy. The secret is shown once, on the screen that follows — nothing stores it and there is no way to see it again, so copy it before you close that screen.',
    submitLabel: 'Create live key',
  },
  edit: {
    title: 'Edit API key',
    description:
      'Name and policy only. The secret itself cannot be changed here — rotate the key instead, which keeps the old secret working for an hour while you redeploy.',
    submitLabel: 'Save changes',
  },
} as const;

export const POLICY_MODAL_COPY = {
  create: {
    title: 'Create key policy',
    description: 'A policy is owned by the tenant and shared by every key attached to it, so editing one here changes the limits for all of them.',
    submitLabel: 'Create policy',
  },
  edit: {
    title: 'Edit key policy',
    description: 'New limits apply to every key on this policy from its next request.',
    submitLabel: 'Save policy',
  },
} as const;

export const ROTATION_COPY = {
  title: 'Rotation in progress',
  description: 'Both secrets below authenticate right now. The old one stops the moment its countdown reaches zero — deploy the new one before then. Revoking the key closes the window immediately, for both.',
  oldLabel: 'Old secret — expiring',
  newLabel: 'New secret — deploy this',
  expired: 'window closed',
  allClosed: 'Every rotation window has closed. The old secrets no longer authenticate; only the current one does.',
} as const;

export const buildRotationTriggerLabel = (count: number): string => (count === 1 ? 'Rotation in progress' : `${count} rotations in progress`);

/* -------------------------------------------------------------------------- */
/* Confirmation + warning copy                                               */
/* -------------------------------------------------------------------------- */

export const buildRotateWarning = (name: string): string =>
  `${name} gets a new secret, shown once. The CURRENT secret keeps working for one hour, so callers have that long to pick up the new one — after that they start failing. Revoking during the window closes it immediately.`;

export const buildRevokeWarning = (name: string, prefix: string): string =>
  `${name} (${prefix}…) stops working immediately and cannot be restored. Anything calling with it — a backend, a customer portal, a scheduled job — starts failing on its next request, so make sure a replacement is deployed first. The key is not deleted: it stays on record so its request history remains readable.`;

/** "600 rpm · 400,000 tpm" — the exact phrase both the policy card and the
 * delete-confirmation warning quote, so they never say the rule two
 * different ways. */
export const buildLimitsLabel = (policy: { requestsPerMinute: number; tokensPerMinute: number }): string =>
  `${policy.requestsPerMinute.toLocaleString('en-GB')} rpm · ${policy.tokensPerMinute.toLocaleString('en-GB')} tpm`;

export const buildDeletePolicyWarning = (name: string, limits: string): string =>
  `${name} is removed for good — ${limits}, its spend cap and its IP rules go with it, and there is no undo. No key is affected, because a policy can only be deleted once nothing points at it. Nothing that already happened changes either: spend and request history belong to the keys, not to the policy.`;

/* -------------------------------------------------------------------------- */
/* Authorisation copy                                                        */
/* -------------------------------------------------------------------------- */

export const NO_PERMISSION_MESSAGE = {
  create: 'You do not have permission to issue API keys.',
  edit: 'You do not have permission to edit API keys.',
  rotate: 'You do not have permission to rotate API keys.',
  revoke: 'You do not have permission to revoke API keys.',
  policy: 'You do not have permission to create key policies.',
  editPolicy: 'You do not have permission to edit key policies.',
  deletePolicy: 'You do not have permission to delete key policies.',
} as const;

export const NO_CREATE_KEY_DESCRIPTION = 'No API keys yet. Issuing one needs the "Issue API keys" permission — ask an owner or an admin to grant it.';
export const NO_CREATE_POLICY_DESCRIPTION = 'No policies yet. Creating one needs the "Manage key policies" permission — ask an owner or an admin to grant it.';
export const NO_POLICY_VIEW_DESCRIPTION = 'Each key is issued against a policy carrying its spend cap, rate limits and IP rules. Reading them needs the "View key policies" permission.';

/* -------------------------------------------------------------------------- */
/* Policy defaults (mirrors the tenant's own auto-created default policy)    */
/* -------------------------------------------------------------------------- */

export const POLICY_FORM_DEFAULTS = {
  name: '',
  scopeType: 'CHEAP_MODELS_ONLY' as KeyScopeType,
  budget: '50',
  budgetResetCadence: 'MONTHLY' as BudgetResetCadence,
  requestsPerMinute: '60',
  tokensPerMinute: '20000',
  ipAllowlist: '',
  allowTraining: false,
  isDefault: false,
};

/** Comma-separated CIDR text -> array, dropping blank entries. The server
 * is the real validator (a proper CIDR parser, IPv4 and IPv6) — this is
 * only enough shape-checking to catch an obvious typo before a round
 * trip; see the module spec for why a fuller client-side parser wasn't
 * built. */
export const parseIpAllowlist = (text: string): string[] =>
  text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const IPV4_CIDR_SHAPE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/;
