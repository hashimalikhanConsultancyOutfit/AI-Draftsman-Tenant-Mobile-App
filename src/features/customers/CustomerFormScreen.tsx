import { yupResolver } from '@hookform/resolvers/yup';
import type { SerializedError } from '@reduxjs/toolkit';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Loader, Switch, TextField, useToast } from '@/components/ui';

import type { CustomersStackParamList } from '@/navigation/types';
import {
  CUSTOMER_MODAL_COPY,
  DEFAULT_REGISTRATION_ROUTE,
  customerErrorFallback,
  registrationRouteLabel,
} from './customersRules';
import { useCreateCustomerMutation, useGetCustomerQuery, useUpdateCustomerMutation } from './customersApi';
import { customerFormSchema, type CustomerFormValues } from './schemas/customerFormSchema';
import { useAppTheme } from '@/theme/ThemeContext';

type Nav = NativeStackNavigationProp<CustomersStackParamList>;
type Rt = RouteProp<CustomersStackParamList, 'CustomerForm'>;

function FieldLabel({ children, hint }: { children: string; hint?: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{children}</Text>
      {hint && <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }}>{hint}</Text>}
    </View>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11, letterSpacing: 0.4 }}>{label.toUpperCase()}</Text>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, marginTop: 4 }}>{value}</Text>
    </View>
  );
}

function SwitchRow({ label, hint, value, onValueChange }: { label: string; hint?: string; value: boolean; onValueChange: (v: boolean) => void }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>{label}</Text>
        {hint && <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 2 }}>{hint}</Text>}
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

/**
 * Register + Edit customer — one shared form screen, mirrors
 * `AgentFormScreen`'s convention (`params.id` present = edit). Ported from
 * web's Register/Edit `FormModal`s (Customers.data.ts's REGISTER_FIELDS/
 * EDIT_FIELDS + CUSTOMER_MODAL_COPY).
 */
export function CustomerFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();
  const isEdit = Boolean(params?.id);
  const copy = isEdit ? CUSTOMER_MODAL_COPY.edit : CUSTOMER_MODAL_COPY.register;

  const { data: editingCustomer, isLoading: isLoadingCustomer, error: loadError } = useGetCustomerQuery(params?.id ?? '', { skip: !isEdit });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: yupResolver(customerFormSchema),
    defaultValues: { name: '', email: '', quotaMonthly: '', showQuotaToCustomer: false, portal: false },
  });

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated || !isEdit || !editingCustomer) return;
    reset({
      name: editingCustomer.name,
      email: editingCustomer.email ?? '',
      quotaMonthly: editingCustomer.quotaMonthly !== null ? String(editingCustomer.quotaMonthly) : '',
      showQuotaToCustomer: editingCustomer.showQuotaToCustomer,
      portal: editingCustomer.portalAccessEnabled,
    });
    setHydrated(true);
  }, [editingCustomer, hydrated, isEdit, reset]);

  const [createCustomer, { isLoading: isCreating }] = useCreateCustomerMutation();
  const [updateCustomer, { isLoading: isUpdating }] = useUpdateCustomerMutation();
  const isSubmitting = isCreating || isUpdating;

  const onSubmit = async (values: CustomerFormValues) => {
    const quotaMonthly = values.quotaMonthly ? Number(values.quotaMonthly) : null;
    try {
      if (isEdit && editingCustomer) {
        await updateCustomer({
          id: editingCustomer.id,
          name: values.name.trim(),
          email: values.email.trim(),
          quotaMonthly,
          showQuotaToCustomer: values.showQuotaToCustomer === true,
          portalAccessEnabled: values.portal === true,
        }).unwrap();
        toast.show(`${values.name.trim()} updated.`, { tone: 'success' });
      } else {
        const created = await createCustomer({
          name: values.name.trim(),
          email: values.email.trim(),
          quotaMonthly,
          showQuotaToCustomer: values.showQuotaToCustomer === true,
          portalAccessEnabled: values.portal === true,
        }).unwrap();
        toast.show(
          created.externalId
            ? `${created.name} registered. Usage will attribute to ${created.externalId} automatically.`
            : `${created.name} registered. Give them an external ID before metering starts, or usage cannot be attributed.`,
          { tone: 'success' },
        );
      }
      navigation.goBack();
    } catch (err) {
      toast.show(customerErrorFallback(err as SerializedError, isEdit ? 'save that customer' : 'register that customer'), { tone: 'error' });
    }
  };

  if (isEdit && isLoadingCustomer && !editingCustomer) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (isEdit && loadError && !editingCustomer) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message="This customer no longer exists." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={isEdit && editingCustomer ? `Edit ${editingCustomer.name}` : copy.title} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
          {copy.description}
        </Text>

        <Card>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField label="Customer name" value={value} onChangeText={onChange} onBlur={onBlur} placeholder="e.g. Barrow Foods Ltd" error={errors.name?.message} />
            )}
          />
        </Card>

        {isEdit && editingCustomer && (
          <Card>
            <ReadonlyField label="External ID" value={editingCustomer.externalId || '—'} />
          </Card>
        )}

        <Card>
          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label="Billing email"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Where their invoices and quota warnings go."
                autoCapitalize="none"
                keyboardType="email-address"
                error={errors.email?.message}
              />
            )}
          />
        </Card>

        <Card>
          <Controller
            control={control}
            name="quotaMonthly"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label={isEdit ? 'Monthly quota (tokens)' : 'Credits'}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="100000"
                keyboardType="number-pad"
                error={errors.quotaMonthly?.message}
              />
            )}
          />
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 6 }}>
            {isEdit
              ? 'A token allowance, not money. Blank leaves it unchanged.'
              : 'A monthly credit allowance, not money. Leave blank for the default of 100,000; 0 blocks them.'}
          </Text>
        </Card>

        {!isEdit && (
          <Card>
            <ReadonlyField label="Registered via" value={registrationRouteLabel(DEFAULT_REGISTRATION_ROUTE)} />
          </Card>
        )}

        <Card style={{ gap: 4 }}>
          <FieldLabel>Access</FieldLabel>
          <Controller
            control={control}
            name="showQuotaToCustomer"
            render={({ field: { value, onChange } }) => (
              <SwitchRow label="Let them see their own quota" value={value ?? false} onValueChange={onChange} />
            )}
          />
          <Controller
            control={control}
            name="portal"
            render={({ field: { value, onChange } }) => (
              <SwitchRow
                label="Give them white-label portal access"
                hint={isEdit ? "Turning this off doesn't delete existing portal-user accounts — the switch and the accounts are independent." : undefined}
                value={value ?? false}
                onValueChange={onChange}
              />
            )}
          />
        </Card>

        <Button label={copy.submitLabel} onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth style={{ marginTop: 4 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
});
