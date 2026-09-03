import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Loader, PickerField, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { LeadsStackParamList } from '@/navigation/types';
import { useCreateLeadMutation, useGetLeadQuery, useUpdateLeadMutation } from './leadsApi';
import { LEAD_MODAL_COPY, SOURCE_OPTIONS, STAGE_OPTIONS, UNASSIGNED_OWNER, buildLeadSavedMessage, parseScoreField } from './leadsRules';
import { leadFormSchema, type LeadFormValues } from './schemas/leadFormSchema';

type Nav = NativeStackNavigationProp<LeadsStackParamList>;
type Rt = RouteProp<LeadsStackParamList, 'LeadForm'>;

/** Create + Edit — one shared screen, mirrors `CustomerFormScreen`'s
 * convention (`params.id` present = edit). Ported from web's
 * `LEAD_CREATE_FIELDS`/`LEAD_EDIT_FIELDS`. Attachments are handled from
 * the detail screen once the lead exists, not from this form — matching
 * the create flow's own two-step nature on web (the lead must exist
 * before a file can be attached to it). */
export function LeadFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();
  const isEdit = Boolean(params?.id);
  const copy = isEdit ? LEAD_MODAL_COPY.edit : LEAD_MODAL_COPY.create;

  const { data: editingLead, isLoading: isLoadingLead, error: loadError } = useGetLeadQuery(params?.id ?? '', { skip: !isEdit });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<LeadFormValues>({
    resolver: yupResolver(leadFormSchema),
    defaultValues: { name: '', src: '', description: '', stage: 'New', owner: UNASSIGNED_OWNER, score: '', why: '' },
  });

  const scoreValue = watch('score');

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated || !isEdit || !editingLead) return;
    reset({
      name: editingLead.name,
      src: editingLead.src,
      description: editingLead.description,
      stage: editingLead.stage,
      owner: editingLead.owner || UNASSIGNED_OWNER,
      score: editingLead.score === null ? '' : String(editingLead.score),
      why: editingLead.why,
    });
    setHydrated(true);
  }, [editingLead, hydrated, isEdit, reset]);

  const [createLead, { isLoading: isCreating }] = useCreateLeadMutation();
  const [updateLead, { isLoading: isUpdating }] = useUpdateLeadMutation();
  const isSubmitting = isCreating || isUpdating;

  const onSubmit = async (values: LeadFormValues) => {
    const owner = values.owner === UNASSIGNED_OWNER ? '' : values.owner;
    const score = parseScoreField(values.score);
    try {
      if (isEdit && editingLead) {
        await updateLead({
          id: editingLead.id,
          name: values.name.trim(),
          src: values.src,
          description: values.description.trim(),
          stage: values.stage,
          owner,
          score,
          why: score === null ? '' : values.why.trim(),
        }).unwrap();
      } else {
        await createLead({
          name: values.name.trim(),
          src: values.src,
          description: values.description.trim() || undefined,
          stage: values.stage,
          owner: owner || undefined,
          ...(score !== null ? { score, why: values.why.trim() } : {}),
        }).unwrap();
      }
      toast.show(buildLeadSavedMessage(values.name.trim(), isEdit ? 'edit' : 'create'), { tone: 'success' });
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as never, `Could not ${isEdit ? 'save' : 'add'} that lead.`), { tone: 'error' });
    }
  };

  if (isEdit && isLoadingLead) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (isEdit && (loadError || !editingLead)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message="This lead no longer exists." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{copy.description}</Text>

        <Card style={{ gap: 14 }}>
          <Controller control={control} name="name" render={({ field: { value, onChange, onBlur } }) => (
            <TextField label="Title" value={value} onChangeText={onChange} onBlur={onBlur} placeholder="Acme Corp — new office fit-out" error={errors.name?.message} />
          )} />

          <Controller control={control} name="src" render={({ field: { value, onChange } }) => (
            <PickerField label="Source" value={value} options={SOURCE_OPTIONS} onChange={onChange} placeholder="Pick a source" hint="The strongest single input to the scoring agent." error={errors.src?.message} />
          )} />

          <Controller control={control} name="description" render={({ field: { value, onChange, onBlur } }) => (
            <TextField label="Description" value={value} onChangeText={onChange} onBlur={onBlur} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' }} placeholder="What they asked for, what was said, what happens next." hint="Not read by the scoring agent — it works from the source and the stage." />
          )} />

          <Controller control={control} name="stage" render={({ field: { value, onChange } }) => (
            <PickerField label="Stage" value={value} options={STAGE_OPTIONS} onChange={(v) => onChange(v as LeadFormValues['stage'])} />
          )} />

          <Controller control={control} name="owner" render={({ field: { value, onChange } }) => (
            <PickerField label="Owner" value={value} options={[{ label: 'Unassigned', value: UNASSIGNED_OWNER }]} onChange={onChange} hint="Who is working it. Can be left with nobody." />
          )} />
        </Card>

        <Card style={{ gap: 14 }}>
          <Controller control={control} name="score" render={({ field: { value, onChange, onBlur } }) => (
            <TextField label="Score" value={value} onChangeText={onChange} onBlur={onBlur} keyboardType="number-pad" placeholder="0-100" hint={isEdit ? 'Leave empty to put the lead back to unscored.' : 'Leave empty to let the scoring agent set it.'} error={errors.score?.message} />
          )} />
          {scoreValue.trim() !== '' && (
            <Controller control={control} name="why" render={({ field: { value, onChange, onBlur } }) => (
              <TextField label="Reason" value={value} onChangeText={onChange} onBlur={onBlur} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' }} placeholder="Say how you reached that number." error={errors.why?.message} />
            )} />
          )}
        </Card>

        <Button label={copy.submitLabel} onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
});
