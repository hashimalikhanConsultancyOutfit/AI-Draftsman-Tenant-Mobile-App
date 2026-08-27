/**
 * =============================================================================
 * PERMISSION CATALOGUE — mirrored from the backend, verbatim
 * =============================================================================
 * Source of truth: libs/b2b-prisma/prisma/seed/permission-catalogue.ts in the
 * `ai-draftsman` backend (read directly, not from the earlier analysis doc,
 * because that doc had flagged some legacy rows as unconfirmed).
 *
 * This is the canonical vocabulary: 89 atomic slugs, the `*` wildcard, and the
 * legacy compatibility tokens that live seeded roles still carry. Nothing here
 * is invented — every slug below is a row the backend seeds into
 * `b2b_permission`, and the grouping/order matches the Roles & Permissions
 * screen's own module tree so the mobile app's copy (if it ever renders one)
 * reads the same way.
 *
 * This file does not decide anything by itself — see holdsPermission.ts for
 * the resolution rule and legacyGrants.ts for what a coarse token covers.
 * =============================================================================
 */

export interface PermissionCatalogueEntry {
  slug: string;
  module: string;
  label: string;
  description?: string;
  isWildcard?: boolean;
  isLegacy?: boolean;
}

export const PERMISSION_CATALOGUE: readonly PermissionCatalogueEntry[] = [
  /* ── Tenant portal ─────────────────────────────────────────────────────── */
  { slug: 'dashboard.view', module: 'Dashboard', label: 'View dashboard' },

  { slug: 'checklist.view', module: 'Getting Started', label: 'View activation checklist' },
  { slug: 'checklist.manage', module: 'Getting Started', label: 'Update activation checklist' },

  { slug: 'chat.view', module: 'Chat', label: 'View chat threads and transcripts' },
  { slug: 'chat.manage', module: 'Chat', label: 'Create, rename and delete threads' },
  {
    slug: 'chat.send',
    module: 'Chat',
    label: 'Send messages to agents',
    description:
      'Invokes a model and spends from the wallet. Separate from thread management, which does not.',
  },

  { slug: 'playground.view', module: 'Playground', label: 'Open the playground' },
  {
    slug: 'playground.run',
    module: 'Playground',
    label: 'Run prompts in the playground',
    description: 'Runs arbitrary prompts against a model. Un-metered spend — grant deliberately.',
  },

  { slug: 'agent.view', module: 'Company Agents', label: 'View agents and version history' },
  { slug: 'agent.build', module: 'Company Agents', label: 'Create and edit agents' },
  { slug: 'agent.evaluate', module: 'Company Agents', label: 'Run the evaluation gate' },
  {
    slug: 'agent.publish',
    module: 'Company Agents',
    label: 'Publish agent versions',
    description: 'Cuts a new master version that customers receive.',
  },
  {
    slug: 'agent.restore',
    module: 'Company Agents',
    label: 'Restore an earlier prompt version',
    description: 'Rolls a live definition back to a previous version.',
  },
  {
    slug: 'agent.clone',
    module: 'Company Agents',
    label: 'Clone agents out to customers',
    description: 'Writes into customer workspaces — a cross-boundary act, not authoring.',
  },
  {
    slug: 'agent.delete',
    module: 'Company Agents',
    label: 'Delete agents',
    description: 'Irreversible, and orphans every deployed clone.',
  },

  { slug: 'clone.view', module: 'Customer Agents', label: 'View deployed clones' },
  { slug: 'clone.manage', module: 'Customer Agents', label: 'Edit and pin clones' },
  {
    slug: 'clone.reclone',
    module: 'Customer Agents',
    label: 'Re-clone from master',
    description: "Discards the customer's local edits. Not reversible.",
  },
  { slug: 'clone.delete', module: 'Customer Agents', label: 'Delete clones' },
  {
    slug: 'clone.push',
    module: 'Customer Agents',
    label: 'Push master versions to clones',
    description: 'One action writes every clone in the fleet. The widest blast radius in the module.',
  },
  { slug: 'clone.rollback', module: 'Customer Agents', label: 'Undo the last push' },

  {
    slug: 'knowledge_base.view',
    module: 'Knowledge Bases',
    label: 'View knowledge bases and their documents',
  },
  {
    slug: 'knowledge_base.manage',
    module: 'Knowledge Bases',
    label: 'Create and edit knowledge bases',
    description: 'Includes changing scope, which decides which customers can retrieve from a base.',
  },
  { slug: 'knowledge_base.upload', module: 'Knowledge Bases', label: 'Upload documents' },
  { slug: 'knowledge_base.reindex', module: 'Knowledge Bases', label: 'Reindex a knowledge base' },
  {
    slug: 'knowledge_base.delete',
    module: 'Knowledge Bases',
    label: 'Delete a knowledge base',
    description: 'Purges the base and its documents across all surfaces.',
  },

  { slug: 'customer.view', module: 'Customers', label: 'View the customer registry, stats and detail' },
  { slug: 'customer.create', module: 'Customers', label: 'Register customers' },
  { slug: 'customer.update', module: 'Customers', label: 'Edit customers' },
  {
    slug: 'customer.suspend',
    module: 'Customers',
    label: 'Suspend customers',
    description: "Cuts off a paying customer's access. Requires a reason.",
  },
  { slug: 'customer.resume', module: 'Customers', label: 'Resume suspended customers' },
  {
    slug: 'customer.delete',
    module: 'Customers',
    label: 'Delete customers',
    description: 'Cascades to every clone deployed to that customer.',
  },
  {
    slug: 'customer.import',
    module: 'Customers',
    label: 'Import customers from CSV',
    description: 'Bulk registration through a server-side job, including the apply step that commits it.',
  },

  { slug: 'lead.view', module: 'Leads', label: 'View the lead pipeline and scoring reasoning' },
  { slug: 'lead.create', module: 'Leads', label: 'Add leads' },
  { slug: 'lead.update', module: 'Leads', label: 'Edit leads and move pipeline stage' },
  {
    slug: 'lead.score',
    module: 'Leads',
    label: 'Run the lead scoring agent',
    description: 'Invokes an agent across the pipeline and spends.',
  },
  {
    slug: 'lead.delete',
    module: 'Leads',
    label: 'Delete leads',
    description:
      'A hard delete: the lead, its scoring reasoning and every attached file, records and blobs both.',
  },

  { slug: 'lead_criteria.view', module: 'Lead criteria', label: 'View lead criteria sets and their rules' },
  {
    slug: 'lead_criteria.manage',
    module: 'Lead criteria',
    label: 'Create, edit and delete lead criteria and their rules',
    description: 'Decides which leads the pipeline qualifies, and the weights behind every score.',
  },

  { slug: 'report.view', module: 'Reports', label: 'View reports and run history' },
  { slug: 'report.manage', module: 'Reports', label: 'Create and edit reports' },
  { slug: 'report.run', module: 'Reports', label: 'Run a report on demand' },
  {
    slug: 'report.download',
    module: 'Reports',
    label: 'Download report run artifacts',
    description: 'Pulls the exported activity data out of the platform — the most sensitive read on the page.',
  },
  { slug: 'report.delete', module: 'Reports', label: 'Delete reports' },

  /* ── Administration ────────────────────────────────────────────────────── */
  { slug: 'connector.view', module: 'Marketplace', label: 'Browse the connector catalogue' },
  { slug: 'connector.connect', module: 'Marketplace', label: 'Connect a third-party integration' },
  { slug: 'marketplace.view', module: 'Marketplace', label: 'View marketplace skills and agents' },
  {
    slug: 'marketplace.manage',
    module: 'Marketplace',
    label: 'Create and edit marketplace skills and agents',
  },
  { slug: 'marketplace.delete', module: 'Marketplace', label: 'Delete marketplace skills and agents' },
  { slug: 'marketplace.install', module: 'Marketplace', label: 'Install an agent from the marketplace' },

  { slug: 'key.view', module: 'API Keys', label: 'View API keys and their usage' },
  {
    slug: 'key.create',
    module: 'API Keys',
    label: 'Issue API keys',
    description: 'Mints a live credential that spends real money. The secret is shown once.',
  },
  { slug: 'key.update', module: 'API Keys', label: 'Edit API keys' },
  {
    slug: 'key.rotate',
    module: 'API Keys',
    label: 'Rotate API keys',
    description: 'Opens an overlap window and forces a redeploy. Keeps service running.',
  },
  {
    slug: 'key.revoke',
    module: 'API Keys',
    label: 'Revoke API keys',
    description: 'Breaks live integrations immediately.',
  },

  { slug: 'key_policy.view', module: 'API Key Policies', label: 'View key policies' },
  {
    slug: 'key_policy.manage',
    module: 'API Key Policies',
    label: 'Create and edit key policies',
    description: 'Policies carry spend caps, rate limits, IP allow-lists and the training flag.',
  },
  { slug: 'key_policy.delete', module: 'API Key Policies', label: 'Delete key policies' },

  { slug: 'usage.view', module: 'Usage & Spend', label: 'View consumption breakdowns' },
  {
    slug: 'usage.export',
    module: 'Usage & Spend',
    label: 'Export usage data',
    description: 'Bulk extraction, distinct from reading figures on screen.',
  },

  {
    slug: 'billing.view',
    module: 'Billing',
    label: 'View billing, wallet and money figures',
    description:
      'Also gates every money figure elsewhere in the portal — dashboard, customers, API keys, usage, audit log.',
  },
  { slug: 'billing.manage', module: 'Billing', label: 'Edit spend limits and cap' },
  { slug: 'billing.topup', module: 'Billing', label: 'Top up the wallet', description: 'Moves real money.' },

  { slug: 'invoice.view', module: 'Invoices', label: 'View payable and receivable invoices' },

  {
    slug: 'price_override.manage',
    module: 'Price Overrides',
    label: 'Create and edit price overrides',
    description: 'Decides what customers are charged.',
  },
  { slug: 'price_override.delete', module: 'Price Overrides', label: 'Delete price overrides' },

  { slug: 'branding.view', module: 'Branding', label: 'View branding, white-label level and model aliases' },
  { slug: 'branding.manage', module: 'Branding', label: 'Edit brand identity' },

  { slug: 'domain.manage', module: 'Domain', label: 'Add and configure the custom domain' },
  { slug: 'domain.verify', module: 'Domain', label: 'Run a DNS verification check' },
  {
    slug: 'domain.remove',
    module: 'Domain',
    label: 'Disconnect the custom domain',
    description: 'Takes the customer-facing portal dark.',
  },

  { slug: 'model_alias.manage', module: 'Model Aliases', label: 'Edit model aliases and their visibility' },

  { slug: 'user.view', module: 'Team', label: 'View the team roster' },
  { slug: 'user.invite', module: 'Team', label: 'Invite team members' },
  {
    slug: 'user.assign_role',
    module: 'Team',
    label: "Assign and change a member's role",
    description: 'Privilege escalation. Assigning a role is how someone gains authority without any role being edited.',
  },
  { slug: 'user.remove', module: 'Team', label: 'Remove members and withdraw invitations' },

  { slug: 'role.view', module: 'Roles & Permissions', label: 'View roles' },
  {
    slug: 'permission.view',
    module: 'Roles & Permissions',
    label: 'View the permission catalogue',
    description: 'The full list of what the platform can do. Needed by the Add/Edit Role screens.',
  },
  { slug: 'role.create', module: 'Roles & Permissions', label: 'Create roles' },
  {
    slug: 'role.update',
    module: 'Roles & Permissions',
    label: 'Edit roles and their permissions',
    description: "Rewrites what every current holder of the role may do, on their next request.",
  },
  { slug: 'role.delete', module: 'Roles & Permissions', label: 'Delete roles' },

  { slug: 'notification.view', module: 'Notifications', label: 'View the workspace notification matrix' },
  { slug: 'notification.manage', module: 'Notifications', label: 'Change notification delivery settings' },

  { slug: 'audit.view', module: 'Audit Log', label: 'View the audit log' },
  {
    slug: 'audit.export',
    module: 'Audit Log',
    label: 'Export the audit log',
    description: 'Extracts the security record, including impersonation entries.',
  },

  { slug: 'support.view', module: 'Support', label: 'View the support inbox and ticket threads' },
  { slug: 'support.create', module: 'Support', label: 'Raise tickets' },
  { slug: 'support.update', module: 'Support', label: 'Edit tickets and assign owners' },
  { slug: 'support.reply', module: 'Support', label: 'Reply to tickets' },
  {
    slug: 'support.escalate',
    module: 'Support',
    label: 'Escalate to the platform team and bring tickets back',
    description: 'Crosses the tenant boundary with a redaction disclosure. Covers both directions.',
  },
  { slug: 'support.delete', module: 'Support', label: 'Delete tickets' },

  /* ── Full access ───────────────────────────────────────────────────────── */
  {
    slug: '*',
    module: 'Full Access',
    label: 'Full access to everything in the workspace',
    description: 'Held by every seeded owner role. Auto-inherits permissions that ship later.',
    isWildcard: true,
  },

  /* ── Legacy compatibility — never offered as a checkbox, only resolved ──── */
  { slug: 'customer:*', module: 'Legacy Compatibility', label: 'Legacy — all customer permissions', isWildcard: true, isLegacy: true },
  { slug: 'user:*', module: 'Legacy Compatibility', label: 'Legacy — all user permissions', isWildcard: true, isLegacy: true },
  { slug: 'agent:*', module: 'Legacy Compatibility', label: 'Legacy — all agent permissions', isWildcard: true, isLegacy: true },
  { slug: 'key:*', module: 'Legacy Compatibility', label: 'Legacy — all API key permissions', isWildcard: true, isLegacy: true },
  { slug: 'chat:*', module: 'Legacy Compatibility', label: 'Legacy — all chat permissions', isWildcard: true, isLegacy: true },
  { slug: 'support:*', module: 'Legacy Compatibility', label: 'Legacy — all support permissions', isWildcard: true, isLegacy: true },
  { slug: 'customer.manage', module: 'Legacy Compatibility', label: 'Legacy — manage customers', isLegacy: true },
  { slug: 'user.manage', module: 'Legacy Compatibility', label: 'Legacy — manage users', isLegacy: true },
  { slug: 'key.manage', module: 'Legacy Compatibility', label: 'Legacy — manage API keys', isLegacy: true },
  { slug: 'role.manage', module: 'Legacy Compatibility', label: 'Legacy — manage roles', isLegacy: true },
  { slug: 'ticket.manage', module: 'Legacy Compatibility', label: 'Legacy — manage support tickets', isLegacy: true },
  { slug: 'tenant.view', module: 'Legacy Compatibility', label: 'Legacy — view tenant profile', isLegacy: true },
  { slug: 'tenant.manage', module: 'Legacy Compatibility', label: 'Legacy — manage tenant profile', isLegacy: true },
  { slug: 'data_rights.view', module: 'Legacy Compatibility', label: 'Legacy — view data rights', isLegacy: true },
  { slug: 'agent.run', module: 'Legacy Compatibility', label: 'Legacy — run agents', isLegacy: true },
  { slug: 'tenant:read', module: 'Legacy Compatibility', label: 'Legacy — read tenant', isLegacy: true },
  { slug: 'tenant:write', module: 'Legacy Compatibility', label: 'Legacy — write tenant', isLegacy: true },
  { slug: 'user:read', module: 'Legacy Compatibility', label: 'Legacy — read users', isLegacy: true },
  { slug: 'user:write', module: 'Legacy Compatibility', label: 'Legacy — write users', isLegacy: true },
  { slug: 'agent:read', module: 'Legacy Compatibility', label: 'Legacy — read agents', isLegacy: true },
  { slug: 'agent:write', module: 'Legacy Compatibility', label: 'Legacy — write agents', isLegacy: true },
  { slug: 'agent:evaluate', module: 'Legacy Compatibility', label: 'Legacy — evaluate agents', isLegacy: true },
  { slug: 'agent:run', module: 'Legacy Compatibility', label: 'Legacy — run agents', isLegacy: true },
  { slug: 'key:read', module: 'Legacy Compatibility', label: 'Legacy — read API keys', isLegacy: true },
  { slug: 'usage:read', module: 'Legacy Compatibility', label: 'Legacy — read usage', isLegacy: true },
  { slug: 'billing:read', module: 'Legacy Compatibility', label: 'Legacy — read billing', isLegacy: true },
  { slug: 'invoice:read', module: 'Legacy Compatibility', label: 'Legacy — read invoices', isLegacy: true },
  { slug: 'support:read', module: 'Legacy Compatibility', label: 'Legacy — read support', isLegacy: true },
  { slug: 'support:write', module: 'Legacy Compatibility', label: 'Legacy — write support', isLegacy: true },
  { slug: 'support:reply', module: 'Legacy Compatibility', label: 'Legacy — reply to support tickets', isLegacy: true },
  { slug: 'support:escalate', module: 'Legacy Compatibility', label: 'Legacy — escalate support tickets', isLegacy: true },
  { slug: 'support:delete', module: 'Legacy Compatibility', label: 'Legacy — delete support tickets', isLegacy: true },
];

export const ATOMIC_PERMISSION_SLUGS: readonly string[] = PERMISSION_CATALOGUE.filter(
  (p) => !p.isWildcard && !p.isLegacy,
).map((p) => p.slug);
