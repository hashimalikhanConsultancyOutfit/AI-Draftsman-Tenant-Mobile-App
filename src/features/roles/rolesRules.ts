/**
 * ROLES & PERMISSIONS — copy and rules.
 *
 * Ported from web's `Roles.data.ts` and the row/lock functions in
 * `permissionCatalogue.ts` (confirmed against both 2026-09-04). Follows the
 * same shape as `teamRules.ts`: pure copy constants + guard functions, no
 * store, no render.
 */

import { isOwnerRole } from '@/permissions/systemRoles';

import type { RoleSummary } from './roles.types';

export const ROLE_NAME_MAX_LENGTH = 64;
export const ROLE_DESCRIPTION_MAX_LENGTH = 200;

/* -------------------------------------------------------------------------- */
/* List screen                                                                */
/* -------------------------------------------------------------------------- */

export const ROLES_DESCRIPTION = 'What each role in this workspace may do. Assigning a person to a role is done from Team.';

export const SEARCH_PLACEHOLDER = 'Search roles';

export const EMPTY_TITLE = 'No roles yet';
export const EMPTY_DESCRIPTION = 'Create a role, choose what it may do, then assign people to it from Team.';
export const SEARCH_EMPTY_TITLE = 'No roles match that search';
export const SEARCH_EMPTY_DESCRIPTION = "Search matches a role's name and its description. Clear it to see them all.";
export const LIST_ERROR_TITLE = 'Could not load your roles';

/* -------------------------------------------------------------------------- */
/* Permission picker                                                         */
/* -------------------------------------------------------------------------- */

export const FULL_ACCESS_LABEL = 'Full Access';
export const FULL_ACCESS_NOTE = 'Grants everything this platform can do, including capabilities added in future releases. Individual permissions are locked while this is on.';
export const PERMISSIONS_SECTION_LABEL = 'Select permissions';
export const CATALOGUE_EMPTY_MESSAGE = 'This deployment has no selectable permissions seeded, so a role cannot be given any.';
export const CATALOGUE_BLOCKED_MESSAGE = 'The permission catalogue could not be loaded, so a role cannot be created or edited right now.';

/* -------------------------------------------------------------------------- */
/* Form                                                                       */
/* -------------------------------------------------------------------------- */

export const ROLE_NAME_LABEL = 'Role name';
export const ROLE_NAME_HINT = 'Stored lower-cased, and unique within this workspace.';
export const ROLE_DESCRIPTION_LABEL = 'Description';
export const ROLE_DESCRIPTION_HINT = 'Optional. What this role is for.';
export const CREATE_TITLE = 'Add role';
export const EDIT_TITLE = 'Edit role';
export const CREATE_SUBMIT_LABEL = 'Create role';
export const EDIT_SUBMIT_LABEL = 'Save changes';
export const PERMISSIONS_REQUIRED_MESSAGE = 'Choose at least one permission, or turn on Full Access.';

/** Web's `buildDroppedPermissionsNote` — the warning when a role holds
 * legacy/wildcard tokens the catalogue no longer offers as checkboxes.
 * Saving replaces the whole set, so these are about to be removed. */
export const buildDroppedPermissionsNote = (slugs: string[]): string =>
  `This role also holds ${slugs.length} older ${slugs.length === 1 ? 'permission' : 'permissions'} that can no longer be assigned (${slugs.join(', ')}). Saving replaces the whole set, so ${
    slugs.length === 1 ? 'it' : 'they'
  } will be removed.`;

/* -------------------------------------------------------------------------- */
/* System roles                                                               */
/* -------------------------------------------------------------------------- */

export const SYSTEM_ROLE_NAME_LOCKED_HINT = 'System role names cannot be changed — people are signed in against this name.';
export const OWNER_PERMISSIONS_LOCKED_NOTE = "The Owner role has permanent Full Access and its permissions cannot be changed. Its description can still be edited.";
export const SYSTEM_ROLE_EDIT_NOTE = 'This is a system role. Its description and permissions can be changed; its name cannot.';

/** The row caption for a system role, mobile's stand-in for web's four
 * hover-tooltip variants (no hover on a phone, so this renders as text
 * under the role name instead). */
export const systemRoleCaption = (row: { isSystem: boolean }, viewerIsOwner: boolean, rowIsOwner: boolean): string | null => {
  if (!row.isSystem) return null;
  if (rowIsOwner) {
    return viewerIsOwner
      ? 'This is the workspace Owner and it has permanent Full Access. You can edit its description; its name, its permissions and its existence are fixed.'
      : 'This is the workspace Owner and it holds permanent Full Access. Only the Owner can edit it, and it can never be deleted.';
  }
  return viewerIsOwner
    ? 'This is a system role. You can edit its description and permissions, but its name cannot be changed and it can never be deleted.'
    : 'This is a system role. Every workspace is provisioned with it — only the Owner can edit it, and it can never be deleted.';
};

export const SYSTEM_ROLE_BLOCKED_MESSAGE = 'Only the Owner can edit a system role. Create a role instead.';
export const SYSTEM_ROLE_DELETE_BLOCKED_MESSAGE = 'System roles cannot be deleted, the Owner included. Create a role instead.';

/* -------------------------------------------------------------------------- */
/* Authorisation                                                              */
/* -------------------------------------------------------------------------- */

export const NO_UPDATE_MESSAGE = 'You do not have permission to edit roles in this workspace.';
export const NO_DELETE_MESSAGE = 'You do not have permission to delete roles in this workspace.';
export const NO_CREATE_MESSAGE = 'You do not have permission to create roles in this workspace.';
export const NO_VIEW_DESCRIPTION = 'Viewing roles needs the "View roles" permission. Ask an owner or an admin to grant it.';

/**
 * One role row's two actions — mirrors web's `canEditRoleRow`/
 * `canDeleteRoleRow`. Three facts, different in kind: `isSystem` is a
 * property of the ROW, `canUpdate`/`canDelete` are properties of the
 * caller's OWN grants, `viewerIsOwner` is a property of WHO IS ASKING
 * (never derived from the row). Delete has NO owner exemption — refused
 * for every system role, deliberately asymmetric with edit.
 */
export const canEditRoleRow = (row: { isSystem: boolean }, canUpdate: boolean, viewerIsOwner = false): boolean => canUpdate && (!row.isSystem || viewerIsOwner);

export const canDeleteRoleRow = (row: { isSystem: boolean }, canDelete: boolean): boolean => canDelete && !row.isSystem;

export interface RoleEditLocks {
  /** The name is fixed — true for every system role. */
  isNameLocked: boolean;
  /** The permission set is fixed — true for the Owner row only. */
  isPermissionsLocked: boolean;
}

/**
 * What the Edit form may change on a given row:
 *   custom                              name, description, permissions
 *   admin | builder | finance | member  description, permissions
 *   owner                               description
 */
export const roleEditLocks = (row: { isSystem: boolean; isOwner: boolean }): RoleEditLocks => ({
  isNameLocked: row.isSystem,
  isPermissionsLocked: row.isSystem && row.isOwner,
});

/** Is this row the workspace Owner? Takes the stored (lower-case) name. */
export const isOwnerRoleRow = (row: Pick<RoleSummary, 'name'>): boolean => isOwnerRole(row.name);

/** `customer manager` -> `Customer manager`. Presentation only, and only
 * ever on the way OUT — the stored name is what a write must send back,
 * and what a comparison must read. Only the first character, not every
 * word — matches `toRoleLabel` in `teamRules.ts`, so one role does not
 * read two ways on two screens. */
export const toRoleDisplayName = (name: string): string => (name.length === 0 ? name : `${name.charAt(0).toUpperCase()}${name.slice(1)}`);

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

export const buildDeleteWarning = (name: string, memberCount: number): string => {
  if (memberCount > 0) {
    return `${name} is assigned to ${memberCount} ${memberCount === 1 ? 'person' : 'people'}. Move them to another role first — this delete will be refused while anybody holds it.`;
  }
  return `${name} will be removed from this workspace, along with everything it grants. This cannot be undone.`;
};

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

/** Fallback copy for a failed request — the server's own message is
 * preferred wherever it sent one; this only fills the gap when it didn't. */
export const rolesErrorFallback = (status: number | undefined, action: string): string => {
  if (status === 403) return `Your role cannot ${action}.`;
  if (status === 404) return 'That role no longer exists in this workspace.';
  if (status === 0) return 'Cannot reach the server. Check your connection and try again.';
  return `Could not ${action}.`;
};
