/**
 * Create + Edit key policy — one shared screen, ported field-for-field from
 * web's `POLICY_FIELDS` (`ApiKeys.data.ts`, confirmed against that source
 * and `CreateKeyPolicyDto`/`UpdateKeyPolicyDto` on 2026-09-03). This is
 * where every limit lives — scope, spend cap, rate limits, IP allow-list,
 * training — shared by every key attached to the policy.
 *
 * `allowedAgentIds` / `allowedModelIds` are read-only elsewhere in this
 * module (`PolicyViewScreen` lists them) but have no editor here, matching
 * web: `POLICY_FIELDS` itself has no field for either — they can only be
 * set by a call this portal's UI does not expose on either platform, so
 * this is parity, not a gap introduced by the port.
 *
 * `ipAllowlist` round-trips as comma-separated text; see the module spec
 * for why its client-side validation is a lighter IPv4-only shape check
 * than the server's real CIDR parser.
 */

import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Loader, PickerField, Switch, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { ApiKeysStackParamList } from '@/navigation/types';
import { useCreateKeyPolicyMutation, useGetKeyPolicyQuery, useUpdateKeyPolicyMutation } from './apiKeysApi';
import { CADENCE_OPTIONS, POLICY_FORM_DEFAULTS, POLICY_MODAL_COPY, SCOPE_OPTIONS, parseIpAllowlist } from './apiKeysRules';
import { keyPolicyFormSchema, type KeyPolicyFormValues } from './schemas/keyPolicyFormSchema';

type Nav = NativeStackNavigationProp<ApiKeysStackParamList>;
type Rt = RouteProp<ApiKeysStackParamList, 'PolicyForm'>;

function SectionHeading({ children }: { children: string }) {
  const { theme } = useAppTheme();
  return <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md, marginBottom: 4 }}>{children}</Text>;
}

export function PolicyFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();
  const isEdit = Boolean(params?.id);
  const copy = isEdit ? POLICY_MODAL_COPY.edit : POLICY_MODAL_COPY.create;

  const { data: editingPolicy, isLoading: isLoadingPolicy, error: loadError } = useGetKeyPolicyQuery(params?.id ?? '', { skip: !isEdit });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<KeyPolicyFormValues>({
    resolver: yupResolver(keyPolicyFormSchema) as never,
    defaultValues: POLICY_FORM_DEFAULTS,
  });

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated || !isEdit || !editingPolicy) return;
    reset({
      name: editingPolicy.name,
      scopeType: editingPolicy.scopeType,
      budget: String(editingPolicy.budgetMinor / 100),
      budgetResetCadence: editingPolicy.budgetResetCadence,
      requestsPerMinute: String(editingPolicy.requestsPerMinute),
      tokensPerMinute: String(editingPolicy.tokensPerMinute),
      ipAllowlist: editingPolicy.ipAllowlist.join(', '),
      allowTraining: editingPolicy.allowTraining,
      isDefault: editingPolicy.isDefault,
    });
    setHydrated(true);
  }, [editingPolicy, hydrated, isEdit, reset]);

  const [createKeyPolicy, { isLoading: isCreating }] = useCreateKeyPolicyMutation();
  const [updateKeyPolicy, { isLoading: isUpdating }] = useUpdateKeyPolicyMutation();
  const isSubmitting = isCreating || isUpdating;

  const onSubmit = async (values: KeyPolicyFormValues) => {
    const name = values.name.trim();
    const body = {
      name,
      scopeType: values.scopeType,
      budgetMinor: Math.round(Number(values.budget) * 100),
      budgetResetCadence: values.budgetResetCadence,
      requestsPerMinute: Number(values.requestsPerMinute),
      tokensPerMinute: Number(values.tokensPerMinute),
      ipAllowlist: parseIpAllowlist(values.ipAllowlist ?? ''),
      allowTraining: values.allowTraining,
      isDefault: values.isDefault,
    } as const;
    try {
      if (isEdit && editingPolicy) {
        await updateKeyPolicy({ id: editingPolicy.id, ...body }).unwrap();
        toast.show(`${name} saved.`, { tone: 'success' });
      } else {
        await createKeyPolicy(body).unwrap();
        toast.show(`${name} created.`, { tone: 'success' });
      }
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as never, `Could not ${isEdit ? 'save' : 'create'} that policy.`), { tone: 'error' });
    }
  };

  if (isEdit && isLoadingPolicy) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (isEdit && (loadError || !editingPolicy)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message="This policy no longer exists." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{copy.description}</Text>

        <Card style={styles.section}>
          <SectionHeading>Policy</SectionHeading>
          <Controller control={control} name="name" render={({ field: { value, onChange, onBlur } }) => <TextField label="Policy name" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.name?.message} />} />
          <Controller control={control} name="scopeType" render={({ field: { value, onChange } }) => <PickerField label="Scope" value={value} options={SCOPE_OPTIONS} onChange={onChange} />} />
        </Card>

        <Card style={styles.section}>
          <SectionHeading>Spend + rate limits</SectionHeading>
          <Controller
            control={control}
            name="budget"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField label="Spend cap (£)" value={value} onChangeText={onChange} onBlur={onBlur} keyboardType="decimal-pad" hint="Keys on this policy stop serving once they reach it." error={errors.budget?.message} />
            )}
          />
          <Controller control={control} name="budgetResetCadence" render={({ field: { value, onChange } }) => <PickerField label="Cap resets" value={value} options={CADENCE_OPTIONS} onChange={onChange} />} />
          <Controller
            control={control}
            name="requestsPerMinute"
            render={({ field: { value, onChange, onBlur } }) => <TextField label="Requests per minute" value={value} onChangeText={onChange} onBlur={onBlur} keyboardType="number-pad" error={errors.requestsPerMinute?.message} />}
          />
          <Controller
            control={control}
            name="tokensPerMinute"
            render={({ field: { value, onChange, onBlur } }) => <TextField label="Tokens per minute" value={value} onChangeText={onChange} onBlur={onBlur} keyboardType="number-pad" error={errors.tokensPerMinute?.message} />}
          />
        </Card>

        <Card style={styles.section}>
          <SectionHeading>Access</SectionHeading>
          <Controller
            control={control}
            name="ipAllowlist"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label="IP allow-list (optional)"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                placeholder="203.0.113.0/24, 198.51.100.0/24"
                hint="Comma-separated CIDR ranges. Leave empty to allow any address."
                error={errors.ipAllowlist?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="allowTraining"
            render={({ field: { value, onChange } }) => (
              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>Allow traffic to be used for training</Text>
                  <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }}>
                    Off by default. Turning it on lets prompts and completions through keys on this policy contribute to model improvement.
                  </Text>
                </View>
                <Switch value={value} onValueChange={onChange} />
              </View>
            )}
          />
          <Controller
            control={control}
            name="isDefault"
            render={({ field: { value, onChange } }) => (
              <View style={styles.switchRow}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm, flex: 1 }}>Use as the default policy for new keys</Text>
                <Switch value={value} onValueChange={onChange} />
              </View>
            )}
          />
        </Card>

        <Button label={copy.submitLabel} onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { gap: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  switchLabel: { flex: 1 },
});
