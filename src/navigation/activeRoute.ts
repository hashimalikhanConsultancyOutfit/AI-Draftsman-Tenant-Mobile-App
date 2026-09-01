import { createContext, useContext } from 'react';
import type { NavigationState, PartialState } from '@react-navigation/native';

export type NavState = NavigationState | PartialState<NavigationState> | undefined;

/**
 * Full chain of route names from the root navigator down to whatever's
 * currently focused, e.g. ['MainTabs', 'DashboardTab', 'SpendByDay'] or
 * ['Customers']. Computed from the state React Navigation hands to
 * `NavigationContainer`'s `onStateChange` — the one place guaranteed to
 * fire on every state change *anywhere* in the tree, including inside a
 * nested tab/stack navigator several levels down. This is deliberately
 * NOT derived from a navigator's own `props.state` (e.g. the Drawer's),
 * because that reflects only that navigator's own re-renders and was
 * observed (via on-device testing) to go stale when a *descendant*
 * navigator's focus changes without the Drawer itself re-rendering.
 */
export function getActiveRoutePath(state: NavState): string[] {
  if (!state || state.index === undefined) return [];
  const route = state.routes[state.index];
  if (!route) return [];
  if (route.state) return [route.name, ...getActiveRoutePath(route.state)];
  return [route.name];
}

export const ActiveRoutePathContext = createContext<string[]>([]);

/** The active route chain, root-first. See getActiveRoutePath for shape. */
export function useActiveRoutePath(): string[] {
  return useContext(ActiveRoutePathContext);
}
