import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, useToast } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { ChatThread } from '../chat.types';
import { MAX_THREAD_TITLE_LENGTH, THREAD_ACTION_COPY, threadDisplayName } from '../chatRules';
import { useUpdateChatThreadMutation } from '../chatApi';

interface RenameThreadSheetProps {
  thread: ChatThread | null;
  onClose: () => void;
}

/** One required field, seeded from the thread's current name — matches the
 * web's FormModal for rename exactly. */
export function RenameThreadSheet({ thread, onClose }: RenameThreadSheetProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [value, setValue] = useState('');
  const [update, { isLoading }] = useUpdateChatThreadMutation();

  useEffect(() => {
    if (thread) setValue(threadDisplayName(thread.title) === 'Untitled thread' ? '' : thread.title);
  }, [thread]);

  if (!thread) return null;

  const handleSave = async () => {
    const title = value.trim();
    if (title.length === 0) return;
    try {
      const updated = await update({ id: thread.id, title }).unwrap();
      toast.show(THREAD_ACTION_COPY.rename.done(updated.title), { tone: 'success' });
      onClose();
    } catch {
      toast.show(THREAD_ACTION_COPY.rename.failed, { tone: 'error' });
    }
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View
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
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg, paddingHorizontal: 20, marginBottom: 12 }}>
            Rename thread
          </Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            autoFocus
            maxLength={MAX_THREAD_TITLE_LENGTH}
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}
          />
          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} style={styles.cancel} accessibilityRole="button">
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold }}>Cancel</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Button label="Save" onPress={handleSave} loading={isLoading} disabled={value.trim().length === 0} fullWidth />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 6 },
  input: { marginHorizontal: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, marginTop: 16 },
  cancel: { paddingVertical: 12 },
});
