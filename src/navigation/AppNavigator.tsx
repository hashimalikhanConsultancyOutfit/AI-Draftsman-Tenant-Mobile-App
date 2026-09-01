/**
 * The authenticated tree is the drawer shell (sidebar + bottom tabs) — see
 * AppDrawer.tsx. Re-exported under the old name so RootNavigator.tsx,
 * which mounts `<AppNavigator />` when `phase === 'authenticated'`, needs
 * no change.
 */
export { AppDrawer as AppNavigator } from './AppDrawer';
