import { yupResolver } from '@hookform/resolvers/yup';
import type { SerializedError } from '@reduxjs/toolkit';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Loader, TextField, useToast } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { CustomersStackParamList } from '@/navigation/types';
import { CUSTOMER_MODAL_COPY, customerErrorFallback } from './customersRules';
import { useGetCustomerQuery, useSuspendCustomerMutation } from './customersApi';
import { suspendCustomerSchema, type SuspendCustomerFormValues } from './schemas/suspendCustomerSchema';

type Nav = NativeStackNavigationProp<CustomersStackParamList>;
type Rt = RouteProp<CustomersStackParamList, 'CustomerSuspend'>;

/** Suspend is a FORM dialog on web, not a bare confirm — the required
 * reason textarea needs a real text input, which `Alert.alert` can't give
 * cross-platform, so this gets its own modal screen (matching AddSkill/
 * AgentForm's convention) rather than folding into `Alert`. */
export function CustomerSuspendScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const { data: customer, isLoading, error } = useGetCustomerQuery(params.id);
  const [suspendCustomer, { isLoading: isSubmitting }] = useSuspendCustomerMutation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SuspendCustomerFormValues>({
    resolver: yupResolver(suspendCustomerSchema),
    defaultValues: { reason: '' },
  });

  const onSubmit = async (values: SuspendCustomerFormValues) => {
    if (!customer) return;
    try {
      await suspendCustomer({ id: customer.id, reason: values.reason.trim() }).unwrap();
      toast.show(`${customer.name} suspended. Their assistants stopped responding; your other customers are unaffected.`, { tone: 'success' });
      navigation.goBack();
    } catch (err) {
      toast.show(customerErrorFallback(err as SerializedError, 'suspend that customer'), { tone: 'error' });
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={CUSTOMER_MODAL_COPY.suspend.title} mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (error || !customer) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={CUSTOMER_MODAL_COPY.suspend.title} mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message="This customer no longer exists." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={CUSTOMER_MODAL_COPY.suspend.title} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.md }}>{customer.name}</Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
          {CUSTOMER_MODAL_COPY.suspend.description}
        </Text>

        <Card>
          <Controller
            control={control}
            name="reason"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label="Reason"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Non-payment — invoice 4821 overdue 60 days"
                multiline
                numberOfLines={3}
                style={{ minHeight: 80, textAlignVertical: 'top' }}
                error={errors.reason?.message}
              />
            )}
          />
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 6 }}>
            Recorded against the customer and the audit trail. Required.
          </Text>
        </Card>

        <Button label={CUSTOMER_MODAL_COPY.suspend.submitLabel} variant="danger" onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
});
