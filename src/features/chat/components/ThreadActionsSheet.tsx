import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { ChatThread } from '../chat.types';
import { threadDisplayName } from '../chatRules';

interface ThreadActionsSheetProps {
  thread: ChatThread | null;
  onClose: () => void;
  onPin: () => void;
  onRename: () => void;
  onSetKnowledgeBase: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

/**
 * The row `⋮` menu, as an action sheet — five items, same order as web:
 * Pin/Unpin, Rename, Add to knowledge base, Archive/Unarchive, Delete
 * (danger). Every item here needs `chat.manage`; the caller is responsible
 * for not opening this sheet at all when that permission is missing (the
 * kebab itself is hidden on web, not disabled).
 */
export function ThreadActionsSheet({
  thread,
  onClose,
  onPin,
  onRename,
  onSetKnowledgeBase,
  onArchive,
  onDelete,
}: ThreadActionsSheetProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  if (!thread) return null;

  const isArchived = thread.status === 'ARCHIVED';

  const items: Array<{ key: string; icon: IconName; label: string; onPress: () => void; danger?: boolean }> = [
    { key: 'pin', icon: 'push-pin', label: thread.pinned ? 'Unpin' : 'Pin', onPress: onPin },
    { key: 'rename', icon: 'edit', label: 'Rename', onPress: onRename },
    { key: 'kb', icon: 'menu-book', label: 'Add to knowledge base', onPress: onSetKnowledgeBase },
    { key: 'archive', icon: isArchived ? 'unarchive' : 'archive', label: isArchived ? 'Unarchive' : 'Archive', onPress: onArchive },
    { key: 'delete', icon: 'delete', label: 'Delete', onPress: onDelete, danger: true },
  ];

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              paddingBottom: insets.bottom + 16,
              borderTopLeftRadius: theme.radii.sheetTop,
              borderTopRightRadius: theme.radii.sheetTop,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.textMuted,
              fontSize: 12,
              paddingHorizontal: 20,
              marginBottom: 8,
            }}
          >
            {threadDisplayName(thread.title)}
          </Text>
          {items.map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => {
                onClose();
                item.onPress();
              }}
              style={styles.row}
              accessibilityRole="menuitem"
            >
              <Icon name={item.icon} size={20} color={item.danger ? theme.colors.error : theme.colors.text} />
              <Text
                style={{
                  color: item.danger ? theme.colors.error : theme.colors.text,
                  fontFamily: theme.fontFamilies.body.medium,
                  fontSize: 15,
                }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 13 },
});
