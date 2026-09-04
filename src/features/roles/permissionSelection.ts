/**
 * PERMISSION SELECTION — the pure functions behind the Add/Edit Role
 * permission tree.
 *
 * Ported near-verbatim from web's `src/store/api/permissionCatalogue.ts`
 * (confirmed against that source 2026-09-04) — these were already
 * framework-agnostic there (no MUI, no React), so the port is mechanical.
 * Kept as one small file rather than folded into `rolesRules.ts` because
 * `tools/checks/`-style unit coverage on web tests this file in isolation,
 * with no store and no render, and mobile should be able to do the same.
 */

import { FULL_ACCESS_TOKEN } from '@/permissions/legacyGrants';

import type { PermissionModule, RoleDetail } from './roles.types';

export type ModuleSelectionState = 'none' | 'partial' | 'all';

/** Every selectable slug the catalogue offers, flattened. */
export const catalogueSlugs = (modules: PermissionModule[]): string[] => modules.flatMap((group) => group.permissions.map((entry) => entry.slug));

/** The slugs of one module, in the order its checkboxes render. */
export const moduleSlugs = (group: PermissionModule): string[] => group.permissions.map((entry) => entry.slug);

/** Add or remove one permission. Returns a NEW array. */
export const togglePermission = (selected: readonly string[], slug: string, checked: boolean): string[] => {
  if (checked) {
    return selected.includes(slug) ? [...selected] : [...selected, slug];
  }
  return selected.filter((entry) => entry !== slug);
};

/** Select or clear a whole module. Checking adds every slug the module
 * offers as a UNION with what's already selected (other modules are left
 * alone); unchecking removes exactly that module's slugs. */
export const toggleModule = (selected: readonly string[], slugs: readonly string[], checked: boolean): string[] => {
  if (!checked) {
    const removing = new Set(slugs);
    return selected.filter((entry) => !removing.has(entry));
  }
  const held = new Set(selected);
  return [...selected, ...slugs.filter((slug) => !held.has(slug))];
};

/** What the module's parent checkbox shows. An EMPTY module is `none`, not
 * `all` — `[].every(...)` is true, so the obvious spelling would tick a
 * group that offers nothing. */
export const moduleSelectionState = (selected: readonly string[], slugs: readonly string[]): ModuleSelectionState => {
  if (slugs.length === 0) return 'none';
  const held = new Set(selected);
  const count = slugs.filter((slug) => held.has(slug)).length;
  if (count === 0) return 'none';
  return count === slugs.length ? 'all' : 'partial';
};

/** The `permissions` array to submit. Full Access is `['*']` and NOTHING
 * else — the server refuses a mixture with a 400. Duplicates collapsed. */
export const toPermissionPayload = (fullAccess: boolean, selected: readonly string[]): string[] => (fullAccess ? [FULL_ACCESS_TOKEN] : [...new Set(selected)].filter(Boolean));

/** True when a stored token list is Full Access. */
export const isFullAccess = (permissions: readonly string[]): boolean => permissions.includes(FULL_ACCESS_TOKEN);

/** What the Edit form starts from, and what it had to leave behind. */
export interface HydratedSelection {
  fullAccess: boolean;
  /** Only slugs the catalogue still offers, so every one has a checkbox. */
  selected: string[];
  /** Tokens the role holds that the catalogue does not offer — legacy
   * compatibility grants (`customer.manage`) or a module wildcard
   * (`customer:*`). No checkbox to render, refused on a write, so saving
   * this form drops them — reported so the screen can warn first. */
  dropped: string[];
}

/** Turn a stored role into the form's starting selection. */
export const hydrateSelection = (role: Pick<RoleDetail, 'permissions' | 'fullAccess'>, modules: PermissionModule[]): HydratedSelection => {
  if (role.fullAccess || isFullAccess(role.permissions)) {
    return { fullAccess: true, selected: [], dropped: [] };
  }
  const offered = new Set(catalogueSlugs(modules));
  return {
    fullAccess: false,
    selected: role.permissions.filter((slug) => offered.has(slug)),
    dropped: role.permissions.filter((slug) => !offered.has(slug)),
  };
};
