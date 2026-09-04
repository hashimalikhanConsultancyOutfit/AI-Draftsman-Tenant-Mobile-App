/**
 * Notifications — the bell's tray, reached by tapping the bell in
 * `AppHeader` from any tab (see `goToDrawer`-style navigation in each tab
 * root's `onBellPress`). Ported from web's `NotificationBell.tsx` popover
 * (read in full, confirmed against that source 2026-09-04): same three
 * states (loading / empty / list), same category-dot colour coding, same
 * "just now" / "N min ago" time formatting, same "Mark all as read".
 *
 * ── NO ROUTE-LEVEL PERMISSION GATE, ON PURPOSE ──────────────────────────────
 * Like Account, Usage & Credits and Analytics, this is the signed-in
 * user's own data — the backend controller's own doc comment states there
 * is deliberately no `notification.view` permission on these routes, since
 * withholding one would mean an account that receives notifications it
 * isn't allowed to read.
 *
 * ── `link` IS NOT FOLLOWED ───────────────────────────────────────────────────
 * Each card's `link` is a web-portal-relative path (e.g. "/customers/123")
 * — a route in the OTHER app, not one this app's navigator declares. Web
 * can `router.push(notification.link)` because it owns that exact route
 * table; this app doesn't, and guessing a mapping from web paths to mobile
 * screens per category would be a maintenance trap that silently breaks
 * the moment either route table changes. So a tap here only acknowledges
 * the card (marks it read) — it does not attempt to navigate anywhere.
 */
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Loader, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme, type AppTheme } from '@/theme/ThemeContext';

import {
  useGetNotificationFeedQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from './notificationsApi';
import { categoryLabel, EMPTY_DESCRIPTION, EMPTY_TITLE, formatNotificationWhen, MARK_ALL_READ_ERROR, PAGE_DESCRIPTION } from './notificationsRules';
import type { TrayNotification } from './notifications.types';

const FEED_LIMIT = 50;

export function NotificationsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const toast = useToast();

  const { data, isLoading, isFetching, isError, error, refetch } = useGetNotificationFeedQuery({ limit: FEED_LIMIT });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead, { isLoading: isMarkingAll }] = useMarkAllNotificationsReadMutation();

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  const handleOpen = (notification: TrayNotification) => {
    if (!notification.readAt) void markRead(notification.id);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead().unwrap();
    } catch (err) {
      toast.show(getErrorMessage(err as never, MARK_ALL_READ_ERROR), { tone: 'error' });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Notifications" mode="stack" onBack={() => navigation.goBack()} />

      {isLoading ? (
        <Loader fullScreen label="Loading your notifications…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error as never, 'Could not load your notifications.')} onRetry={refetch} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20, flex: 1 }}>
                {PAGE_DESCRIPTION}
              </Text>
              {unread > 0 && (
                <Button label="Mark all as read" size="sm" variant="outline" onPress={handleMarkAllRead} loading={isMarkingAll} style={{ alignSelf: 'flex-start' }} />
              )}
            </View>
          }
          ListEmptyComponent={<EmptyState icon="notifications-none" title={EMPTY_TITLE} description={EMPTY_DESCRIPTION} />}
          renderItem={({ item }) => <NotificationRow theme={theme} notification={item} onPress={() => handleOpen(item)} />}
          ItemSeparatorComponent={() => <View style={{ height: theme.borders.hairline, backgroundColor: theme.colors.border }} />}
        />
      )}
    </View>
  );
}

function NotificationRow({ theme, notification, onPress }: { theme: AppTheme; notification: TrayNotification; onPress: () => void }) {
  const unread = !notification.readAt;
  const dotColor = unread
    ? notification.category === 'SCHEDULED_TASKS'
      ? theme.colors.warning
      : notification.category === 'USAGE_CREDITS'
        ? theme.colors.success
        : theme.colors.info
    : theme.colors.border;

  return (
    <TouchableOpacity onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={notification.title}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} accessibilityLabel={categoryLabel(notification.category)} />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: unread ? theme.fontFamilies.body.semibold : theme.fontFamilies.body.medium,
            fontSize: theme.fontSizes.sm,
          }}
        >
          {notification.title}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: 2 }}>
          {notification.body}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 4 }}>
          {formatNotificationWhen(notification.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 16, flexGrow: 1 },
  headerBlock: { gap: 12, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
