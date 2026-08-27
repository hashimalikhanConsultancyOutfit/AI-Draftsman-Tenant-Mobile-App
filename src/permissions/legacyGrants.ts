/**
 * =============================================================================
 * LEGACY GRANTS — mirrored byte-for-byte in intent from the backend
 * =============================================================================
 * Source: libs/b2b-shared/src/permissions/legacy-grants.ts (read directly from
 * the `ai-draftsman` backend source, in full).
 *
 * A map from a coarse token that SEEDED system roles still declare, to the
 * atomic catalogue slugs it grants. The owner account returned by
 * `verify-otp` in this app's own test login holds `rolePermissions: ["*"]`,
 * but every other seeded role (admin/builder/finance/member) declares a mix
 * of these coarse tokens — so a client that only recognised atomic slugs
 * would hide screens those roles actually have access to on the web app.
 *
 * This table must stay identical to the backend's copy. If a permission gate
 * in this app disagrees with what the web app shows for the same account,
 * this file — or its resolver in holdsPermission.ts — is the first place to
 * check for drift.
 *
 * Deliberately absent (per the backend's own comments, carried over here):
 *   `*`             — a RULE, not a list. See holdsPermission.ts.
 *   `ticket.manage` — seeded to admin but nothing enforces it; admins already
 *                     get every support slug through `support:*`.
 *   `tenant.*`, `data_rights.view` — no portal surface at all.
 * =============================================================================
 */

/** Grants everything, platform-wide, including permissions that ship later. */
export const FULL_ACCESS_TOKEN = '*';

/**
 * Coarse token -> the atomic slugs it grants.
 * Read only by `holdsPermission` and `expandPermissions` below.
 */
export const LEGACY_GRANTS: Readonly<Record<string, readonly string[]>> = {
  /* ── Roles & permissions ──────────────────────────────────────────────── */
  'role.manage': ['role.view', 'permission.view', 'role.create', 'role.update', 'role.delete'],

  /* ── Customers ─────────────────────────────────────────────────────────
   * `customer.manage` covers the six writes only — deliberately NOT
   * `customer.view` ("manage does not imply view"). `customer:*` is a
   * module wildcard and does cover the read. */
  'customer.manage': [
    'customer.create',
    'customer.update',
    'customer.suspend',
    'customer.resume',
    'customer.delete',
    'customer.import',
  ],
  'customer:*': [
    'customer.view',
    'customer.create',
    'customer.update',
    'customer.suspend',
    'customer.resume',
    'customer.delete',
    'customer.import',
  ],

  /* ── Team ─────────────────────────────────────────────────────────────── */
  'user.manage': ['user.assign_role', 'user.remove'],
  'user:read': ['user.view'],
  'user:write': ['user.invite', 'user.assign_role', 'user.remove'],
  'user:*': ['user.view', 'user.invite', 'user.assign_role', 'user.remove'],

  /* ── Support ──────────────────────────────────────────────────────────── */
  'support:read': ['support.view'],
  'support:write': ['support.create', 'support.update'],
  'support:reply': ['support.reply'],
  'support:escalate': ['support.escalate'],
  'support:delete': ['support.delete'],
  'support:*': [
    'support.view',
    'support.create',
    'support.update',
    'support.reply',
    'support.escalate',
    'support.delete',
  ],

  /* ── Company agents ───────────────────────────────────────────────────── */
  'agent:read': ['agent.view'],
  'agent:write': ['agent.build', 'agent.publish'],
  'agent:evaluate': ['agent.evaluate'],
  'agent:*': ['agent.view', 'agent.build', 'agent.evaluate', 'agent.publish', 'agent.clone'],

  /* Both spellings are seeded on different code paths — see backend comment. */
  'agent.run': ['playground.run', 'chat.send'],
  'agent:run': ['playground.run', 'chat.send'],

  /* ── API keys ─────────────────────────────────────────────────────────── */
  'key.manage': [
    'key.create',
    'key.update',
    'key.rotate',
    'key.revoke',
    'key_policy.manage',
    'key_policy.delete',
  ],
  'key:read': ['key.view', 'key_policy.view'],
  'key:*': [
    'key.view',
    'key.create',
    'key.update',
    'key.rotate',
    'key.revoke',
    'key_policy.view',
    'key_policy.manage',
    'key_policy.delete',
  ],

  /* ── Chat ─────────────────────────────────────────────────────────────── */
  'chat:*': ['chat.view', 'chat.manage', 'chat.send'],

  /* ── Money reads ──────────────────────────────────────────────────────── */
  'usage:read': ['usage.view'],
  'billing:read': ['billing.view'],
  'invoice:read': ['invoice.view'],
};
