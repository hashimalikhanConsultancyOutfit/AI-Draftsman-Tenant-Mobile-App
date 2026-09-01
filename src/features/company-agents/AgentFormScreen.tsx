import { yupResolver } from '@hookform/resolvers/yup';
import type { SerializedError } from '@reduxjs/toolkit';
import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Icon, Loader, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import type { ApiQueryError } from '@/store/baseQuery';
import { useAppTheme } from '@/theme/ThemeContext';

import type { CompanyAgentsStackParamList } from '@/navigation/types';
import { MEMORY_OPTIONS, PRICING_MODE_OPTIONS } from './agentRules';
import { agentFormSchema, type AgentFormValues } from './schemas/agentFormSchema';
import {
  useCreateAgentMutation,
  useGetAgentsQuery,
  useGetAllKnowledgeBasesLiteQuery,
  useGetLabModelsQuery,
  useGetLabsQuery,
  useLookupLabModelQuery,
  useUpdateAgentMutation,
  type AgentFormInput,
} from './companyAgentsApi';
import type { Agent } from './companyAgents.types';

type Nav = NativeStackNavigationProp<CompanyAgentsStackParamList>;
type Rt = RouteProp<CompanyAgentsStackParamList, 'AgentForm'>;

function PillRow<T extends string>({
  options,
  value,
  onChange,
  disabledHint,
}: {
  options: Array<{ label: string; value: T }>;
  value: T | '';
  onChange: (value: T) => void;
  disabledHint?: string;
}) {
  const { theme } = useAppTheme();
  if (options.length === 0 && disabledHint) {
    return (
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
        {disabledHint}
      </Text>
    );
  }
  return (
    <View style={styles.pillWrap}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.75}
            style={[
              styles.pill,
              {
                borderRadius: theme.radii.full,
                borderWidth: theme.borders.interactive,
                borderColor: selected ? theme.colors.accent : theme.colors.border,
                backgroundColor: selected ? theme.colors.accent + '1A' : theme.colors.surface,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Text style={{ color: selected ? theme.colors.accent : theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function FieldLabel({ children, hint }: { children: string; hint?: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{children}</Text>
      {hint && (
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }}>
          {hint}
        </Text>
      )}
    </View>
  );
}

/** Same visual language as TextField's own helper text — used under
 * PillRow/checkbox/switch fields, which aren't TextInputs and so can't use
 * TextField's built-in `error` prop themselves. */
function FieldError({ message }: { message?: string }) {
  const { theme } = useAppTheme();
  if (!message) return null;
  return (
    <Text style={{ color: theme.colors.error, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 6 }}>
      {message}
    </Text>
  );
}

export function AgentFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();
  const isEdit = Boolean(params?.id);

  const { data: agents, isLoading: isLoadingAgents } = useGetAgentsQuery();
  const editingAgent: Agent | null = useMemo(
    () => (isEdit ? (agents?.find((a) => a.id === params.id) ?? null) : null),
    [agents, isEdit, params?.id],
  );

  const { data: labs, isLoading: isLabsLoading, isError: isLabsError, error: labsError, refetch: retryLabs } = useGetLabsQuery();
  const { data: knowledgeBases } = useGetAllKnowledgeBasesLiteQuery();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AgentFormValues>({
    resolver: yupResolver(agentFormSchema),
    defaultValues: {
      name: '',
      modelSlug: '',
      tools: '',
      memory: 'NO_MEMORY',
      kbIds: [],
      prompt: '',
      mode: 'PER_RUN',
      price: '0.04',
      isSupportAgent: false,
      note: '',
    },
  });

  const modelSlug = watch('modelSlug');

  const [labId, setLabId] = useState('');
  const [hydrated, setHydrated] = useState(false);

  /* Resolve which lab an edited agent's stored model belongs to, since the
     agent contract stores only `modelSlug` — see the web app's own
     `useCompanyAgents.tsx` for the same lookup. */
  const { currentData: modelLookup } = useLookupLabModelQuery(
    isEdit && editingAgent?.model ? editingAgent.model : skipToken,
  );

  useEffect(() => {
    if (hydrated || !isEdit || !editingAgent) return;
    reset({
      name: editingAgent.name,
      modelSlug: editingAgent.model ?? '',
      tools: editingAgent.tools ?? '',
      memory: editingAgent.memory ?? 'NO_MEMORY',
      kbIds: editingAgent.kbIds ?? [],
      prompt: editingAgent.prompt ?? '',
      mode: editingAgent.mode,
      price: String(editingAgent.price ?? 0),
      isSupportAgent: editingAgent.isSupportAgent,
      note: '',
    });
    setHydrated(true);
  }, [editingAgent, hydrated, isEdit, reset]);

  useEffect(() => {
    if (isEdit && !labId && modelLookup?.found && modelLookup.model) {
      setLabId(modelLookup.model.labId);
    }
  }, [isEdit, labId, modelLookup]);

  const { data: models, isLoading: isModelsLoading } = useGetLabModelsQuery(labId, { skip: !labId });

  const modelOptions = useMemo(() => {
    const list = (models ?? []).map((m) => ({ label: m.name, value: m.slug }));
    /* Keep the currently-stored model selectable even if the catalogue has
       since retired it — an edit dialog must not silently drop what is
       actually running. */
    if (modelSlug && !list.some((o) => o.value === modelSlug)) {
      list.unshift({ label: `${modelSlug} (current)`, value: modelSlug });
    }
    return list;
  }, [models, modelSlug]);

  const [createAgent, { isLoading: isCreating }] = useCreateAgentMutation();
  const [updateAgent, { isLoading: isUpdating }] = useUpdateAgentMutation();
  const isSubmitting = isCreating || isUpdating;

  const onSubmit = async (values: AgentFormValues) => {
    const input: AgentFormInput = {
      name: values.name.trim(),
      model: values.modelSlug,
      tools: values.tools ?? '',
      memory: values.memory,
      kbIds: values.kbIds ?? [],
      prompt: values.prompt ?? '',
      mode: values.mode,
      price: Number(values.price),
      locked: editingAgent?.locked ?? [],
      isSupportAgent: values.isSupportAgent ?? false,
    };

    try {
      if (isEdit && editingAgent) {
        const result = await updateAgent({ id: editingAgent.id, note: values.note?.trim() || undefined, ...input }).unwrap();
        if (result.definitionInvalidated) {
          toast.show('Saved — evaluation reset, since the definition changed. Re-run Evaluate before publishing.', { tone: 'warning' });
        } else {
          toast.show('Agent updated.', { tone: 'success' });
        }
      } else {
        await createAgent(input).unwrap();
        toast.show('Agent created as an unevaluated draft.', { tone: 'success' });
      }
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as ApiQueryError | SerializedError, 'Could not save this agent.'), { tone: 'error' });
    }
  };

  if (isEdit && isLoadingAgents && !editingAgent) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Edit agent" mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (isEdit && !isLoadingAgents && !editingAgent) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Edit agent" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message="This agent no longer exists." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={isEdit ? 'Edit agent' : 'Create agent'} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
          {isEdit
            ? 'The gate hashes the prompt, model and tools — changing any of the three invalidates a pass. Any change is saved as a new version you can restore later.'
            : 'New agents start as an unevaluated draft at v1. They cannot be published until they pass the gate.'}
        </Text>

        <Card>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField label="Name" value={value} onChangeText={onChange} onBlur={onBlur} placeholder="e.g. Returns handler" error={errors.name?.message} />
            )}
          />
        </Card>

        <Card>
          <FieldLabel hint="The lab (manufacturer) whose models this agent may use.">Lab</FieldLabel>
          {isLabsError ? (
            <ErrorState message={getErrorMessage(labsError as ApiQueryError | SerializedError, 'Could not load the model catalogue.')} retryLabel="Retry" onRetry={retryLabs} />
          ) : isLabsLoading ? (
            <Loader />
          ) : (
            <PillRow
              options={(labs ?? []).map((l) => ({ label: l.name, value: l.id }))}
              value={labId}
              onChange={(id) => {
                setLabId(id);
                setValue('modelSlug', '', { shouldValidate: true });
              }}
            />
          )}

          <View style={{ height: 14 }} />
          <FieldLabel hint="The exact model this agent answers with.">Model</FieldLabel>
          {isModelsLoading ? (
            <Loader />
          ) : (
            <Controller
              control={control}
              name="modelSlug"
              render={({ field: { value, onChange } }) => (
                <PillRow
                  options={modelOptions}
                  value={value}
                  onChange={onChange}
                  disabledHint={labId ? 'No models available for this lab.' : 'Select a lab first.'}
                />
              )}
            />
          )}
          <FieldError message={errors.modelSlug?.message} />
        </Card>

        <Card>
          <Controller
            control={control}
            name="tools"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label="Tools"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="e.g. order-lookup, Drive, Slack"
                hint="Comma-separated."
                error={errors.tools?.message}
              />
            )}
          />
        </Card>

        <Card>
          <FieldLabel hint="What the agent remembers between runs.">Memory</FieldLabel>
          <Controller
            control={control}
            name="memory"
            render={({ field: { value, onChange } }) => <PillRow options={MEMORY_OPTIONS} value={value} onChange={onChange} />}
          />
        </Card>

        <Card>
          <FieldLabel hint="Knowledge the agent may answer from. Optional.">Knowledge bases</FieldLabel>
          {(knowledgeBases ?? []).length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
              No knowledge bases yet.
            </Text>
          ) : (
            <Controller
              control={control}
              name="kbIds"
              render={({ field: { value, onChange } }) => (
                <View style={{ gap: 8 }}>
                  {(knowledgeBases ?? []).map((kb) => {
                    const checked = (value ?? []).includes(kb.id);
                    return (
                      <TouchableOpacity
                        key={kb.id}
                        onPress={() => onChange(checked ? (value ?? []).filter((k) => k !== kb.id) : [...(value ?? []), kb.id])}
                        style={styles.kbRow}
                        activeOpacity={0.7}
                      >
                        <Icon name={checked ? 'check-box' : 'check-box-outline-blank'} size={20} color={checked ? theme.colors.accent : theme.colors.textMuted} />
                        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>{kb.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            />
          )}
        </Card>

        <Card>
          <Controller
            control={control}
            name="prompt"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label="System prompt"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Describe what this agent should do."
                multiline
                numberOfLines={6}
                style={{ minHeight: 120, textAlignVertical: 'top' }}
                error={errors.prompt?.message}
              />
            )}
          />
        </Card>

        <Card>
          <FieldLabel hint="How this agent's runs are charged.">Pricing mode</FieldLabel>
          <Controller
            control={control}
            name="mode"
            render={({ field: { value, onChange } }) => <PillRow options={PRICING_MODE_OPTIONS} value={value} onChange={onChange} />}
          />
          <View style={{ height: 14 }} />
          <Controller
            control={control}
            name="price"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField label="Unit price (£)" value={value} onChangeText={onChange} onBlur={onBlur} keyboardType="decimal-pad" error={errors.price?.message} />
            )}
          />
        </Card>

        <Card>
          <Controller
            control={control}
            name="isSupportAgent"
            render={({ field: { value, onChange } }) => (
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
                    Support agent
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }}>
                    Only one agent holds this at a time. Turning it on moves the flag off whichever agent has it now.
                  </Text>
                </View>
                <Switch value={value} onValueChange={onChange} trackColor={{ true: theme.colors.accent }} />
              </View>
            )}
          />
        </Card>

        {isEdit && (
          <Card>
            <Controller
              control={control}
              name="note"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextField
                  label="Note"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="e.g. Tightened the refund wording after the Q3 audit"
                  hint="Recorded against this version. Optional."
                  error={errors.note?.message}
                />
              )}
            />
          </Card>
        )}

        <Button label={isEdit ? 'Save changes' : 'Create draft'} onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8 },
  kbRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
