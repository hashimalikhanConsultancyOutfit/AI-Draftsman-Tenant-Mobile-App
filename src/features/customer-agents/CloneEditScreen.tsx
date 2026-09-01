import { yupResolver } from '@hookform/resolvers/yup';
import type { SerializedError } from '@reduxjs/toolkit';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Loader, TextField, useToast } from '@/components/ui';
import { useGetAgentsQuery } from '@/features/company-agents/companyAgentsApi';
import { getErrorMessage } from '@/services/apiErrorMessage';
import type { ApiQueryError } from '@/store/baseQuery';
import { useAppTheme } from '@/theme/ThemeContext';

import type { CustomerAgentsStackParamList } from '@/navigation/types';
import { CLONE_EDIT_DESCRIPTION, CLONE_HASH_INVALIDATION_MESSAGE, resolveCloneDefinition } from './cloneRules';
import { useGetAllClonesQuery, useUpdateCloneMutation } from './customerAgentsApi';
import { cloneEditSchema, type CloneEditFormValues } from './schemas/cloneEditSchema';

type Nav = NativeStackNavigationProp<CustomerAgentsStackParamList>;
type Rt = RouteProp<CustomerAgentsStackParamList, 'CloneEdit'>;

export function CloneEditScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const { data: clones, isLoading, error } = useGetAllClonesQuery();
  const { data: agents } = useGetAgentsQuery();
  const clone = clones?.find((c) => c.id === params.id) ?? null;
  const master = agents?.find((a) => a.name === clone?.parent) ?? null;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CloneEditFormValues>({
    resolver: yupResolver(cloneEditSchema),
    defaultValues: { model: '', tools: '', prompt: '', note: '' },
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || !clone) return;
    const definition = resolveCloneDefinition(clone, master);
    reset({ model: definition.model, tools: definition.tools, prompt: definition.prompt, note: '' });
    setHydrated(true);
  }, [clone, master, hydrated, reset]);

  const [updateClone, { isLoading: isSaving }] = useUpdateCloneMutation();

  const onSubmit = async (values: CloneEditFormValues) => {
    if (!clone) return;
    try {
      const saved = await updateClone({ id: clone.id, model: values.model, tools: values.tools ?? '', prompt: values.prompt ?? '', note: values.note?.trim() || undefined }).unwrap();
      const div = saved.div;
      const asVersion = saved.version === null ? '' : ` Saved as v${String(saved.version)}.`;

      if (div.length === 0) {
        toast.show(`${clone.cust}'s copy now matches the master exactly — divergence cleared.${asVersion}`, { tone: 'success' });
      } else {
        toast.show(`Saved. ${clone.cust}'s copy diverges on ${div.join(', ')}. The master is untouched.${asVersion}`, { tone: 'success' });
      }
      if (saved.definitionInvalidated) {
        toast.show(CLONE_HASH_INVALIDATION_MESSAGE, { tone: 'warning' });
      }
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as ApiQueryError | SerializedError, 'Could not save that clone.'), { tone: 'error' });
    }
  };

  if (isLoading && !clone) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Edit clone" mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (!isLoading && (!clone || error)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Edit clone" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message="This clone no longer exists." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={`Edit ${clone?.cust ?? ''}'s clone`} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
          {CLONE_EDIT_DESCRIPTION}
        </Text>

        <Card>
          <TextField label="Customer" value={clone?.cust ?? ''} editable={false} />
          <View style={{ height: 14 }} />
          <TextField label="Cloned from" value={`${clone?.parent ?? ''} · master v${master?.ver ?? '—'}`} editable={false} />
        </Card>

        <Card>
          <Controller
            control={control}
            name="model"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label="Model"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="e.g. gpt-4o"
                hint="Differs from the master? It will show as divergence."
                error={errors.model?.message}
              />
            )}
          />
          <View style={{ height: 14 }} />
          <Controller
            control={control}
            name="tools"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField label="Tools" value={value} onChangeText={onChange} onBlur={onBlur} placeholder="e.g. order-lookup, Drive, Slack" hint="Comma-separated." error={errors.tools?.message} />
            )}
          />
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
                placeholder="Describe what this customer's copy should do."
                multiline
                numberOfLines={6}
                style={{ minHeight: 120, textAlignVertical: 'top' }}
                error={errors.prompt?.message}
              />
            )}
          />
        </Card>

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
                placeholder="e.g. Customer asked for softer refund wording"
                hint="Recorded against this version of the customer's copy, so the history says why it diverged. Optional."
                error={errors.note?.message}
              />
            )}
          />
        </Card>

        <Button label="Save clone" onPress={handleSubmit(onSubmit)} loading={isSaving} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
});
