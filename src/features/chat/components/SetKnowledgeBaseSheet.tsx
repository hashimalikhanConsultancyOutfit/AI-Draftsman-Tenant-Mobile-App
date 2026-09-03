import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';
import { useGetAllKnowledgeBasesQuery } from '@/features/knowledge-bases/knowledgeBasesApi';

import type { ChatThread } from '../chat.types';
import { useSetChatThreadKnowledgeBaseMutation } from '../chatApi';

interface SetKnowledgeBaseSheetProps {
  thread: ChatThread | null;
  onClose: () => void;
}

/** Defaults to the thread's current knowledge base, "No knowledge base"
 * listed first — selecting it sends an empty string, which the backend
 * normalises to `null`, clearing the assignment. */
export function SetKnowledgeBaseSheet({ thread, onClose }: SetKnowledgeBaseSheetProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const kbQuery = useGetAllKnowledgeBasesQuery(undefined, { skip: !thread });
  const [setKnowledgeBase] = useSetChatThreadKnowledgeBaseMutation();

  if (!thread) return null;

  const handlePick = async (id: string) => {
    try {
      await setKnowledgeBase({ id: thread.id, knowledgeBaseId: id }).unwrap();
      onClose();
    } catch {
      toast.show('Could not update the knowledge base for this thread.', { tone: 'error' });
    }
  };

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
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg, paddingHorizontal: 20, marginBottom: 10 }}>
            Knowledge base
          </Text>
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            <TouchableOpacity
              onPress={() => handlePick('')}
              style={[styles.option, { borderColor: !thread.knowledgeBaseId ? theme.colors.accent : theme.colors.border }]}
            >
              <Text style={{ color: theme.colors.text, fontSize: 14 }}>No knowledge base</Text>
            </TouchableOpacity>
            {kbQuery.isLoading && (
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Loading your knowledge bases…</Text>
            )}
            {(kbQuery.data ?? []).map((kb) => (
              <TouchableOpacity
                key={kb.id}
                onPress={() => handlePick(kb.id)}
                style={[styles.option, { borderColor: thread.knowledgeBaseId === kb.id ? theme.colors.accent : theme.colors.border }]}
              >
                <Text style={{ color: theme.colors.text, fontSize: 14 }}>{kb.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { paddingTop: 10, maxHeight: '70%' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 6 },
  option: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
});
