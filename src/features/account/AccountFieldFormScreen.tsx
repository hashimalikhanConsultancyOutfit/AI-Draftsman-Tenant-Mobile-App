/**
 * Edit one of Full name / Username / Job title. Ported from web's
 * `ACCOUNT_EDIT_CONFIG`-driven `FormModal` (confirmed against
 * `useMySettings.tsx`'s `handleSubmitEdit` 2026-09-04): one field, seeded
 * from the loaded account, one `PATCH` sending exactly that field. An
 * emptied clearable field is sent as `null` — an empty string would store
 * an empty value rather than clearing it; `fullName` isn't clearable, so
 * its own required rule refuses a blank before this runs.
 */

import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { SettingsStackParamList } from '@/navigation/types';
import { useGetAccountQuery, useUpdateAccountMutation } from './accountApi';
import { ACCOUNT_EDIT_CONFIG } from './accountRules';
import { buildAccountFieldSchema, type AccountFieldFormValues } from './schemas/accountFieldSchema';
import type { AccountEditableField, UpdateAccountRequest } from './account.types';

type Nav = NativeStackNavigationProp<SettingsStackParamList>;
type Route = RouteProp<SettingsStackParamList, 'AccountFieldForm'>;

export function AccountFieldFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const field: AccountEditableField = params.field;
  const config = ACCOUNT_EDIT_CONFIG[field];
  const toast = useToast();

  const { data: account, isSuccess } = useGetAccountQuery();
  const [updateAccount, { isLoading: isSubmitting }] = useUpdateAccountMutation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AccountFieldFormValues>({
    resolver: yupResolver(buildAccountFieldSchema(field)) as never,
    defaultValues: { value: '' },
  });

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated || !isSuccess || !account) return;
    reset({ value: account[field] ?? '' });
    setHydrated(true);
  }, [hydrated, isSuccess, account, field, reset]);

  const onSubmit = async (values: AccountFieldFormValues) => {
    const trimmed = values.value.trim();
    const body: UpdateAccountRequest = config.clearable ? { [field]: trimmed === '' ? null : trimmed } : { [field]: trimmed };
    try {
      await updateAccount(body).unwrap();
      toast.show(config.successMessage, { tone: 'success' });
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as never, config.errorMessage), { tone: 'error' });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={config.title} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{config.description}</Text>

        <Controller
          control={control}
          name="value"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label={config.label}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={config.placeholder}
              hint={config.hint}
              error={errors.value?.message}
              maxLength={config.maxLength}
              autoCapitalize={field === 'username' ? 'none' : 'words'}
              autoCorrect={field !== 'username'}
            />
          )}
        />

        <Button label={config.submitLabel} onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
});
