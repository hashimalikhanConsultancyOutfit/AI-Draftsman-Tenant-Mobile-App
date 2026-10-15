import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Loader, TextField, useToast } from '@/components/ui';
import { useGetAvailableAgentsForChatQuery } from '@/features/chat/chatApi';
import type { AgentTeamsStackParamList } from '@/navigation/types';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import {
  useAddAgentTeamMemberMutation,
  useCreateAgentTeamMutation,
  useGetAgentTeamQuery,
  useRemoveAgentTeamMemberMutation,
  useUpdateAgentTeamMutation,
} from './agentTeamsApi';
import {
  MAX_TEAM_AGENTS,
  TEAM_FORM_COPY,
  TEAM_NAME_MAX,
  TEAM_PURPOSE_MAX,
  editablePurpose,
  normaliseAgentIds,
  planChangesAnything,
  planTeamEdit,
  toAgentTeamRow,
} from './agentTeamsRules';
import { AgentChecklistField } from './components/AgentChecklistField';
import { AGENT_TEAM_FORM_DEFAULTS, agentTeamFormSchema, type AgentTeamFormValues } from './schemas/agentTeamFormSchemas';

type Nav = NativeStackNavigationProp<AgentTeamsStackParamList>;
type Rt = RouteProp<AgentTeamsStackParamList, 'AgentTeamForm'>;

/**
 * New team / Edit team — web's create and edit dialogs (one field list,
 * different defaults). Name (required, ≤120), Purpose (optional, ≤2000 —
 * blank uses the name), Agents (1–8, from `GET /agents/available`, the same
 * list a chat thread offers).
 *
 * ── AN EDIT IS UP TO THREE CALLS, IN ORDER ─────────────────────────────
 * PATCH name/purpose if they changed, then add the new agents, then remove
 * the dropped ones — additions first, because the server refuses removing
 * the last member. Nothing changed → nothing sent, and "Nothing changed."
 */
export function AgentTeamFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();
  const isEdit = Boolean(params?.id);

  const teamQuery = useGetAgentTeamQuery(params?.id ?? '', { skip: !isEdit });
  const team = teamQuery.data;
  const agentsQuery = useGetAvailableAgentsForChatQuery();

  const [createTeam, { isLoading: isCreating }] = useCreateAgentTeamMutation();
  const [updateTeam, { isLoading: isUpdating }] = useUpdateAgentTeamMutation();
  const [addMember, { isLoading: isAdding }] = useAddAgentTeamMemberMutation();
  const [removeMember, { isLoading: isRemoving }] = useRemoveAgentTeamMemberMutation();
  const isSaving = isCreating || isUpdating || isAdding || isRemoving;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AgentTeamFormValues>({
    resolver: yupResolver(agentTeamFormSchema) as never,
    defaultValues: AGENT_TEAM_FORM_DEFAULTS,
  });

  const [hydrated, setHydrated] = useState(!isEdit);
  useEffect(() => {
    if (hydrated || !team) return;
    reset({ name: team.name, purpose: editablePurpose(team), agentIds: team.specialists.map((m) => m.agentId) });
    setHydrated(true);
  }, [team, hydrated, reset]);

  /* The live list, plus any current member it no longer offers — an agent
     on the team must stay visible (and untickable) in its own edit form. */
  const agentOptions = useMemo(() => {
    const opts = (agentsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name }));
    const known = new Set(opts.map((o) => o.value));
    for (const m of team?.specialists ?? []) {
      if (!known.has(m.agentId)) opts.push({ value: m.agentId, label: m.name });
    }
    return opts;
  }, [agentsQuery.data, team]);

  const copy = isEdit ? TEAM_FORM_COPY.edit : TEAM_FORM_COPY.create;

  const onSubmit = async (values: AgentTeamFormValues) => {
    const name = values.name.trim();
    const purpose = (values.purpose ?? '').trim();
    const agentIds = normaliseAgentIds(values.agentIds);

    try {
      if (!isEdit) {
        const created = await createTeam({ name, ...(purpose ? { purpose } : {}), memberAgentIds: agentIds }).unwrap();
        toast.show(`${created.name} created.`, { tone: 'success' });
        navigation.goBack();
        return;
      }
      if (!team) return;
      const plan = planTeamEdit(toAgentTeamRow(team), { name, purpose, agentIds });
      if (plan.definitionChanged) {
        await updateTeam({ id: team.id, body: { name, purpose: plan.nextPurpose } }).unwrap();
      }
      for (const agentId of plan.added) {
        await addMember({ teamId: team.id, agentId }).unwrap();
      }
      for (const member of plan.removed) {
        await removeMember({ teamId: team.id, memberId: member.memberId }).unwrap();
      }
      toast.show(planChangesAnything(plan) ? `${name} saved.` : 'Nothing changed.', { tone: 'success' });
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as never, isEdit ? 'Could not save that team.' : 'Could not create that team.'), { tone: 'error' });
    }
  };

  if (isEdit && teamQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (isEdit && (teamQuery.error || !team)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message={getErrorMessage(teamQuery.error as never, 'This team could not be loaded.')} onRetry={teamQuery.refetch} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{copy.description}</Text>

          <Card style={styles.card}>
            <Controller
              control={control}
              name="name"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextField
                  label="Team name *"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  hint={TEAM_FORM_COPY.nameHint}
                  error={errors.name?.message}
                  accessibilityHint={`Up to ${TEAM_NAME_MAX} characters`}
                />
              )}
            />
            <Controller
              control={control}
              name="purpose"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextField
                  label="Purpose"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 84, textAlignVertical: 'top', paddingTop: 10 }}
                  hint={TEAM_FORM_COPY.purposeHint}
                  error={errors.purpose?.message}
                  accessibilityHint={`Optional. Up to ${TEAM_PURPOSE_MAX} characters`}
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
                  hint={TEAM_FORM_COPY.agentsHint}
                  error={errors.agentIds?.message}
                />
              )}
            />
          </Card>

          <View style={styles.actions}>
            <Button label="Cancel" variant="outline" onPress={() => navigation.goBack()} style={{ flex: 1 }} disabled={isSaving} />
            <Button label={copy.submitLabel} onPress={handleSubmit(onSubmit)} loading={isSaving} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  card: { gap: 14 },
  actions: { flexDirection: 'row', gap: 10 },
});
