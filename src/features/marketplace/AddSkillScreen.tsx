import { yupResolver } from '@hookform/resolvers/yup';
import type { SerializedError } from '@reduxjs/toolkit';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, Loader, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import type { ApiQueryError } from '@/store/baseQuery';
import { useAppDispatch } from '@/store/hooks';
import { entryCloned } from '@/store/marketplaceClonesSlice';
import { useAppTheme } from '@/theme/ThemeContext';

import type { MarketplaceStackParamList } from '@/navigation/types';
import { CREATE_SKILL_COPY } from './marketplaceRules';
import { useCloneSkillMutation, useCreateSkillMutation, useGetSkillCategoriesQuery } from './marketplaceApi';
import { addSkillFormSchema, type AddSkillFormValues } from './schemas/addSkillFormSchema';
import type { ClonedEntryRecord } from './marketplace.types';

type Nav = NativeStackNavigationProp<MarketplaceStackParamList>;

function FieldError({ message }: { message?: string }) {
  const { theme } = useAppTheme();
  if (!message) return null;
  return (
    <Text style={{ color: theme.colors.error, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 6 }}>{message}</Text>
  );
}

/**
 * "Add skill" — the two-call publish-then-clone dance, ported from web's
 * `AddSkillModal`/`useOwnedSkills` exactly: `POST /skill-marketplace`
 * (writes the PLATFORM-WIDE catalogue — there is no tenant-scoped create
 * endpoint) followed by an immediate `POST /skill-marketplace/:id/clone`
 * so the new listing also lands under this workspace's My skills. The two
 * calls can fail independently and get distinct copy for each — see
 * `CREATE_SKILL_COPY`.
 */
export function AddSkillScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const dispatch = useAppDispatch();

  const { data: categories, isLoading: isLoadingCategories } = useGetSkillCategoriesQuery();
  const [createSkill, { isLoading: isPublishing }] = useCreateSkillMutation();
  const [cloneSkill, { isLoading: isCloning }] = useCloneSkillMutation();
  const isSubmitting = isPublishing || isCloning;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AddSkillFormValues>({
    resolver: yupResolver(addSkillFormSchema),
    defaultValues: { skillCategoryId: '', name: '', description: '', prompt: '' },
  });

  const onSubmit = async (values: AddSkillFormValues) => {
    let published;
    try {
      published = await createSkill({
        skillCategoryId: values.skillCategoryId,
        name: values.name.trim(),
        description: values.description.trim(),
        prompt: values.prompt.trim(),
      }).unwrap();
    } catch (err) {
      toast.show(getErrorMessage(err as ApiQueryError | SerializedError, CREATE_SKILL_COPY.publishFailed), { tone: 'error' });
      return;
    }

    try {
      const cloned = await cloneSkill(published.id).unwrap();
      const record: ClonedEntryRecord = { cloneId: cloned.id, name: published.name, savedAt: cloned.createdAt, origin: 'authored' };
      dispatch(entryCloned({ resource: 'skill', catalogueId: published.id, clone: record }));
      toast.show(CREATE_SKILL_COPY.success(published.name), { tone: 'success' });
      navigation.goBack();
    } catch {
      // Published successfully; only the clone-into-workspace half failed.
      // Distinct, actionable copy — never re-publish to recover from this.
      toast.show(CREATE_SKILL_COPY.cloneFailed(published.name), { tone: 'error' });
      navigation.goBack();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={CREATE_SKILL_COPY.title} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
          {CREATE_SKILL_COPY.description}
        </Text>

        <Card>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm, marginBottom: 8 }}>Category</Text>
          {isLoadingCategories ? (
            <Loader />
          ) : (
            <Controller
              control={control}
              name="skillCategoryId"
              render={({ field: { value, onChange } }) => (
                <View style={styles.pillWrap}>
                  {(categories ?? []).map((cat) => {
                    const selected = cat.id === value;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => onChange(cat.id)}
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
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            />
          )}
          <FieldError message={errors.skillCategoryId?.message} />
        </Card>

        <Card>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField label="Skill name" value={value} onChangeText={onChange} onBlur={onBlur} placeholder="e.g. Meeting notes summariser" maxLength={150} error={errors.name?.message} />
            )}
          />
        </Card>

        <Card>
          <Controller
            control={control}
            name="description"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label="Description"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="What does this skill do, and when should an agent use it?"
                multiline
                numberOfLines={4}
                maxLength={1000}
                style={{ minHeight: 90, textAlignVertical: 'top' }}
                error={errors.description?.message}
              />
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
                placeholder="Write the instructions this skill contributes to an agent's prompt."
                multiline
                numberOfLines={8}
                style={{ minHeight: 160, textAlignVertical: 'top' }}
                error={errors.prompt?.message}
              />
            )}
          />
        </Card>

        <Button label={CREATE_SKILL_COPY.submitLabel} onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth style={{ marginTop: 8 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 13, paddingVertical: 7 },
});
