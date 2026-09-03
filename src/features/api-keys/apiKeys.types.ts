/**
 * API keys — types. Mirrors the gateway's real contract exactly (confirmed
 * against `apps/gateway-b2b/src/app/api-keys/dto/api-key.dto.ts` and
 * `apps/b2b-core/src/app/api-key/api-key.service.ts` on 2026-09-03), not the
 * web repo's legacy mock-shaped `ApiKey` type used elsewhere in that app.
 *
 * `GET /keys` and `GET /key-policies` both return a plain array — neither
 * endpoint takes page/limit, so there is no page-wrapper type here the way
 * Reports and Leads have one.
 */

export type ApiKeyEnvironment = 'LIVE' | 'SANDBOX';
export type ApiKeyClass = 'INFERENCE' | 'PROVISIONING';
export type ApiKeyStatus = 'ACTIVE' | 'ROTATING' | 'REVOKED';
export type KeyScopeType = 'ALL_MODELS_ALL_AGENTS' | 'CHEAP_MODELS_ONLY' | 'CUSTOMER_SCOPED';
export type BudgetResetCadence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type RequestOutcome =
  | 'ALLOWED'
  | 'REJECTED_AUTH'
  | 'REJECTED_IP'
  | 'REJECTED_SCOPE'
  | 'REJECTED_RATE_LIMIT'
  | 'REJECTED_BUDGET'
  | 'UPSTREAM_ERROR';

export interface KeyPolicy {
  id: string;
  tenantId: string;
  name: string;
  scopeType: KeyScopeType;
  allowedAgentIds: string[];
  allowedModelIds: string[];
  /** Minor units — pence. */
  budgetMinor: number;
  budgetResetCadence: BudgetResetCadence;
  requestsPerMinute: number;
  tokensPerMinute: number;
  ipAllowlist: string[];
  allowTraining: boolean;
  isDefault: boolean;
  /** How many keys point at this policy — deletion is refused above zero. */
  _count: { apiKeys: number };
  createdAt: string;
  updatedAt: string;
}

export interface KeyUsageSummary {
  /** Spend inside the policy's CURRENT budget window, minor units. */
  costMinor: number;
  requestCount: number;
  windowStart: string | null;
}

export interface ApiKey {
  id: string;
  tenantId: string;
  customerId: string | null;
  customer: { id: string; name: string } | null;
  policyId: string;
  /** Resolved inline — a list view never needs a second call for it. */
  policy: KeyPolicy;
  name: string;
  environment: ApiKeyEnvironment;
  keyClass: ApiKeyClass;
  /** First 12 characters of the issued key — the only part ever shown
   * again. The remainder is the secret and exists only once, in the
   * response body of create/rotate. */
  prefix: string;
  status: ApiKeyStatus;
  /** Set only while a rotation is in flight. */
  previousPrefix: string | null;
  previousValidUntil: string | null;
  lastUsedAt: string | null;
  createdById: string;
  createdAt: string;
  revokedAt: string | null;
  usage: KeyUsageSummary;
}

/** The response body of `POST /keys` — the secret exists here and nowhere
 * else. Never persisted past the screen that shows it once. */
export interface IssuedApiKey {
  key: string;
  apiKey: ApiKey;
}

/** The response body of `POST /keys/:id/rotate` — same shape, plus the
 * moment the previous secret stops verifying. */
export interface RotatedApiKey extends IssuedApiKey {
  previousValidUntil: string;
}

export interface ApiKeyListParams {
  search?: string;
  environment?: ApiKeyEnvironment;
  status?: ApiKeyStatus;
  policyId?: string;
  customerId?: string;
  includeRevoked?: boolean;
}

export interface KeyPolicyListParams {
  search?: string;
  scopeType?: KeyScopeType;
  allowTraining?: boolean;
}

export interface CreateApiKeyBody {
  name: string;
  /** The portal always sends this explicitly as LIVE — the API itself still
   * defaults an omitted value to SANDBOX for integrators scripting directly
   * against it. */
  environment: ApiKeyEnvironment;
  keyClass?: ApiKeyClass;
  policyId?: string | null;
  customerId?: string | null;
}

export interface UpdateApiKeyBody {
  id: string;
  name?: string;
  policyId?: string | null;
  customerId?: string | null;
}

export interface CreateKeyPolicyBody {
  name: string;
  scopeType?: KeyScopeType;
  allowedAgentIds?: string[];
  allowedModelIds?: string[];
  /** Minor units — pence, integer. */
  budgetMinor: number;
  budgetResetCadence?: BudgetResetCadence;
  requestsPerMinute: number;
  tokensPerMinute: number;
  ipAllowlist?: string[];
  allowTraining?: boolean;
  isDefault?: boolean;
}

export interface UpdateKeyPolicyBody extends Partial<CreateKeyPolicyBody> {
  id: string;
}

export interface KeyUsageDailyPoint {
  date: string;
  requestCount: number;
  costMinor: number;
  promptTokens: number;
  completionTokens: number;
}

export interface KeyUsageModelSplit {
  modelId: string;
  requestCount: number;
  costMinor: number;
}

export interface KeyUsageRequestLogItem {
  id: string;
  occurredAt: string;
  sourceIp: string | null;
  outcome: RequestOutcome;
  httpStatus: number | null;
  modelId: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  costMinor: number | null;
  userAgent: string | null;
}

/** The response body of `GET /keys/:id/usage`. */
export interface KeyUsage {
  key: ApiKey;
  windowDays: number;
  daily: KeyUsageDailyPoint[];
  byModel: KeyUsageModelSplit[];
  /** Capped at 50 server-side — rejections are included, not only successes. */
  recentRequests: KeyUsageRequestLogItem[];
}

export interface KeyUsageParams {
  id: string;
  /** 1-365, defaults to 30 server-side. */
  days?: number;
}
