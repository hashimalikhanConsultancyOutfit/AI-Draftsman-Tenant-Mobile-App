/**
 * SYSTEM ROLES — mirrors libs/b2b-shared/src/permissions/system-roles.ts.
 *
 * This is reference data only (e.g. for a QA/dev screen that shows "what
 * should this role be able to do"). It must NEVER be used to gate a screen —
 * authorization always runs off the session's own `rolePermissions` array via
 * holdsPermission(), not off a role NAME. A tenant can rename or edit a
 * custom role; only the declared permission tokens are ground truth.
 */

export const SYSTEM_ROLE_NAMES = ['owner', 'admin', 'builder', 'finance', 'member'] as const;

export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number];

export const OWNER_ROLE_NAME: SystemRoleName = 'owner';

export const isOwnerRole = (name: string): boolean => name.trim().toLowerCase() === OWNER_ROLE_NAME;

/** What each seeded system role is granted — for reference/QA only. */
export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRoleName, readonly string[]> = {
  owner: ['*'],

  admin: [
    'tenant:read',
    'tenant:write',
    'user:read',
    'user:write',
    'agent:*',
    'key:*',
    'customer:*',
    'usage:read',
    'support:*',
    'role.manage',
    'audit.view',
    'dashboard.view',
    'checklist.view',
  ],

  builder: [
    'agent:read',
    'agent:write',
    'agent:evaluate',
    'key:read',
    'support:read',
    'support:write',
    'support:reply',
    'support:escalate',
    'customer.view',
    'dashboard.view',
    'usage.view',
  ],

  finance: [
    'usage:read',
    'billing:read',
    'invoice:read',
    'support:read',
    'dashboard.view',
    'usage.export',
    'billing.manage',
  ],

  member: ['agent:run', 'chat:*', 'support:read', 'support.create', 'dashboard.view', 'agent.view'],
};

/** The tokens a system role is seeded with, or `[]` for a name that is not one. */
export const systemRolePermissions = (name: string): string[] => {
  const tokens = SYSTEM_ROLE_PERMISSIONS[name as SystemRoleName];
  return tokens ? [...tokens] : [];
};
