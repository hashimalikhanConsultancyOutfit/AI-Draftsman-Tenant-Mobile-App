import { yupResolver } from '@hookform/resolvers/yup';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, PickerField, TextField, useToast } from '@/components/ui';
import { useGetAvailableAgentsForChatQuery } from '@/features/chat/chatApi';
import { NO_PERMISSION_MESSAGE, THREAD_ACTION_COPY, threadDisplayName } from '@/features/chat/chatRules';
import { useGetAllKnowledgeBasesQuery } from '@/features/knowledge-bases/knowledgeBasesApi';
import type { AgentTeamsStackParamList } from '@/navigation/types';
import { CHAT_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import { useCreateTeamThreadMutation } from './agentTeamsApi';
import { MAX_TEAM_AGENTS, TEAM_CHAT_COPY, normaliseAgentIds } from './agentTeamsRules';
import { AgentChecklistField } from './components/AgentChecklistField';
import { openTeamConversation } from './openTeamConversation';
import { teamChatSchema, type TeamChatFormValues } from './schemas/agentTeamFormSchemas';

type Nav = NativeStackNavigationProp<AgentTeamsStackParamList>;
type Rt = RouteProp<AgentTeamsStackParamList, 'AgentTeamChat'>;

/**
 * New team chat — web's New thread dialog with "Answered by: A team of
 * agents". Reached three ways, as on web: the list's "New team chat"
 * (nobody preselected), a builder team's Chat, and the detail screen's
 * "Start a thread" (that team's agents preselected — the user can still add
 * or drop any of them before creating).
 *
 * Creating it POSTs `/conversations` with `mode: 'AGENT_TEAM'` and the
 * agents; the server mints the roster for this thread, which then shows on
 * the Teams list as a "From chat" team. The new thread opens straight away.
 */
export function TeamChatFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const canManageChat = usePermission(CHAT_PERMISSIONS.MANAGE);
  const agentsQuery = useGetAvailableAgentsForChatQuery();
  const kbQuery = useGetAllKnowledgeBasesQuery();
  const [createThread, { isLoading }] = useCreateTeamThreadMutation();

  const agentOptions = useMemo(() => (agentsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name })), [agentsQuery.data]);
  const kbOptions = useMemo(() => [{ value: '', label: TEAM_CHAT_COPY.noKnowledgeBase }, ...(kbQuery.data ?? []).map((kb) => ({ value: kb.id, label: kb.name }))], [kbQuery.data]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TeamChatFormValues>({
    resolver: yupResolver(teamChatSchema) as never,
    defaultValues: { name: '', agentIds: normaliseAgentIds(params?.agentIds ?? []).slice(0, MAX_TEAM_AGENTS), knowledgeBaseId: '' },
  });

  const onSubmit = async (values: TeamChatFormValues) => {
    if (!canManageChat) {
      toast.show(NO_PERMISSION_MESSAGE.manage, { tone: 'warning' });
      return;
    }
    const title = values.name.trim();
    const knowledgeBaseId = values.knowledgeBaseId.trim();
    try {
      const created = await createThread({
        /* Omitted rather than sent empty — the first message names it. */
        ...(title ? { title } : {}),
        mode: 'AGENT_TEAM',
        agentIds: normaliseAgentIds(values.agentIds),
        ...(knowledgeBaseId ? { knowledgeBaseId } : {}),
      }).unwrap();
      toast.show(THREAD_ACTION_COPY.create.done(threadDisplayName(created.title)), { tone: 'success' });
      navigation.goBack();
      openTeamConversation(navigation, created.id, created.title);
    } catch (err) {
      toast.show(getErrorMessage(err as never, THREAD_ACTION_COPY.create.failed), { tone: 'error' });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={TEAM_CHAT_COPY.title} mode="stack" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{TEAM_CHAT_COPY.description}</Text>

          <Card>
            <Controller
              control={control}
              name="name"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextField
                  label="Thread name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="e.g. Barrow Foods · returns policy"
                  hint={TEAM_CHAT_COPY.nameHint}
                  error={errors.name?.message}
                />
              )}
            />
          </Card>

          <Card>
            <Controller
              control={control}
              name="agentIds"
              render={({ field: { value, onChange } }) => (
                <AgentChecklistField
                  label="Agents *"
                  values={value ?? []}
                  options={agentOptions}
                  onChange={onChange}
                  maxItems={MAX_TEAM_AGENTS}
                  loading={agentsQuery.isLoading}
                  loadError={agentsQuery.isError ? 'Agents could not be loaded — try again in a moment.' : null}
                  hint={TEAM_CHAT_COPY.agentsHint}
                  error={errors.agentIds?.message}
                />
              )}
            />
          </Card>

          <Card>
            <Controller
              control={control}
              name="knowledgeBaseId"
              render={({ field: { value, onChange } }) => (
                <PickerField label="Knowledge base" value={value} options={kbOptions} onChange={onChange} searchable={kbOptions.length > 6} hint={TEAM_CHAT_COPY.kbHint} />
              )}
            />
          </Card>

          <View style={styles.actions}>
            <Button label="Cancel" variant="outline" onPress={() => navigation.goBack()} style={{ flex: 1 }} disabled={isLoading} />
            <Button label={TEAM_CHAT_COPY.submit} onPress={handleSubmit(onSubmit)} loading={isLoading} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  actions: { flexDirection: 'row', gap: 10 },
});
