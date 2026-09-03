import { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, useToast } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';
import { useGetAllKnowledgeBasesQuery } from '@/features/knowledge-bases/knowledgeBasesApi';

import { MAX_THREAD_TITLE_LENGTH, NO_PERMISSION_MESSAGE, THREAD_ACTION_COPY, threadDisplayName } from '../chatRules';
import { useCreateChatThreadMutation, useGetAvailableAgentsForChatQuery } from '../chatApi';
import type { AvailableAgent } from '../chat.types';

interface NewThreadSheetProps {
  visible: boolean;
  canManage: boolean;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}

/** Per-status usability, mirroring the web's disabled options with their
 * own reasons — a agent missing from the list entirely would read as a
 * loading fault, so every agent shows, some just cannot be picked. */
function agentHint(status: AvailableAgent['status']): string | null {
  switch (status) {
    case 'DRAFT':
      return 'not evaluated';
    case 'ARCHIVED':
      return 'archived';
    case 'EVALUATED':
      return 'not deployed';
    case 'DEPLOYED':
      return null;
    default:
      return 'not deployed';
  }
}

/**
 * New-thread form: name (optional), agent (required), knowledge base
 * (optional). Reached from four places on web — here, one sheet serves the
 * ThreadList header `+`, the empty-state CTA, and the landing-panel CTA
 * alike, all pushing the same component.
 */
export function NewThreadSheet({ visible, canManage, onClose, onCreated }: NewThreadSheetProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [agentId, setAgentId] = useState<string | null>(null);
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<string | null>(null);

  const agentsQuery = useGetAvailableAgentsForChatQuery(undefined, { skip: !visible });
  const kbQuery = useGetAllKnowledgeBasesQuery(undefined, { skip: !visible });
  const [createThread, { isLoading: isCreating }] = useCreateChatThreadMutation();

  const usableAgents = agentsQuery.data ?? [];
  const selectableAgentId = agentId ?? usableAgents.find((a) => a.status === 'DEPLOYED')?.id ?? null;

  const handleClose = () => {
    setTitle('');
    setAgentId(null);
    setKnowledgeBaseId(null);
    onClose();
  };

  const handleCreate = async () => {
    if (!canManage) {
      toast.show(NO_PERMISSION_MESSAGE.manage, { tone: 'warning' });
      return;
    }
    if (!selectableAgentId) return;
    try {
      const created = await createThread({
        title,
        agentId: selectableAgentId,
        knowledgeBaseId,
      }).unwrap();
      toast.show(THREAD_ACTION_COPY.create.done(threadDisplayName(created.title)), { tone: 'success' });
      handleClose();
      onCreated(created.id);
    } catch {
      toast.show(THREAD_ACTION_COPY.create.failed, { tone: 'error' });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
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
          <View style={styles.header}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg }}>
              New thread
            </Text>
            <TouchableOpacity onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={22} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Name</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                maxLength={MAX_THREAD_TITLE_LENGTH}
                placeholder="Optional"
                placeholderTextColor={theme.colors.textMuted}
                style={[
                  styles.input,
                  { color: theme.colors.text, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
                ]}
              />
              <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
                Optional — leave it blank and the first message names the thread.
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Agent</Text>
              {agentsQuery.isLoading ? (
                <ActivityIndicator color={theme.colors.accent} style={{ alignSelf: 'flex-start' }} />
              ) : agentsQuery.isError ? (
                <Text style={{ color: theme.colors.error, fontSize: 12 }}>
                  Agents could not be loaded — try again in a moment.
                </Text>
              ) : (
                <View style={styles.options}>
                  {usableAgents.map((agent) => {
                    const hint = agentHint(agent.status);
                    const disabled = hint !== null;
                    const selected = selectableAgentId === agent.id;
                    return (
                      <TouchableOpacity
                        key={agent.id}
                        disabled={disabled}
                        onPress={() => setAgentId(agent.id)}
                        style={[
                          styles.option,
                          {
                            borderColor: selected ? theme.colors.accent : theme.colors.border,
                            backgroundColor: selected ? theme.colors.accent + '10' : 'transparent',
                            opacity: disabled ? 0.5 : 1,
                          },
                        ]}
                      >
                        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: 14 }}>
                          {agent.name}
                        </Text>
                        {hint && <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{hint}</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Knowledge base</Text>
              {kbQuery.isLoading ? (
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Loading your knowledge bases…</Text>
              ) : (kbQuery.data ?? []).length === 0 ? (
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>You have no knowledge bases yet.</Text>
              ) : (
                <View style={styles.options}>
                  <TouchableOpacity
                    onPress={() => setKnowledgeBaseId(null)}
                    style={[
                      styles.option,
                      { borderColor: knowledgeBaseId === null ? theme.colors.accent : theme.colors.border },
                    ]}
                  >
                    <Text style={{ color: theme.colors.text, fontSize: 14 }}>No knowledge base</Text>
                  </TouchableOpacity>
                  {(kbQuery.data ?? []).map((kb) => (
                    <TouchableOpacity
                      key={kb.id}
                      onPress={() => setKnowledgeBaseId(kb.id)}
                      style={[
                        styles.option,
                        { borderColor: knowledgeBaseId === kb.id ? theme.colors.accent : theme.colors.border },
                      ]}
                    >
                      <Text style={{ color: theme.colors.text, fontSize: 14 }}>{kb.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              label="Create thread"
              onPress={handleCreate}
              loading={isCreating}
              disabled={!selectableAgentId}
              fullWidth
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '85%', paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 },
  body: { paddingHorizontal: 20, gap: 18, paddingBottom: 8 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  hint: { fontSize: 11 },
  options: { gap: 8 },
  option: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  footer: { paddingHorizontal: 20, paddingTop: 10 },
});
