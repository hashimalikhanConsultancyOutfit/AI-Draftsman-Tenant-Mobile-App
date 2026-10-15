import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, PickerField, TextField, useToast } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useCreateTeamThreadMutation } from '@/features/agent-teams/agentTeamsApi';
import { AgentChecklistField } from '@/features/agent-teams/components/AgentChecklistField';
import { useGetAllKnowledgeBasesQuery } from '@/features/knowledge-bases/knowledgeBasesApi';

import { MAX_THREAD_TITLE_LENGTH, NO_PERMISSION_MESSAGE, THREAD_ACTION_COPY, threadDisplayName } from '../chatRules';
import { useCreateChatThreadMutation, useGetAvailableAgentsForChatQuery } from '../chatApi';
import { ANSWERED_BY_OPTIONS, MAX_THREAD_AGENTS, NEW_THREAD_TEAM_COPY as COPY, agentBlockedNote, knowledgeBaseHint, validateTeamAgents, type ThreadKind } from '../teamChatRules';

interface NewThreadSheetProps {
  visible: boolean;
  canManage: boolean;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
  /** Which kind the sheet opens on — the list's current tab, as web's
   * dialog defaults "Answered by" to the tab it was opened from. */
  initialAnsweredBy?: ThreadKind;
  /** Pre-ticked team agents (a builder team's "Chat"). Only agents the
   * picker can actually offer are kept — an unpickable one would sit in the
   * value with no row to untick it from, exactly web's rule. */
  initialAgentIds?: string[];
}

/**
 * New thread — web's dialog (`NEW_THREAD_FIELDS`), field for field:
 *  - Thread name (optional; blank → the first message names it),
 *  - Answered by * (One agent / A team of agents),
 *  - Agent * — a searchable select, preselected to the first usable agent —
 *    or Agents * — a searchable checklist, at most 8, "n of 8 selected",
 *  - Knowledge base (optional, "No knowledge base" first).
 * Agents that are not deployed are listed but cannot be picked, with the
 * reason ("not evaluated" / "archived" / "not deployed"), in both pickers.
 */
export function NewThreadSheet({ visible, canManage, onClose, onCreated, initialAnsweredBy = 'agent', initialAgentIds }: NewThreadSheetProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [answeredBy, setAnsweredBy] = useState<ThreadKind>(initialAnsweredBy);
  const [agentId, setAgentId] = useState('');
  const [teamAgentIds, setTeamAgentIds] = useState<string[]>([]);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [knowledgeBaseId, setKnowledgeBaseId] = useState('');
  const isTeam = answeredBy === 'team';

  const agentsQuery = useGetAvailableAgentsForChatQuery(undefined, { skip: !visible });
  const kbQuery = useGetAllKnowledgeBasesQuery(undefined, { skip: !visible });
  const [createThread, { isLoading: isCreating }] = useCreateChatThreadMutation();
  const [createTeamThread, { isLoading: isCreatingTeam }] = useCreateTeamThreadMutation();
  const submitting = isCreating || isCreatingTeam;

  /* ONE option list for both pickers, under one rule — web's `agentOptions`. */
  const agentOptions = useMemo(
    () =>
      (agentsQuery.data ?? []).map((agent) => {
        const blocked = agentBlockedNote(agent.status);
        return { value: agent.id, label: agent.name, disabled: Boolean(blocked), description: blocked ?? undefined, hint: blocked };
      }),
    [agentsQuery.data],
  );
  const firstUsable = agentOptions.find((o) => !o.disabled)?.value ?? '';

  const kbOptions = useMemo(
    () => [{ value: '', label: COPY.noKb }, ...(kbQuery.data ?? []).map((kb) => ({ value: kb.id, label: kb.name }))],
    [kbQuery.data],
  );
  const kbSettledAndEmpty = !kbQuery.isFetching && (kbQuery.data ?? []).length === 0;

  /* Every open starts clean, on the tab's kind, with the first usable agent
     picked — exactly what web's dialog seeds. */
  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setAnsweredBy(initialAnsweredBy);
    setTeamAgentIds([]);
    setTeamError(null);
    setAgentError(null);
    setKnowledgeBaseId('');
    setAgentId('');
  }, [visible, initialAnsweredBy]);

  useEffect(() => {
    if (visible && !agentId && firstUsable) setAgentId(firstUsable);
  }, [visible, agentId, firstUsable]);

  /* Seeded once the agent list has loaded, so the "offerable" filter has
     something to check against. */
  const presetKey = (initialAgentIds ?? []).join(',');
  useEffect(() => {
    if (!visible || !presetKey || !agentsQuery.data) return;
    const offerable = new Set(agentOptions.filter((o) => !o.disabled).map((o) => o.value));
    setTeamAgentIds(presetKey.split(',').filter((id) => offerable.has(id)).slice(0, MAX_THREAD_AGENTS));
  }, [visible, presetKey, agentsQuery.data, agentOptions]);

  const done = (id: string, createdTitle: string | null | undefined) => {
    toast.show(THREAD_ACTION_COPY.create.done(threadDisplayName(createdTitle ?? '')), { tone: 'success' });
    onClose();
    onCreated(id);
  };

  const handleCreate = async () => {
    if (!canManage) {
      toast.show(NO_PERMISSION_MESSAGE.manage, { tone: 'warning' });
      return;
    }
    const trimmed = title.trim();
    if (isTeam) {
      const error = validateTeamAgents(teamAgentIds);
      setTeamError(error);
      if (error) return;
      try {
        const created = await createTeamThread({
          /* Omitted rather than sent empty — the first message names it. */
          ...(trimmed ? { title: trimmed } : {}),
          mode: 'AGENT_TEAM',
          agentIds: teamAgentIds,
          ...(knowledgeBaseId ? { knowledgeBaseId } : {}),
        }).unwrap();
        done(created.id, created.title);
      } catch (err) {
        toast.show(getErrorMessage(err as never, COPY.saveFailed), { tone: 'error' });
      }
      return;
    }
    if (!agentId) {
      setAgentError('Agent is required');
      return;
    }
    try {
      const created = await createThread({ title: trimmed, agentId, knowledgeBaseId: knowledgeBaseId || null }).unwrap();
      done(created.id, created.title);
    } catch (err) {
      toast.show(getErrorMessage(err as never, COPY.saveFailed), { tone: 'error' });
    }
  };

  const agentHint = agentsQuery.isError ? COPY.agentsUnavailable : agentsQuery.isSuccess && !firstUsable ? COPY.noUsableAgent : undefined;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.scrim}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityLabel="Close" />
          <View
            style={[
              styles.sheet,
              { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 16, borderTopLeftRadius: theme.radii.sheetTop, borderTopRightRadius: theme.radii.sheetTop },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            <View style={styles.header}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg }}>New thread</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
                <Icon name="close" size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{COPY.description}</Text>

              <TextField
                label={COPY.nameLabel}
                value={title}
                onChangeText={setTitle}
                maxLength={MAX_THREAD_TITLE_LENGTH}
                placeholder={COPY.namePlaceholder}
                hint={COPY.nameHint}
              />

              <PickerField
                label={COPY.answeredByLabel}
                value={answeredBy}
                options={ANSWERED_BY_OPTIONS}
                onChange={(v) => {
                  setAnsweredBy(v as ThreadKind);
                  setTeamError(null);
                  setAgentError(null);
                }}
              />

              {isTeam ? (
                <AgentChecklistField
                  label={COPY.agentsLabel}
                  values={teamAgentIds}
                  options={agentOptions}
                  onChange={(ids) => {
                    setTeamAgentIds(ids);
                    if (teamError) setTeamError(validateTeamAgents(ids));
                  }}
                  maxItems={MAX_THREAD_AGENTS}
                  loading={agentsQuery.isLoading}
                  loadError={agentsQuery.isError ? COPY.agentsUnavailable : null}
                  hint={COPY.agentsHint}
                  error={teamError ?? undefined}
                />
              ) : (
                <PickerField
                  label={COPY.agentLabel}
                  value={agentId}
                  options={agentOptions}
                  onChange={(v) => {
                    setAgentId(v);
                    setAgentError(null);
                  }}
                  searchable
                  searchPlaceholder={COPY.searchAgents}
                  placeholder={agentsQuery.isLoading ? 'Loading agents…' : 'Select…'}
                  disabled={agentsQuery.isLoading}
                  hint={agentHint}
                  error={agentError ?? undefined}
                />
              )}

              <PickerField
                label={COPY.kbLabel}
                value={knowledgeBaseId}
                options={kbOptions}
                onChange={setKnowledgeBaseId}
                searchable={kbOptions.length > 6}
                hint={kbQuery.isFetching && !kbQuery.data ? 'Loading your knowledge bases…' : knowledgeBaseHint(kbQuery.isError, kbSettledAndEmpty)}
              />
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
              <Button label="Cancel" variant="outline" onPress={onClose} disabled={submitting} style={{ flex: 1 }} />
              <Button label="Create thread" onPress={handleCreate} loading={submitting} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '90%', paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 },
  body: { paddingHorizontal: 20, gap: 18, paddingBottom: 12 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
