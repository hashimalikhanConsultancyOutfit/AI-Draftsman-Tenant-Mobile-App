import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Icon } from '@/components/ui';
import { useGetUnreadNotificationCountQuery } from '@/features/notifications/notificationsApi';
import { useAppSelector } from '@/store/hooks';
import { useAppTheme } from '@/theme/ThemeContext';

interface AppHeaderProps {
  title: string;
  /**
   * "tab"   -> shell root screen: hamburger (opens sidebar) + title left,
   *            notification bell + avatar right.
   * "stack" -> nested screen: back arrow + title left, nothing right.
   */
  mode?: 'tab' | 'stack';
  onBack?: () => void;
  onMenuPress?: () => void;
  /**
   * Optional override for the bell. Leave it unset: the header walks to the
   * root drawer itself and opens Notifications, which is what every tab wants.
   *
   * ── WHY THE HEADER OWNS THIS ────────────────────────────────────────────
   * Each tab root used to pass `getParent()?.getParent()?.navigate(...)`, a
   * two-hop climb that is only correct when the screen sits exactly two
   * navigators below the drawer. Dashboard happened to; a screen reached one
   * level deeper resolved the second `getParent()` to the drawer and then
   * navigated on ITS parent — undefined — so the tap did nothing at all, with
   * no error to notice. `getParent('RootDrawer')` asks for the drawer BY ID
   * (see `AppDrawer`, which sets that id for exactly this) and finds it from
   * any depth, so the bell cannot silently stop working when a screen moves.
   */
  onBellPress?: () => void;
  onAvatarPress?: () => void;
  style?: ViewStyle;
}

function initialsOf(name: string, email: string): string {
  const source = name?.trim() || email;
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function NotificationBell({ onPress }: { onPress?: () => void }) {
  const { theme } = useAppTheme();
  const isAuthenticated = useAppSelector((s) => s.auth.phase === 'authenticated');
  const { data } = useGetUnreadNotificationCountQuery(undefined, {
    skip: !isAuthenticated,
    pollingInterval: 60_000,
  });
  const unread = data?.unread ?? 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.iconBtn}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Icon name="notifications-none" size={22} color={theme.colors.text} />
      {unread > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.colors.error, borderColor: theme.colors.surface }]}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function ProfileAvatar({ onPress }: { onPress?: () => void }) {
  const { theme } = useAppTheme();
  const session = useAppSelector((s) => s.auth.session);
  if (!session) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.avatar, { backgroundColor: theme.colors.accent }]}
      accessibilityRole="button"
      accessibilityLabel="My settings"
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <Text style={styles.avatarInitials}>{initialsOf(session.name, session.email)}</Text>
    </TouchableOpacity>
  );
}

export function AppHeader({ title, mode = 'tab', onBack, onMenuPress, onBellPress, onAvatarPress, style }: AppHeaderProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  /*
   * Opening the tray, and recording where from.
   *
   * `Notifications` is a drawer route, so Back from it is the DRAWER's back —
   * which returns to whatever that navigator's history points at, not
   * necessarily the screen the bell was tapped on. Passing the current drawer
   * route as `from` makes the return trip explicit instead of inferred, so the
   * bell behaves the same whether it was tapped on a tab root or on a
   * drawer-level screen like Customers or Reports.
   *
   * Reading the route off the drawer's own state rather than this screen's is
   * deliberate: `MainTabs` is one drawer route covering five tabs, and
   * navigating back to it restores the tab the person was on, because the tab
   * navigator keeps its own state.
   */
  const openNotifications =
    onBellPress ??
    (() => {
      /* `getParent` is untyped across navigator boundaries, so the shape this
         call needs — read the focused route, navigate with a param — is named
         here rather than cast away with `as never` at each use. */
      const drawer = navigation.getParent('RootDrawer' as never) as unknown as
        | {
            getState?: () => { index: number; routes: { name: string }[] };
            navigate: (screen: 'Notifications', params?: { from?: string }) => void;
          }
        | undefined;
      if (!drawer) return;
      const state = drawer.getState?.();
      const from = state ? state.routes[state.index]?.name : undefined;
      drawer.navigate('Notifications', { from });
    });

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.border,
          borderBottomWidth: theme.borders.hairline,
          paddingTop: insets.top + 10,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        <View style={styles.left}>
          {mode === 'stack' ? (
            <TouchableOpacity
              onPress={onBack}
              style={styles.navBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="arrow-back" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={onMenuPress}
              style={styles.navBtn}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="menu" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          )}
          <Text
            style={[
              mode === 'tab' ? styles.tabTitle : styles.stackTitle,
              { color: theme.colors.text, fontFamily: mode === 'tab' ? theme.fontFamilies.display.bold : theme.fontFamilies.display.semibold },
            ]}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
        </View>

        {mode === 'tab' && (
          <View style={styles.right}>
            <NotificationBell onPress={openNotifications} />
            <View style={{ marginLeft: 8 }}>
              <ProfileAvatar onPress={onAvatarPress} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  navBtn: {
    marginRight: 8,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabTitle: {
    fontSize: 20,
    letterSpacing: -0.3,
  },
  stackTitle: {
    fontSize: 17,
    flex: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: 'InstrumentSans_700Bold',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'Syne_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
  },
});
