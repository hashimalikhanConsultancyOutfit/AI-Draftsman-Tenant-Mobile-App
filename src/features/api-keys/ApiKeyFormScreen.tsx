/**
 * Create + Edit API key — one shared screen, ported field-for-field from
 * web's `buildKeyFields` / `buildEditFields` (`ApiKeys.data.ts`, confirmed
 * against that source 2026-09-03). Deliberately two fields only: name and
 * policy. The spend cap, rate limits and IP rules all live on the POLICY,
 * never on the key — see `apiKeysRules.ts`'s header note.
 *
 * No environment picker: every key issued from here is forced LIVE
 * (`ISSUED_ENVIRONMENT`), same as web — a key that costs money should be a
 * deliberate act stated in the modal copy, not a dropdown with one choice.
 * No secret field, ever, even in edit — replacing one is `rotateApiKey`.
 *
 * On successful CREATE only, the response's one-time secret is held in
 * local state and shown via `SecretRevealModal` before this screen closes
 * — `navigation.goBack()` happens on the modal's dismiss, not on submit.
 */

import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Loader, PickerField, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { ApiKeysStackParamList } from '@/navigation/types';
import { SecretRevealModal, type RevealedSecret } from './components/SecretRevealModal';
import { useCreateApiKeyMutation, useGetApiKeyQuery, useGetKeyPoliciesQuery, useUpdateApiKeyMutation } from './apiKeysApi';
import { ISSUED_ENVIRONMENT, KEY_MODAL_COPY } from './apiKeysRules';
import { apiKeyFormSchema, type ApiKeyFormValues } from './schemas/apiKeyFormSchema';

type Nav = NativeStackNavigationProp<ApiKeysStackParamList>;
type Rt = RouteProp<ApiKeysStackParamList, 'ApiKeyForm'>;

export function ApiKeyFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();
  const isEdit = Boolean(params?.id);
  const copy = isEdit ? KEY_MODAL_COPY.edit : KEY_MODAL_COPY.create;

  const { data: editingKey, isLoading: isLoadingKey, error: loadError } = useGetApiKeyQuery(params?.id ?? '', { skip: !isEdit });
  /** Unfiltered — the same reasoning as web: this screen's own picker must
   * never be narrowed by whatever search/status filter is active on the
   * registry behind it. */
  const { data: policies } = useGetKeyPoliciesQuery();

  const policyOptions = useMemo(() => (policies ?? []).map((p) => ({ label: `${p.name}${p.isDefault ? ' (default)' : ''}`, value: p.id })), [policies]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ApiKeyFormValues>({
    resolver: yupResolver(apiKeyFormSchema) as never,
    defaultValues: { name: '', policyId: '' },
  });

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated) return;
    if (isEdit) {
      if (!editingKey) return;
      reset({ name: editingKey.name, policyId: editingKey.policyId });
      setHydrated(true);
    } else {
      if (!policies) return;
      const defaultId = policies.find((p) => p.isDefault)?.id ?? policies[0]?.id ?? '';
      reset({ name: '', policyId: defaultId });
      setHydrated(true);
    }
  }, [editingKey, hydrated, isEdit, policies, reset]);

  const [createApiKey, { isLoading: isCreating }] = useCreateApiKeyMutation();
  const [updateApiKey, { isLoading: isUpdating }] = useUpdateApiKeyMutation();
  const isSubmitting = isCreating || isUpdating;
  const [revealedSecret, setRevealedSecret] = useState<RevealedSecret | null>(null);

  const onSubmit = async (values: ApiKeyFormValues) => {
    const name = values.name.trim();
    try {
      if (isEdit && editingKey) {
        await updateApiKey({ id: editingKey.id, name, policyId: values.policyId }).unwrap();
        toast.show(`${name} saved.`, { tone: 'success' });
        navigation.goBack();
      } else {
        const result = await createApiKey({ name, environment: ISSUED_ENVIRONMENT, policyId: values.policyId }).unwrap();
        setRevealedSecret({ keyName: name, secret: result.key });
      }
    } catch (err) {
      toast.show(getErrorMessage(err as never, `Could not ${isEdit ? 'save' : 'create'} that key.`), { tone: 'error' });
    }
  };

  if (isEdit && isLoadingKey) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (isEdit && (loadError || !editingKey)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message="This key no longer exists." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{copy.description}</Text>

        <Card style={styles.section}>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField label="Key name" value={value} onChangeText={onChange} onBlur={onBlur} placeholder="Production backend" hint="What is calling us — a service, a portal, a scheduled job." error={errors.name?.message} />
            )}
          />
          <Controller
            control={control}
            name="policyId"
            render={({ field: { value, onChange } }) => (
              <PickerField
                label="Policy"
                value={value}
                options={policyOptions}
                onChange={onChange}
                hint={
                  isEdit
                    ? 'Takes effect on the next request.'
                    : 'Spend cap, rate limits and IP rules all come from the policy — and this key is live, so they are the only thing standing between it and a real bill.'
                }
                error={errors.policyId?.message}
              />
            )}
          />
        </Card>

        <Button label={copy.submitLabel} onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth />
      </ScrollView>

      <SecretRevealModal
        secret={revealedSecret}
        onDismiss={() => {
          setRevealedSecret(null);
          navigation.goBack();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { gap: 14 },
});
