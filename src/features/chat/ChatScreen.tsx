import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Icon, Loader, useToast } from '@/components/ui';
import { CHAT_PERMISSIONS, USAGE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';
import type { ChatStackParamList } from '@/navigation/types';

import type { ChatThread } from './chat.types';
import {
  CHAT_DESCRIPTION,
  DELETE_THREAD_COPY,
  NO_ACCESS_BODY,
  NO_ACCESS_TITLE,
  NO_ARCHIVED_BODY,
  NO_ARCHIVED_TITLE,
  NO_THREADS_BODY,
  NO_THREADS_BODY_READ_ONLY,
  NO_THREADS_TITLE,
  THREADS_ERROR_TITLE,
  THREAD_ACTION_COPY,
  groupThreads,
  threadDisplayName,
} from './chatRules';
import {
  useDeleteChatThreadsMutation,
  useGetChatThreadsQuery,
  usePinChatThreadMutation,
  useUpdateChatThreadMutation,
} from './chatApi';
import { ThreadCard } from './components/ThreadCard';
import { ThreadActionsSheet } from './components/ThreadActionsSheet';
import { NewThreadSheet } from './components/NewThreadSheet';
import { RenameThreadSheet } from './components/RenameThreadSheet';
import { SetKnowledgeBaseSheet } from './components/SetKnowledgeBaseSheet';

type Nav = NativeStackNavigationProp<ChatStackParamList>;

/**
 * The thread list — the module's home screen. Web's three regions
 * (280px list / conversation / 320px rail) become three screens on a
 * phone (docs/chat-module-spec.md D-1); this is the first of them.
 */
export function ChatScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const canView = usePermission(CHAT_PERMISSIONS.VIEW);
  const canManage = usePermission(CHAT_PERMISSIONS.MANAGE);
  const canViewCost = usePermission(USAGE_PERMISSIONS.VIEW);

  const [archivedOpen, setArchivedOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionsTarget, setActionsTarget] = useState<ChatThread | null>(null);
  const [renameTarget, setRenameTarget] = useState<ChatThread | null>(null);
  const [kbTarget, setKbTarget] = useState<ChatThread | null>(null);
  const [newThreadOpen, setNewThreadOpen] = useState(false);

  const threadsQuery = useGetChatThreadsQuery({ status: 'ACTIVE' }, { skip: !canView });
  const archivedQuery = useGetChatThreadsQuery({ status: 'ARCHIVED' }, { skip: !canView });
  const [updateThread] = useUpdateChatThreadMutation();
  const [pinThread] = usePinChatThreadMutation();
  const [deleteThreads, { isLoading: isDeleting }] = useDeleteChatThreadsMutation();

  useEffect(() => {
    if (!canManage) setSelectionMode(false);
  }, [canManage]);

  const activeThreads = threadsQuery.data?.items ?? [];
  const archivedThreads = archivedQuery.data?.items ?? [];
  // Every hook above runs unconditionally, including the two skippable
  // queries — only the RENDER branches on `canView`, never the hook order.
  const groups = useMemo(() => groupThreads(activeThreads), [activeThreads]);

  if (!canView) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Chat" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} />
        <EmptyState icon="lock" title={NO_ACCESS_TITLE} description={NO_ACCESS_BODY} />
      </View>
    );
  }

  const openThread = (thread: ChatThread) => {
    navigateToConversation(navigation, { conversationId: thread.id, title: threadDisplayName(thread.title) });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterSelectionMode = (seedId?: string) => {
    if (!canManage) return;
    setSelectionMode(true);
    if (seedId) setSelectedIds(new Set([seedId]));
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const namesFor = (ids: Set<string>): string[] => {
    const all = [...activeThreads, ...archivedThreads];
    return [...ids].map((id) => threadDisplayName(all.find((t) => t.id === id)?.title));
  };

  const confirmDelete = (ids: Set<string>) => {
    const names = namesFor(ids);
    const label = ids.size === 1 ? (names[0] ?? '') : '';
    Alert.alert(DELETE_THREAD_COPY.title(ids.size), DELETE_THREAD_COPY.body(ids.size, label), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const result = await deleteThreads([...ids]).unwrap();
            if (result.skippedIds.length > 0) {
              toast.show(DELETE_THREAD_COPY.skipped(result.skippedIds.length), { tone: 'warning' });
            }
            if (result.deletedIds.length > 0) {
              toast.show(DELETE_THREAD_COPY.done(result.deletedIds.length), { tone: 'success' });
            }
            exitSelectionMode();
          } catch {
            toast.show(DELETE_THREAD_COPY.failed(ids.size), { tone: 'error' });
          }
        },
      },
    ]);
  };

  const handlePin = async (thread: ChatThread) => {
    try {
      await pinThread({ id: thread.id, pinned: !thread.pinned }).unwrap();
      const copy = thread.pinned ? THREAD_ACTION_COPY.unpin : THREAD_ACTION_COPY.pin;
      toast.show(copy.done(threadDisplayName(thread.title)), { tone: 'success' });
    } catch {
      toast.show(THREAD_ACTION_COPY.pin.failed, { tone: 'error' });
    }
  };

  const handleArchiveToggle = async (thread: ChatThread) => {
    const nextStatus = thread.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED';
    try {
      await updateThread({ id: thread.id, status: nextStatus }).unwrap();
      const copy = nextStatus === 'ARCHIVED' ? THREAD_ACTION_COPY.archive : THREAD_ACTION_COPY.unarchive;
      toast.show(copy.done(threadDisplayName(thread.title)), { tone: 'success' });
    } catch {
      toast.show(THREAD_ACTION_COPY.archive.failed, { tone: 'error' });
    }
  };

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.headerRow}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, flex: 1 }}>
          {CHAT_DESCRIPTION}
        </Text>
        <View style={[styles.countPill, { backgroundColor: theme.colors.statusNeutralBg }]}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{threadsQuery.data?.total ?? 0}</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        {canManage && !selectionMode && (
          <Button label="New thread" icon="add" size="sm" onPress={() => setNewThreadOpen(true)} />
        )}
        {canManage && (
          <TouchableOpacity
            onPress={() => (selectionMode ? exitSelectionMode() : enterSelectionMode())}
            style={styles.selectToggle}
            accessibilityRole="button"
          >
            <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: 13 }}>
              {selectionMode ? 'Cancel' : 'Select'}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => navigateToThreadSearch(navigation)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Search threads"
        >
          <Icon name="search" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {selectionMode && selectedIds.size > 0 && (
        <TouchableOpacity
          onPress={() => confirmDelete(selectedIds)}
          disabled={isDeleting}
          style={[styles.deleteBar, { backgroundColor: theme.colors.statusErrorBg }]}
        >
          <Icon name="delete" size={18} color={theme.colors.statusErrorFg} />
          <Text style={{ color: theme.colors.statusErrorFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 13 }}>
            Delete {selectedIds.size} thread{selectedIds.size === 1 ? '' : 's'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() => setArchivedOpen((v) => !v)}
        style={[styles.archivedRow, { borderColor: theme.colors.border }]}
        accessibilityRole="button"
        accessibilityState={{ expanded: archivedOpen }}
      >
        <Icon name="archive" size={18} color={theme.colors.textMuted} />
        <Text style={{ color: theme.colors.text, flex: 1, fontFamily: theme.fontFamilies.body.medium, fontSize: 14 }}>
          Archived
        </Text>
        <View style={[styles.countPill, { backgroundColor: theme.colors.statusNeutralBg }]}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{archivedThreads.length}</Text>
        </View>
        <Icon name={archivedOpen ? 'keyboard-arrow-down' : 'chevron-right'} size={20} color={theme.colors.textMuted} />
      </TouchableOpacity>

      {archivedOpen && (
        <View style={{ gap: 8 }}>
          {archivedQuery.isLoading && <Loader />}
          {!archivedQuery.isLoading && archivedThreads.length === 0 && (
            <EmptyState icon="archive" title={NO_ARCHIVED_TITLE} description={NO_ARCHIVED_BODY} />
          )}
          {archivedThreads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              onPress={() => openThread(thread)}
              onLongPress={() => canManage && setActionsTarget(thread)}
              canViewCost={canViewCost}
              selectable={selectionMode}
              selected={selectedIds.has(thread.id)}
              onToggleSelect={() => toggleSelect(thread.id)}
            />
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Chat" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} />

      <FlatList
        data={groups}
        keyExtractor={(g) => g.key}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={listHeader}
        refreshControl={
          <RefreshControl
            refreshing={threadsQuery.isFetching && !threadsQuery.isLoading}
            onRefresh={() => {
              void threadsQuery.refetch();
              void archivedQuery.refetch();
            }}
            tintColor={theme.colors.accent}
          />
        }
        renderItem={({ item: group }) => (
          <View style={styles.group}>
            <Text style={[styles.groupLabel, { color: theme.colors.textMuted }]}>{group.label.toUpperCase()}</Text>
            <View style={{ gap: 8 }}>
              {group.items.map((thread) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  onPress={() => openThread(thread)}
                  onLongPress={() => canManage && setActionsTarget(thread)}
                  canViewCost={canViewCost}
                  selectable={selectionMode}
                  selected={selectedIds.has(thread.id)}
                  onToggleSelect={() => toggleSelect(thread.id)}
                />
              ))}
            </View>
          </View>
        )}
        ListEmptyComponent={
          threadsQuery.isLoading ? (
            <Loader />
          ) : threadsQuery.error ? (
            <ErrorState
              title={THREADS_ERROR_TITLE}
              message={getErrorMessage(threadsQuery.error)}
              onRetry={threadsQuery.refetch}
            />
          ) : (
            <EmptyState
              icon="chat-bubble-outline"
              title={NO_THREADS_TITLE}
              description={canManage ? NO_THREADS_BODY : NO_THREADS_BODY_READ_ONLY}
              actionLabel={canManage ? 'New thread' : undefined}
              onAction={canManage ? () => setNewThreadOpen(true) : undefined}
            />
          )
        }
      />

      <ThreadActionsSheet
        thread={actionsTarget}
        onClose={() => setActionsTarget(null)}
        onPin={() => actionsTarget && handlePin(actionsTarget)}
        onRename={() => {
          const target = actionsTarget;
          setActionsTarget(null);
          setRenameTarget(target);
        }}
        onSetKnowledgeBase={() => {
          const target = actionsTarget;
          setActionsTarget(null);
          setKbTarget(target);
        }}
        onArchive={() => actionsTarget && handleArchiveToggle(actionsTarget)}
        onDelete={() => actionsTarget && confirmDelete(new Set([actionsTarget.id]))}
      />

      <RenameThreadSheet thread={renameTarget} onClose={() => setRenameTarget(null)} />
      <SetKnowledgeBaseSheet thread={kbTarget} onClose={() => setKbTarget(null)} />
      <NewThreadSheet
        visible={newThreadOpen}
        canManage={canManage}
        onClose={() => setNewThreadOpen(false)}
        onCreated={(id) => navigateToConversation(navigation, { conversationId: id })}
      />
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-navigator jump, see AppDrawer's `id="RootDrawer"` note
function navigateToConversation(navigation: any, params: { conversationId: string; title?: string }) {
  // A conversation lives in its own drawer-level stack, not nested under
  // this tab — see ChatConversationStack's own note for why. Two
  // `getParent()`s: one out of ChatStack, one out of the tab navigator,
  // landing on the drawer, same as TopBySpendScreen.tsx's `goToCustomer`.
  navigation.getParent()?.getParent()?.navigate('ChatConversationStack' as never, { screen: 'ChatConversation', params } as never);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-navigator jump, see AppDrawer's `id="RootDrawer"` note
function navigateToThreadSearch(navigation: any) {
  navigation.getParent()?.getParent()?.navigate('ChatConversationStack' as never, { screen: 'ChatThreadSearch' } as never);
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  headerBlock: { gap: 14, marginBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  selectToggle: { paddingVertical: 4 },
  deleteBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10 },
  archivedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12 },
  group: { marginBottom: 16, gap: 8 },
  groupLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 2 },
});
