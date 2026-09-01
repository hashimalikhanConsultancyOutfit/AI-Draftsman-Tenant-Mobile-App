import { ScrollView, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { EmptyState, type IconName, type NavIconKey } from '@/components/ui';
import { usePermission } from '@/permissions/usePermission';
import { useAppTheme } from '@/theme/ThemeContext';

interface ModulePlaceholderScreenProps {
  title: string;
  /** The module's own VIEW slug — gates the whole screen, same rule the
   * sidebar row itself uses to decide whether to show the row at all. A
   * screen reached anyway (deep link, stale nav state) gets a named
   * refusal, never a blank list. `undefined` means "no gate" (e.g. My
   * settings' own sub-screens, which every session may read). */
  permission?: string;
  icon: IconName | NavIconKey;
  /** One line on what this module will do once built — kept honest rather
   * than a generic "coming soon". */
  description: string;
  /** "tab" (default) for a drawer/tab root — hamburger opens the sidebar.
   * "stack" for a screen pushed onto a stack — a real back arrow instead. */
  mode?: 'tab' | 'stack';
}

/**
 * Stands in for a module not yet built in this phase. Wired into real
 * navigation (drawer + permission gate) now so the full information
 * architecture is navigable end to end; the content behind each of these
 * is the next phase of work, module by module, per the approved roadmap.
 */
export function ModulePlaceholderScreen({ title, permission, icon, description, mode = 'tab' }: ModulePlaceholderScreenProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  // Hooks must run unconditionally — pass a stable placeholder slug when
  // this screen has no gate, and just ignore the (irrelevant) result.
  const permissionCheck = usePermission(permission ?? '__no_gate__');
  const canView = permission ? permissionCheck : true;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title={title}
        mode={mode}
        onBack={() => navigation.goBack()}
        onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: insets.bottom }}>
        {canView ? (
          <EmptyState
            icon={icon}
            title={title}
            description={`${description} This module is scheduled for a later phase of the build — the shell and navigation are ready for it now.`}
          />
        ) : (
          <EmptyState
            icon="lock-outline"
            title="Not visible to you"
            description={`Seeing ${title} needs a permission your role does not hold. Ask an owner or an admin in your workspace.`}
          />
        )}
      </ScrollView>
    </View>
  );
}
