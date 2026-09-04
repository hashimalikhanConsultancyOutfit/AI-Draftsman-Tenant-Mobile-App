/**
 * Set / change the selling rate — the one write on this surface. Ported
 * from web's `RATE_DIALOG_COPY` + its single `FormModal` field
 * (`OrganizationSettings.tsx`/`.data.ts`, confirmed against that source
 * 2026-09-04): one money field, prefilled with the current rate in
 * pounds, empty (not zero) when no rate has ever been set — a blank field
 * asks the question rather than suggesting an answer.
 */

import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { OrganizationSettingsStackParamList } from '@/navigation/types';
import { useGetOrganizationPricingQuery, useSetCreditRateMutation } from './organizationSettingsApi';
import { RATE_FORM_COPY, RATE_SAVE_ERROR_FALLBACK, SAVED_TOAST, toPence, toPounds } from './organizationSettingsRules';
import { creditRateFormSchema, type CreditRateFormValues } from './schemas/creditRateFormSchema';

type Nav = NativeStackNavigationProp<OrganizationSettingsStackParamList>;

export function CreditRateFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const { data, isSuccess } = useGetOrganizationPricingQuery();
  const [setCreditRate, { isLoading: isSubmitting }] = useSetCreditRateMutation();
  const sellPence = data?.creditRate.sellPencePerCredit ?? null;
  const hasRate = sellPence !== null;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreditRateFormValues>({
    resolver: yupResolver(creditRateFormSchema) as never,
    defaultValues: { sellPerCredit: '' },
  });

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated || !isSuccess) return;
    reset({ sellPerCredit: sellPence === null ? '' : String(toPounds(sellPence)) });
    setHydrated(true);
  }, [hydrated, isSuccess, reset, sellPence]);

  const onSubmit = async (values: CreditRateFormValues) => {
    try {
      await setCreditRate({ sellPencePerCredit: toPence(Number(values.sellPerCredit)) }).unwrap();
      toast.show(SAVED_TOAST, { tone: 'success' });
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as never, RATE_SAVE_ERROR_FALLBACK), { tone: 'error' });
    }
  };

  const title = hasRate ? RATE_FORM_COPY.editTitle : RATE_FORM_COPY.createTitle;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={title} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{RATE_FORM_COPY.description}</Text>

        <Card style={styles.section}>
          <Controller
            control={control}
            name="sellPerCredit"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField label={RATE_FORM_COPY.fieldLabel} value={value} onChangeText={onChange} onBlur={onBlur} keyboardType="decimal-pad" placeholder="1.50" hint={RATE_FORM_COPY.fieldHint} error={errors.sellPerCredit?.message} />
            )}
          />
        </Card>

        <Button label={RATE_FORM_COPY.submitLabel} onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { gap: 14 },
});
