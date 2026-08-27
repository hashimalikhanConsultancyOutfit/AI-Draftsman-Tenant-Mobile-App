import type { ReactNode } from 'react';

import { useEveryPermission, useSomePermission } from './usePermission';

interface PermissionGateProps {
  /** Require ALL of these slugs. Mutually exclusive with `anyOf` — if both
   * are given, `allOf` wins and `anyOf` is ignored. */
  allOf?: readonly string[];
  /** Require ANY of these slugs. */
  anyOf?: readonly string[];
  children: ReactNode;
  /** Rendered instead of nothing when the check fails — e.g. a disabled
   * button with a tooltip, rather than the control vanishing outright. */
  fallback?: ReactNode;
}

/**
 * Declarative permission gate for JSX — mirrors the pattern the web app's
 * own `<PermissionGate>` / `useCapability` hooks follow (hide or disable UI
 * a role can't use; the API is still the real enforcement, this is UX).
 *
 * Usage:
 *   <PermissionGate allOf={[CUSTOMER_PERMISSIONS.DELETE]}>
 *     <DeleteCustomerButton />
 *   </PermissionGate>
 */
export function PermissionGate({ allOf, anyOf, children, fallback = null }: PermissionGateProps) {
  const slugs = allOf ?? anyOf ?? [];
  const passesAll = useEveryPermission(allOf ?? []);
  const passesAny = useSomePermission(anyOf ?? []);

  if (slugs.length === 0) return <>{children}</>;

  const allowed = allOf ? passesAll : passesAny;
  return allowed ? <>{children}</> : <>{fallback}</>;
}
