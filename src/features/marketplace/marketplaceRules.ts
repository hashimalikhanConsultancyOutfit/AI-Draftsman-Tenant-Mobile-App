/**
 * Marketplace module — pure helpers and copy, ported from the web app's
 * `Connectors.data.ts` / `MarketplacePanel.data.ts` / `OwnedSkills.data.ts`
 * (confirmed against that source). Kept in one file, unlike web's split
 * across three, since the mobile module is one feature folder.
 */
import type {
  AuthFilter,
  AuthType,
  ConnectMode,
  Connector,
  ConnectorInstall,
  ConnectorScope,
  MarketplaceEntry,
  MarketplaceResource,
  StatusFilter,
} from './marketplace.types';

/* -------------------------------------------------------------------------- */
/* Pagination / list constants                                               */
/* -------------------------------------------------------------------------- */

export const CONNECTOR_PAGE_SIZE = 24; // "All" flat view page size (web: 100 — trimmed for a phone grid)
export const CONNECTOR_ALL_TAKE = 1000; // Discover's fetch cap
export const CONNECTOR_SECTION_LIMIT = 6; // cards per Discover category section
export const CONNECTOR_MAX_TAKE = 200; // gateway's hard per-request cap
export const SEARCH_DEBOUNCE_MS = 300;

export const MARKETPLACE_PAGE_SIZE = 12; // skills/agents browse grid
export const CATALOGUE_JOIN_LIMIT = 100; // owned-skills catalogue join cap

/** Lead-in shown above the 3-tab strip on the top-level Marketplace screen,
 * on all three tabs — ported verbatim from web's `CONNECTORS_SUBTITLE`. */
export const MARKETPLACE_SCREEN_SUBTITLE =
  'Connect services so your agents can access and act on your data, and browse published skills and agents you can clone into your workspace. Inactive connectors are shown blocked until they are enabled.';

/* -------------------------------------------------------------------------- */
/* Connector categories, filters                                             */
/* -------------------------------------------------------------------------- */

/** Verbatim, including the near-duplicates (e.g. "Sales & Marketing" vs
 * "Sales and marketing") — these must match the backend's literal values,
 * never normalised. */
export const CONNECTOR_CATEGORIES = [
  'Academic',
  'Business productivity',
  'Code',
  'Commerce shopping',
  'Communication',
  'Creative',
  'Data',
  'Data & Analytics',
  'Data Warehouses',
  'Data analytics',
  'Design',
  'Developer',
  'Developer tools',
  'E commerce',
  'Education',
  'Finance',
  'Financial services',
  'Health and wellness',
  'Health life sciences',
  'Legal',
  'Life sciences and healthcare',
  'Media entertainment',
  'Nonprofit',
  'Operations',
  'Other',
  'Personal Finance',
  'Productivity',
  'Sales & Marketing',
  'Sales and marketing',
  'Sports',
  'Technology',
  'Travel',
  'Uncategorized',
] as const;

export const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Available' },
  { value: 'inactive', label: 'Not available yet' },
];

export const AUTH_FILTER_OPTIONS: Array<{ value: AuthFilter; label: string }> = [
  { value: 'all', label: 'Any auth' },
  { value: 'none', label: 'No auth' },
  { value: 'api_key', label: 'API key' },
  { value: 'oauth', label: 'OAuth' },
  { value: 'custom', label: 'Custom' },
];

export const AUTH_TYPE_LABEL: Record<Exclude<AuthType, null>, string> = {
  none: 'No auth',
  api_key: 'API key',
  oauth: 'OAuth',
  custom: 'Custom',
};

/* -------------------------------------------------------------------------- */
/* Connect mode / permission gating                                          */
/* -------------------------------------------------------------------------- */

export const isBlocked = (connector: Pick<Connector, 'status'>): boolean => connector.status === 'inactive';

/** `active` + `oauth` is the only combination with a working connect flow —
 * everything else is offered as unavailable with a reason. */
export function connectMode(connector: Pick<Connector, 'status' | 'authType'>): ConnectMode {
  if (isBlocked(connector)) return 'inactive';
  switch (connector.authType) {
    case 'oauth':
      return 'oauth';
    case 'none':
      return 'no-auth';
    case 'api_key':
      return 'api-key';
    case 'custom':
      return 'custom-auth';
    default:
      return 'unknown-auth';
  }
}

export function primaryActionLabel(connector: Pick<Connector, 'status' | 'authType'>, install?: ConnectorInstall | null): string {
  switch (connectMode(connector)) {
    case 'inactive':
      return 'Not available yet';
    case 'api-key':
      return 'Connect with API key';
    case 'custom-auth':
      return 'Custom authentication';
    case 'no-auth':
      return 'Nothing to connect';
    case 'unknown-auth':
    case 'oauth':
      return install ? 'Reconnect' : 'Connect';
  }
}

export const CONNECT_BLOCKED_EXPLANATION: Record<ConnectMode, string | null> = {
  oauth: null,
  'no-auth': null,
  inactive: "This connector isn't available yet — the platform hasn't set it up for connecting.",
  'api-key': 'API-key connections are not available yet. Only OAuth connectors can be connected today.',
  'custom-auth': 'This connector uses a provider-specific authentication scheme, which has no connect flow yet.',
  'unknown-auth': "This connector hasn't declared how it authenticates, so it can't be connected yet.",
};

export const NO_CONNECT_TOOLTIP = 'Connecting an integration needs the "Connect connectors" permission.';
export const DISCONNECT_TOOLTIP = 'Disconnect this integration and delete its stored credentials';
export const NO_DISCONNECT_TOOLTIP = 'Disconnecting needs the "Connect connectors" permission.';
export const NO_CONNECT_MESSAGE = 'You do not have permission to connect or disconnect integrations.';
export const AMR_REQUIRED_MESSAGE = 'Managing connections needs a fully verified session — complete authenticator sign-in, then try again.';

export const NO_MARKETPLACE_VIEW_TITLE = 'You cannot browse the marketplace';
export const NO_MARKETPLACE_VIEW_DESCRIPTION =
  'The Skills and Agent marketplaces are a separate collection from the connector catalogue. Browsing them needs the "View marketplace" permission.';

/** Web's `pickPrimaryInstall` — prefers the tenant-wide install
 * (`customerId === null`) over any customer-scoped ones for the same
 * connector slug, else takes the first (API's own newest-first order). */
export function installsBySlug(installs: ConnectorInstall[]): Record<string, ConnectorInstall> {
  const bySlug: Record<string, ConnectorInstall> = {};
  for (const install of installs) {
    const existing = bySlug[install.connectorSlug];
    if (!existing || (existing.customerId !== null && install.customerId === null)) {
      bySlug[install.connectorSlug] = install;
    }
  }
  return bySlug;
}

export function isInstallExpired(install: ConnectorInstall): boolean {
  if (!install.tokenExpiresAt) return false;
  return new Date(install.tokenExpiresAt).getTime() < Date.now();
}

/* -------------------------------------------------------------------------- */
/* Capabilities / granted-scope tool groups                                  */
/* -------------------------------------------------------------------------- */

const READ_ONLY_SCOPES = new Set(['openid', 'profile', 'email', 'offline_access', 'user:email']);

/** Anything unrecognised is treated as WRITE — the safe direction to be
 * wrong in: over-stating access prompts a look; under-stating hides one. */
export function isReadOnlyScope(scope: string): boolean {
  const value = scope.trim().toLowerCase();
  if (READ_ONLY_SCOPES.has(value)) return true;
  if (/^read[:._-]/.test(value)) return true;
  return /[:._-](readonly|read)$/.test(value);
}

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  repo: 'Full control of private and public repositories — code, issues, pull requests, and settings.',
  public_repo: 'Read and write access to public repositories only.',
  'repo:status': 'Read and write commit statuses, without access to code.',
  repo_deployment: 'Read and write deployment statuses, without access to code.',
  'repo:invite': 'Accept and decline repository invitations.',
  delete_repo: 'Delete repositories you administer.',
  security_events: 'Read and write code-scanning and Dependabot alerts.',
  'admin:org': 'Full control of organisations, their teams, and membership.',
  'write:org': 'Read and write organisation and team membership.',
  'read:org': 'Read organisation membership, teams, and projects.',
  user: 'Read and update your profile data, e-mail addresses, and follows.',
  'read:user': 'Read your profile data.',
  'user:email': 'Read your e-mail addresses.',
  'user:follow': 'Follow and unfollow other users.',
  'admin:repo_hook': 'Full control of repository webhooks.',
  'write:repo_hook': 'Read, write, and ping repository webhooks.',
  'read:repo_hook': 'Read repository webhooks.',
  'admin:org_hook': 'Full control of organisation webhooks.',
  'write:packages': 'Upload packages to GitHub Packages.',
  'read:packages': 'Download and install packages from GitHub Packages.',
  'delete:packages': 'Delete packages from GitHub Packages.',
  project: 'Read and write access to Projects.',
  'read:project': 'Read access to Projects.',
  'write:discussion': 'Read and write team discussions.',
  'read:discussion': 'Read team discussions.',
  'admin:public_key': 'Full control of your public SSH keys.',
  'write:public_key': 'Create and list your public SSH keys.',
  'read:public_key': 'List your public SSH keys.',
  'admin:gpg_key': 'Full control of your GPG keys.',
  'write:gpg_key': 'Create and list your GPG keys.',
  'read:gpg_key': 'List your GPG keys.',
  gist: 'Create and edit gists on your behalf.',
  notifications: 'Read your notifications and mark them as read.',
  workflow: 'Create and update GitHub Actions workflow files.',
  codespace: 'Full control of Codespaces.',
  'read:audit_log': 'Read the organisation audit log.',
  openid: 'Confirm your identity. Grants no access to your data.',
  profile: 'Read your basic profile information.',
  email: 'Read your e-mail address.',
  offline_access: 'Keep the connection alive without you signing in again. Grants no data access of its own.',
};

export function scopeDescription(scope: string): string {
  const known = SCOPE_DESCRIPTIONS[scope.trim().toLowerCase()];
  if (known) return known;
  return isReadOnlyScope(scope) ? 'Read-only access granted by the provider for this scope.' : 'Granted by the provider. This scope may allow changes to your data.';
}

export interface ToolRow {
  id: string;
  label: string;
  description: string;
  tag: string;
  granted?: boolean;
}

export type ToolRowSource = 'catalogue' | 'granted-scopes' | 'none';

export interface ToolGroups {
  read: ToolRow[];
  write: ToolRow[];
  source: ToolRowSource;
}

/** The catalogue's own tool list wins whenever it has anything in it — only
 * when it's empty (the common case today) does this fall back to the
 * install's actually-granted OAuth scopes. */
export function buildToolGroups(scope: ConnectorScope, install?: ConnectorInstall | null): ToolGroups {
  if (scope.read.length > 0 || scope.write.length > 0) {
    return {
      read: scope.read.map((t) => ({ id: t.slug, label: t.name, description: t.description, tag: t.tag })),
      write: scope.write.map((t) => ({ id: t.slug, label: t.name, description: t.description, tag: t.tag })),
      source: 'catalogue',
    };
  }
  const scopes = [...new Set((install?.scopes ?? []).map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  if (scopes.length === 0) return { read: [], write: [], source: 'none' };
  const read: ToolRow[] = [];
  const write: ToolRow[] = [];
  for (const value of scopes) {
    const row: ToolRow = { id: value, label: value, description: scopeDescription(value), tag: 'Scope', granted: true };
    (isReadOnlyScope(value) ? read : write).push(row);
  }
  return { read, write, source: 'granted-scopes' };
}

export function toolGroupTitles(source: ToolRowSource): { read: string; write: string } {
  return source === 'granted-scopes'
    ? { read: 'Read-only permissions', write: 'Write / delete permissions' }
    : { read: 'Read-only tools', write: 'Write / delete tools' };
}

export function toolSourceCaption(source: ToolRowSource): string | null {
  return source === 'granted-scopes'
    ? "This connector doesn't publish a tool list, so these are the scopes the provider actually granted for your connection."
    : null;
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

/** One shared date formatter for the whole module (web split this into two
 * different implementations across the connector and skill areas — picked
 * one here rather than porting the inconsistency). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

/* -------------------------------------------------------------------------- */
/* Clone / install copy — keyed by resource, since skills and agents differ  */
/* -------------------------------------------------------------------------- */

export interface CloneCopy {
  saved: string;
  savedTitle: (savedAt: string) => string;
  tierNote: string;
  cloneLabel: (name: string) => string;
  installLabel: string;
  noPermission: string;
  success: (name: string) => string;
  vanished: (name: string) => string;
  fallbackError: string;
}

export const CLONE_COPY: Record<MarketplaceResource, CloneCopy> = {
  skill: {
    saved: 'In your skills',
    savedTitle: (savedAt) => `Saved to your workspace's skills on ${savedAt}. Your copy is independent — editing it doesn't affect the marketplace version.`,
    tierNote: "Cloning a skill saves it to your workspace's skills, available to everyone on the team. You can edit your copy without affecting the marketplace version.",
    cloneLabel: (name) => `Save "${name}" to your workspace's skills`,
    installLabel: 'Save to workspace',
    noPermission: 'You do not have permission to save marketplace skills into this workspace.',
    success: (name) => `"${name}" is in your workspace's skills.`,
    vanished: (name) => `"${name}" is no longer available in the marketplace, so it has been removed from this list.`,
    fallbackError: 'Could not save that skill. Try again.',
  },
  agent: {
    saved: 'Installed',
    savedTitle: (savedAt) => `Installed to your workspace's agents on ${savedAt}. Your copy is independent — editing it doesn't affect the marketplace version.`,
    tierNote: 'Installing an agent creates a real agent in your workspace, available to everyone on the team. It arrives as an unevaluated draft on the default model — evaluate it before publishing.',
    cloneLabel: (name) => `Install "${name}" into your workspace's agents`,
    installLabel: 'Install agent',
    noPermission: 'You do not have permission to install marketplace agents into this workspace.',
    success: (name) => `"${name}" installed as an unevaluated draft — find it under Cloned agents.`,
    vanished: (name) => `"${name}" is no longer available in the marketplace, so it has been removed from this list.`,
    fallbackError: 'Could not install that agent. Try again.',
  },
};

export const ENTRY_DETAIL_COPY: Record<MarketplaceResource, { eyebrow: string; installsLabel: string; noPrompt: string; notFoundTitle: string; notFoundDescription: string; errorTitle: string; errorDescription: string }> = {
  skill: {
    eyebrow: 'Skills marketplace',
    installsLabel: 'Copies',
    noPrompt: 'This entry has no prompt.',
    notFoundTitle: 'Skill not found',
    notFoundDescription: 'This listing may have been removed from the marketplace since the page loaded.',
    errorTitle: "Couldn't load this skill",
    errorDescription: "The marketplace service didn't answer for this entry.",
  },
  agent: {
    eyebrow: 'Agent marketplace',
    installsLabel: 'Installs',
    noPrompt: 'This entry has no prompt.',
    notFoundTitle: 'Agent not found',
    notFoundDescription: 'This listing may have been removed from the marketplace since the page loaded.',
    errorTitle: "Couldn't load this agent",
    errorDescription: "The marketplace service didn't answer for this entry.",
  },
};

/** `null` (not `0`) when the server sent no count at all — a missing
 * `_count` is a listing whose install count was not sent, not a listing
 * with zero installs. */
export function installTotal(entry: MarketplaceEntry): number | null {
  const counts = (entry._count ?? {}) as { clonedAgents?: number; tenantClones?: number; customerClones?: number };
  if (typeof counts.clonedAgents === 'number') return counts.clonedAgents;
  const { tenantClones, customerClones } = counts;
  if (typeof tenantClones !== 'number' && typeof customerClones !== 'number') return null;
  return (tenantClones ?? 0) + (customerClones ?? 0);
}

export const CATALOGUE_LEAD: Record<MarketplaceResource, string> = {
  skill: 'Browsing the Skills Marketplace — everything published on the platform.',
  agent: 'Browsing the Agent Marketplace — everything published on the platform.',
};

export const MARKETPLACE_COPY: Record<MarketplaceResource, { searchPlaceholder: string; noun: string; nounPlural: string; emptyTitle: string; emptyDescription: string; noMatchTitle: string; noMatchDescription: string; errorTitle: string; errorDescription: string }> = {
  skill: {
    searchPlaceholder: 'Search skills',
    noun: 'skill',
    nounPlural: 'skills',
    emptyTitle: 'No skills published yet',
    emptyDescription: 'Published skills appear here for you to browse, with the category they belong to and what each one does.',
    noMatchTitle: 'No skills match',
    noMatchDescription: 'No published skill matches that name. Clear the search to see all of them.',
    errorTitle: "Couldn't load skills",
    errorDescription: "The marketplace service didn't respond. Check that the gateway is running, then try again.",
  },
  agent: {
    searchPlaceholder: 'Search agents',
    noun: 'agent',
    nounPlural: 'agents',
    emptyTitle: 'No agents published yet',
    emptyDescription: 'Published agents appear here for you to browse, with the category they belong to and what each one does.',
    noMatchTitle: 'No agents match',
    noMatchDescription: 'No published agent matches that name. Clear the search to see all of them.',
    errorTitle: "Couldn't load agents",
    errorDescription: "The marketplace service didn't respond. Check that the gateway is running, then try again.",
  },
};

/* -------------------------------------------------------------------------- */
/* Owned skills                                                              */
/* -------------------------------------------------------------------------- */

export const OWN_BADGE_LABEL = 'My skill';
export const OWN_BADGE_TOOLTIP = 'Authored in this workspace. Its content is yours to edit and delete.';
export const CLONED_BADGE_LABEL = 'Cloned skill';
export const CLONED_BADGE_TOOLTIP = "Installed from the Skills Marketplace. It is a snapshot taken at install time — the content belongs to the catalogue entry, so it cannot be edited or deleted here.";

export const SKILLS_BACKEND_GAP = 'Install one from the marketplace to get started. Authoring your own is not available yet — the platform has no endpoint to create or list a workspace skill.';

export const NO_AUTHOR_TOOLTIP = 'Adding a skill needs both the "Manage marketplace" and "Install from marketplace" permissions — it publishes a listing and then installs it into this workspace. Ask an owner or an admin to grant them.';

export const SESSION_SCOPE_NOTE =
  "This session only: this list can only show skills added or installed since you opened the app. There is no endpoint yet that lists what the workspace already holds, so a restart empties it. Nothing is lost — a skill you added stays published and installed, and it can be found again under Marketplace.";

export const SKILL_DETAIL_GAP =
  "That is all there is: this is everything the platform exposes about an installed skill. There is no endpoint yet that reads one back, so its prompt and version are not available here — what you see comes from the install and the catalogue listing it was taken from.";

export function emptyOwnedSkillsDescription(canInstall: boolean): string {
  return canInstall
    ? SKILLS_BACKEND_GAP
    : 'Installing a skill from the marketplace needs the "Install from marketplace" permission — ask an owner or an admin to grant it. Authoring your own is not available yet on any role.';
}

export const CREATE_SKILL_COPY = {
  title: 'Add skill',
  description:
    "This publishes the skill to the platform's Skills Marketplace, where every workspace can see and install it, and then installs a copy into this workspace so it appears under My skills. The published listing cannot be removed from this app.",
  submitLabel: 'Publish and install',
  publishFailed: 'Could not publish that skill. Nothing has been created.',
  cloneFailed: (name: string) =>
    `"${name}" was published to the marketplace, but installing it into this workspace failed. Find it under Marketplace and install it from there — do not add it again, or it will be published twice.`,
  success: (name: string) => `"${name}" published and installed — it is in your skills.`,
} as const;
