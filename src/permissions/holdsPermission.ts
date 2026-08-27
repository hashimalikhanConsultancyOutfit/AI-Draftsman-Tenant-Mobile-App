/**
 * PERMISSION RESOLUTION — mirrors libs/b2b-shared/src/permissions/holds-permission.ts
 * exactly, so a mobile screen and the API route behind it never disagree about
 * who may see what. Read that backend file's own header comment for the full
 * rationale; the short version:
 *
 *   1. the literal canonical slug — what a custom role from the Roles screen has;
 *   2. a coarse legacy token that covers it — what every seeded role has;
 *   3. `*`, which grants everything, including permissions that ship later.
 *
 * Fail closed, always: an absent, empty or unrecognised declaration holds
 * nothing. There is deliberately no fallback keyed on a role's NAME.
 */

import { FULL_ACCESS_TOKEN, LEGACY_GRANTS } from './legacyGrants';

/**
 * Does a declared permission list (the session's `rolePermissions`) hold
 * `needed` (always a canonical atomic slug — see slugs.ts)?
 */
export function holdsPermission(
  declared: readonly string[] | null | undefined,
  needed: string,
): boolean {
  if (!declared || declared.length === 0) return false;

  if (declared.includes(FULL_ACCESS_TOKEN)) return true;
  if (declared.includes(needed)) return true;

  return declared.some((token) => LEGACY_GRANTS[token]?.includes(needed));
}

/**
 * Which of `universe` does a declared list hold? Useful for a screen that
 * needs several flags at once (e.g. building a set of per-row `can` flags)
 * rather than calling holdsPermission repeatedly over the same list.
 */
export function expandPermissions(
  declared: readonly string[] | null | undefined,
  universe: readonly string[],
): Set<string> {
  if (!declared || declared.length === 0) return new Set<string>();

  if (declared.includes(FULL_ACCESS_TOKEN)) return new Set(universe);

  const held = new Set<string>();
  for (const slug of universe) {
    if (holdsPermission(declared, slug)) held.add(slug);
  }
  return held;
}

/** True if `declared` holds `*` — used to short-circuit UI that would
 * otherwise compute a large expandPermissions() set just to check "is this
 * an owner-equivalent account". */
export function holdsFullAccess(declared: readonly string[] | null | undefined): boolean {
  return Boolean(declared?.includes(FULL_ACCESS_TOKEN));
}
