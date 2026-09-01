/**
 * Marketplace module — types. Mirrors the web app's
 * `src/types/connector.types.ts` and `src/types/marketplace.types.ts`
 * (confirmed against that source). Covers three areas: the connector
 * catalogue (browse/connect third-party integrations), the skill/agent
 * marketplace (browse/clone published listings), and the workspace's own
 * "owned" tier for each.
 */

/* -------------------------------------------------------------------------- */
/* Connectors                                                                 */
/* -------------------------------------------------------------------------- */

export type ScopeTag = 'Api' | 'MCP' | 'CLI';
export type ConnectorStatus = 'active' | 'inactive';
export type AuthType = 'none' | 'api_key' | 'oauth' | 'custom' | null;

export interface ScopeTool {
  name: string;
  slug: string;
  tag: ScopeTag;
  description: string;
}

export interface ConnectorScope {
  read: ScopeTool[];
  write: ScopeTool[];
}

export interface ConnectorMeta {
  website?: string | null;
  documentation?: string | null;
  support?: string | null;
  developedBy?: string | null;
}

export interface Connector {
  id: string;
  slug: string;
  name: string;
  category: string[];
  description: string | null;
  logo: string | null;
  status: ConnectorStatus;
  authType: AuthType;
  scope: ConnectorScope;
  meta: ConnectorMeta | null;
}

export interface ConnectorListParams {
  status?: ConnectorStatus;
  category?: string;
  search?: string;
  skip?: number;
  take?: number;
}

export interface ConnectorListResponse {
  total: number;
  skip: number;
  take: number;
  data: Connector[];
}

export interface ConnectorInstallAccount {
  id?: string;
  login?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

export interface ConnectorInstall {
  id: string;
  connectorId: string;
  connectorSlug: string;
  connectorName: string;
  connectorLogo: string | null;
  customerId: string | null;
  status: string;
  provider: string | null;
  scopes: string[];
  account: ConnectorInstallAccount | null;
  connectedAt: string;
  lastSyncAt: string | null;
  tokenExpiresAt: string | null;
  hasRefreshToken: boolean;
}

export interface StartConnectorOAuthArgs {
  slug: string;
  customerId?: string;
  returnTo?: string;
}

export interface StartConnectorOAuthResponse {
  authorizeUrl: string;
  state: string;
  expiresInSeconds: number;
  connectorSlug: string;
  connectorName: string;
  requestedScopes: string[];
}

export interface RemoveConnectorInstallResponse {
  id: string;
  connectorSlug: string;
  revoked: boolean;
}

export type CatalogueView = 'discover' | 'all' | 'connected';
export type StatusFilter = 'all' | ConnectorStatus;
export type AuthFilter = 'all' | 'none' | 'api_key' | 'oauth' | 'custom';
export type ConnectMode = 'oauth' | 'no-auth' | 'api-key' | 'custom-auth' | 'unknown-auth' | 'inactive';

export interface CategoryGroup {
  category: string;
  connectors: Connector[];
  total: number;
}

/* -------------------------------------------------------------------------- */
/* Marketplace (skills & agents)                                             */
/* -------------------------------------------------------------------------- */

export type MarketplaceResource = 'skill' | 'agent';

export interface MarketplaceCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

interface MarketplaceEntryBase {
  id: string;
  name: string;
  description: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
  category?: MarketplaceCategory;
}

export interface MarketplaceSkill extends MarketplaceEntryBase {
  skillCategoryId: string;
  _count?: { tenantClones?: number; customerClones?: number };
}

export interface MarketplaceAgent extends MarketplaceEntryBase {
  agentCategoryId: string;
  _count?: { clonedAgents?: number };
}

export type MarketplaceEntry = MarketplaceSkill | MarketplaceAgent;

export interface MarketplaceListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface MarketplaceListResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** The copy that landed in the workspace's own tier after a clone. Only the
 * fields the mobile UI actually reads — the wire carries more. */
export interface TenantSkill {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  clonedSkillId: string | null;
}

export interface TenantAgent {
  id: string;
  name: string;
  createdAt: string;
  clonedFromMarketplaceId: string | null;
}

export type TenantClone = TenantSkill | TenantAgent;

/** What a card shows once THIS SESSION cloned it — see marketplaceClonesSlice.
 * There is no backend endpoint that lists a workspace's skills, so this is
 * the only record of "already installed" for skills; agents recover the
 * same fact from `GET /agents`'s `clonedFromMarketplaceId` on every load. */
export interface ClonedEntryRecord {
  cloneId: string;
  name: string;
  savedAt: string;
  origin: 'authored' | 'installed';
}

export interface CreateSkillPayload {
  skillCategoryId: string;
  name: string;
  description: string;
  prompt: string;
}

/** A row in the "My skills" grid — reconstructed client-side from the
 * session's cloned-entry records, joined against a page of the public
 * catalogue purely for the description/category cosmetic fields. */
export interface SkillRow {
  catalogueId: string;
  cloneId: string;
  name: string;
  savedAt: string;
  description: string | null;
  categoryName: string | null;
  origin: 'authored' | 'installed';
}
