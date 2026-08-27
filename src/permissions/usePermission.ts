import { useMemo } from 'react';

import { useAppSelector } from '@/store/hooks';

import { expandPermissions, holdsFullAccess, holdsPermission } from './holdsPermission';

/** The signed-in session's declared permission tokens, or `null` when
 * signed out / not yet authenticated. */
export function useDeclaredPermissions(): readonly string[] | null {
  return useAppSelector((state) => state.auth.session?.rolePermissions ?? null);
}

/** Does the current session hold `slug` (a canonical atomic slug from
 * permissions/slugs.ts)? */
export function usePermission(slug: string): boolean {
  const declared = useDeclaredPermissions();
  return useMemo(() => holdsPermission(declared, slug), [declared, slug]);
}

/** Does the current session hold ALL of `slugs`? For a screen/action that
 * needs more than one grant at once (e.g. a bulk-delete button that needs
 * both `.view` and `.delete`). */
export function useEveryPermission(slugs: readonly string[]): boolean {
  const declared = useDeclaredPermissions();
  return useMemo(() => slugs.every((slug) => holdsPermission(declared, slug)), [declared, slugs]);
}

/** Does the current session hold ANY of `slugs`? For a nav item that should
 * show if the user can do at least one thing on that screen. */
export function useSomePermission(slugs: readonly string[]): boolean {
  const declared = useDeclaredPermissions();
  return useMemo(() => slugs.some((slug) => holdsPermission(declared, slug)), [declared, slugs]);
}

/** The subset of `universe` the current session holds, as a Set — for a
 * screen building several per-row `can` flags at once from one pass. */
export function usePermissionSet(universe: readonly string[]): Set<string> {
  const declared = useDeclaredPermissions();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- universe is
  // expected to be a module-level constant array, not recreated per render.
  return useMemo(() => expandPermissions(declared, universe), [declared, universe]);
}

/** Is this session an owner-equivalent (`*`) account? Used sparingly — most
 * gating should be by atomic slug, not by "is this basically an owner". */
export function useHasFullAccess(): boolean {
  const declared = useDeclaredPermissions();
  return useMemo(() => holdsFullAccess(declared), [declared]);
}
