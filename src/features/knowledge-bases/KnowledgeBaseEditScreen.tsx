import { yupResolver } from '@hookform/resolvers/yup';
import type { SerializedError } from '@reduxjs/toolkit';
import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Icon, Loader, TextField, useToast } from '@/components/ui';
import { useGetAgentsQuery } from '@/features/company-agents/companyAgentsApi';
import { getErrorMessage } from '@/services/apiErrorMessage';
import type { ApiQueryError } from '@/store/baseQuery';
import { useAppTheme } from '@/theme/ThemeContext';

import type { KnowledgeBasesStackParamList } from '@/navigation/types';
import { buildReachSummary, buildWideningWarning, isWideningScope, SCOPE_OPTIONS } from './knowledgeBaseRules';
import { useCreateKnowledgeBaseMutation, useGetKnowledgeBaseQuery, useUpdateKnowledgeBaseMutation } from './knowledgeBasesApi';
import { knowledgeBaseEditSchema, type KnowledgeBaseEditFormValues } from './schemas/knowledgeBaseEditSchema';

type Nav = NativeStackNavigationProp<KnowledgeBasesStackParamList>;
type Rt = RouteProp<KnowledgeBasesStackParamList, 'KnowledgeBaseEdit'>;

function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.pill,
        {
          borderRadius: theme.radii.full,
          borderWidth: theme.borders.interactive,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          backgroundColor: selected ? theme.colors.accent + '14' : theme.colors.statusNeutralBg,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {selected && <View style={[styles.pillDot, { backgroundColor: theme.colors.accent }]} />}
      <Text
        style={{
          color: selected ? theme.colors.accent : theme.colors.text,
          fontFamily: selected ? theme.fontFamilies.body.semibold : theme.fontFamilies.body.medium,
          fontSize: theme.fontSizes.xs,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** Same visual language as TextField's own helper text — used under
 * PillRow-driven fields, which aren't TextInputs and can't use TextField's
 * built-in `error` prop themselves. */
function FieldError({ message }: { message?: string }) {
  const { theme } = useAppTheme();
  if (!message) return null;
  return (
    <Text style={{ color: theme.colors.error, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 8 }}>
      {message}
    </Text>
  );
}

export function KnowledgeBaseEditScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();
  const isEdit = Boolean(params?.id);

  const { data: base, isLoading, error } = useGetKnowledgeBaseQuery(params?.id ?? '', { skip: !isEdit });
  const { data: agents } = useGetAgentsQuery();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<KnowledgeBaseEditFormValues>({
    resolver: yupResolver(knowledgeBaseEditSchema),
    defaultValues: { name: '', scope: 'Customer', agentIds: [], sourceUrls: [] },
  });
  const { fields: sourceUrlFields, append: appendSourceUrl, remove: removeSourceUrl } = useFieldArray({ control, name: 'sourceUrls' });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || (isEdit && !base)) return;
    if (base) {
      reset({
        name: base.name,
        scope: base.scope,
        agentIds: base.agentIds,
        sourceUrls: base.sourceUrls.map((s) => ({ id: s.id, url: s.url })),
      });
    }
    setHydrated(true);
  }, [base, hydrated, isEdit, reset]);

  const [createKnowledgeBase, { isLoading: isCreating }] = useCreateKnowledgeBaseMutation();
  const [updateKnowledgeBase, { isLoading: isUpdating }] = useUpdateKnowledgeBaseMutation();
  const isSaving = isCreating || isUpdating;

  const onSubmit = async (values: KnowledgeBaseEditFormValues) => {
    const trimmedName = values.name.trim();
    const urls = (values.sourceUrls ?? []).map((s) => ({ id: s.id, url: (s.url ?? '').trim() })).filter((s) => s.url !== '');
    const agentIds = values.agentIds ?? [];

    try {
      if (isEdit && base) {
        await updateKnowledgeBase({ id: base.id, name: trimmedName, scope: values.scope, agentIds, sourceUrls: urls }).unwrap();
        if (isWideningScope(base.scope, values.scope)) {
          toast.show(buildWideningWarning(trimmedName, base.scope, values.scope), { tone: 'warning' });
        } else {
          const selectedNames = (agents ?? []).filter((a) => agentIds.includes(a.id)).map((a) => a.name).join(', ');
          toast.show(`${trimmedName} saved. ${buildReachSummary(values.scope, selectedNames)}`, { tone: 'success' });
        }
      } else {
        const created = await createKnowledgeBase({ name: trimmedName, scope: values.scope, agentIds, sourceUrls: urls }).unwrap();
        toast.show(`${created.name} created. ${buildReachSummary(created.scope, created.scopeId)}`, { tone: 'success' });
      }
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as ApiQueryError | SerializedError, 'Could not save that knowledge base.'), { tone: 'error' });
    }
  };

  if (isEdit && isLoading && !base) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Edit knowledge base" mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (isEdit && !isLoading && (!base || error)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Edit knowledge base" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message="This knowledge base no longer exists." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={isEdit ? `Edit ${base?.name ?? ''}` : 'New knowledge base'} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
          {isEdit
            ? "Changing the scope changes who can read these documents. Widening is warned about; narrowing is not."
            : 'Pick the narrowest scope that works. Widening it later exposes the documents to readers who cannot see them today.'}
        </Text>

        <Card>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField label="Name" value={value} onChangeText={onChange} onBlur={onBlur} placeholder="e.g. Refund policy" error={errors.name?.message} />
            )}
          />
        </Card>

        <Card>
          <Text style={[styles.label, { color: theme.colors.text }]}>Scope</Text>
          <Controller
            control={control}
            name="scope"
            render={({ field: { value, onChange } }) => (
              <View style={styles.pillWrap}>
                {SCOPE_OPTIONS.map((opt) => (
                  <Pill key={opt.value} label={opt.label} selected={opt.value === value} onPress={() => onChange(opt.value)} />
                ))}
              </View>
            )}
          />
          <FieldError message={errors.scope?.message} />
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 8 }}>
            Scope is the security boundary — it decides which clones can read these documents.
          </Text>
        </Card>

        <Card>
          <Text style={[styles.label, { color: theme.colors.text }]}>Agents</Text>
          {(agents ?? []).length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>No company agents yet.</Text>
          ) : (
            <Controller
              control={control}
              name="agentIds"
              render={({ field: { value, onChange } }) => (
                <View style={styles.pillWrap}>
                  {(agents ?? []).map((agent) => {
                    const checked = (value ?? []).includes(agent.id);
                    return (
                      <Pill
                        key={agent.id}
                        label={agent.name}
                        selected={checked}
                        onPress={() => onChange(checked ? (value ?? []).filter((a) => a !== agent.id) : [...(value ?? []), agent.id])}
                      />
                    );
                  })}
                </View>
              )}
            />
          )}
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 8 }}>
            Every company agent that may use this knowledge base. Leave empty to assign it later.
          </Text>
        </Card>

        <Card>
          <Text style={[styles.label, { color: theme.colors.text }]}>Source URLs</Text>
          {sourceUrlFields.map((field, index) => (
            <View key={field.id} style={styles.sourceRow}>
              <View style={{ flex: 1 }}>
                <Controller
                  control={control}
                  name={`sourceUrls.${index}.url`}
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextField
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="https://docs.example.com/policies"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      error={errors.sourceUrls?.[index]?.url?.message}
                    />
                  )}
                />
              </View>
              <TouchableOpacity onPress={() => removeSourceUrl(index)} hitSlop={8} style={styles.removeBtn}>
                <Icon name="close" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
          <Button
            label="Add URL"
            icon="add"
            variant="outline"
            size="sm"
            onPress={() => appendSourceUrl({ url: '' })}
            style={{ marginTop: sourceUrlFields.length > 0 ? 4 : 0, alignSelf: 'flex-start' }}
          />
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 8 }}>
            One source per row. Each is saved with its own id, so editing the list does not disturb the others.
          </Text>
        </Card>

        <Button label={isEdit ? 'Save changes' : 'Create'} onPress={handleSubmit(onSubmit)} loading={isSaving} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  label: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 13, marginBottom: 10 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  sourceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  removeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
});
