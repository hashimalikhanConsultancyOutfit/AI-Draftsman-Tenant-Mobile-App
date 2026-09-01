import type { SerializedError } from '@reduxjs/toolkit';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Icon, Loader, useToast, type IconName } from '@/components/ui';
import { BILLING_PERMISSIONS, CUSTOMER_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatMoney } from '@/utils/format';

import type { CustomersStackParamList } from '@/navigation/types';
import {
  DELETE_TOOLTIP,
  EDIT_TOOLTIP,
  ISOLATION_NOTE,
  NO_DELETE_TOOLTIP,
  NO_RESUME_TOOLTIP,
  NO_SUSPEND_TOOLTIP,
  NO_UPDATE_TOOLTIP,
  RESUME_TOOLTIP,
  SUSPEND_TOOLTIP,
  buildDeleteWarning,
  buildDetailRows,
  buildResumeMessage,
  customerErrorFallback,
} from './customersRules';
import { useDeleteCustomerMutation, useGetCustomerQuery, useResumeCustomerMutation } from './customersApi';

type Nav = NativeStackNavigationProp<CustomersStackParamList>;
type Rt = RouteProp<CustomersStackParamList, 'CustomerDetail'>;

const FIELD_ICONS: Record<string, IconName> = {
  externalId: 'tag',
  email: 'mail-outline',
  state: 'info-outline',
  quota: 'speed',
  agents: 'smart-toy',
  portal: 'lock-open',
  suspendReason: 'report-problem',
  price: 'payments',
  spend: 'payments',
};

/**
 * Customer detail — a push screen, ported from web's `CustomerDetailModal`
 * (a dialog there; this app's established convention turns a web detail
 * dialog into a push screen, see ConnectorDetailScreen/AgentDetailScreen).
 * Every write action for this customer lives here, not on the list card.
 *
 * NOT wired: web's "Plan & credits" footer link, which opens a separate
 * `CustomerPlan` feature (`/customers/:id/plan`, its own billing-gated
 * screen — allowance meter, plan picker, subscribe/unsubscribe). That
 * feature doesn't exist in this app yet and needs its own research/port
 * pass — flagged to the user rather than stubbed here with a dead link.
 */
export function CustomerDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const canUpdate = usePermission(CUSTOMER_PERMISSIONS.UPDATE);
  const canSuspend = usePermission(CUSTOMER_PERMISSIONS.SUSPEND);
  const canResume = usePermission(CUSTOMER_PERMISSIONS.RESUME);
  const canDelete = usePermission(CUSTOMER_PERMISSIONS.DELETE);
  const canViewBilling = usePermission(BILLING_PERMISSIONS.VIEW);

  const { data: customer, isLoading, isFetching, error, refetch } = useGetCustomerQuery(params.id);
  const [resumeCustomer, { isLoading: isResuming }] = useResumeCustomerMutation();
  const [deleteCustomer, { isLoading: isDeleting }] = useDeleteCustomerMutation();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Customer" mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (error || !customer) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Customer" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message={error ? 'Could not load this customer.' : 'This customer no longer exists — it may have been archived from another device.'} onRetry={error ? refetch : undefined} />
      </View>
    );
  }

  const rows = buildDetailRows(customer, canViewBilling);
  const isSuspended = customer.state === 'suspended';

  const handleEdit = () => {
    if (!canUpdate) {
      toast.show(NO_UPDATE_TOOLTIP, { tone: 'warning' });
      return;
    }
    navigation.navigate('CustomerForm', { id: customer.id });
  };

  const handleSuspend = () => {
    if (!canSuspend) {
      toast.show(NO_SUSPEND_TOOLTIP, { tone: 'warning' });
      return;
    }
    navigation.navigate('CustomerSuspend', { id: customer.id });
  };

  const handleResume = () => {
    if (!canResume) {
      toast.show(NO_RESUME_TOOLTIP, { tone: 'warning' });
      return;
    }
    Alert.alert('Resume customer?', buildResumeMessage(customer.name), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resume',
        onPress: async () => {
          try {
            await resumeCustomer(customer.id).unwrap();
            toast.show(`${customer.name} resumed.`, { tone: 'success' });
          } catch (err) {
            toast.show(customerErrorFallback(err as SerializedError, 'resume that customer'), { tone: 'error' });
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    if (!canDelete) {
      toast.show(NO_DELETE_TOOLTIP, { tone: 'warning' });
      return;
    }
    Alert.alert('Delete customer?', buildDeleteWarning(customer.name, customer.agents), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCustomer(customer.id).unwrap();
            toast.show(`${customer.name} archived and removed from the registry. Ledger history was left intact.`, { tone: 'success' });
            navigation.goBack();
          } catch (err) {
            toast.show(customerErrorFallback(err as SerializedError, 'delete that customer'), { tone: 'error' });
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={customer.name} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        {isFetching && (
          <View style={[styles.refreshBar, { backgroundColor: theme.colors.accent + '33' }]}>
            <View style={[styles.refreshBarFill, { backgroundColor: theme.colors.accent }]} />
          </View>
        )}

        <Card elevated padded={false} style={{ borderRadius: theme.radii.xl, overflow: 'hidden' }}>
          {rows.map((row, index) => {
            const isMoney = row.moneyAmount !== undefined;
            return (
              <View key={row.id} style={styles.field}>
                <View style={[styles.fieldIconWrap, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
                  <Icon name={FIELD_ICONS[row.id] ?? 'info-outline'} size={15} color={theme.colors.accent} />
                </View>
                <View
                  style={[
                    styles.fieldContent,
                    index < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
                  ]}
                >
                  <Text style={[styles.fieldLabel, { color: theme.colors.textMuted }]}>{row.label.toUpperCase()}</Text>
                  {isMoney ? (
                    <View style={styles.moneyRow}>
                      <Text style={[styles.fieldValue, { color: theme.colors.text }]}>{formatMoney(row.moneyAmount, 'GBP')}</Text>
                      {row.suffix && (
                        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{row.suffix}</Text>
                      )}
                    </View>
                  ) : (
                    <Text style={[styles.fieldValue, { color: theme.colors.text }]}>{row.value}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </Card>

        <View style={[styles.notice, { backgroundColor: theme.colors.statusInfoBg, borderRadius: theme.radii.md }]}>
          <Icon name="info-outline" size={14} color={theme.colors.statusInfoFg} />
          <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17, flex: 1 }}>
            <Text style={{ fontFamily: theme.fontFamilies.body.semibold }}>Isolation. </Text>
            {ISOLATION_NOTE}
          </Text>
        </View>

        <View style={styles.actions}>
          {canUpdate && <Button label="Edit" icon="edit" variant="outline" size="sm" onPress={handleEdit} accessibilityLabel={EDIT_TOOLTIP} />}
          {isSuspended
            ? canResume && <Button label="Resume" icon="play-circle-outline" variant="outline" size="sm" loading={isResuming} onPress={handleResume} accessibilityLabel={RESUME_TOOLTIP} />
            : canSuspend && <Button label="Suspend" icon="pause-circle-outline" variant="outline" size="sm" onPress={handleSuspend} accessibilityLabel={SUSPEND_TOOLTIP} />}
          {canDelete && <Button label="Delete" icon="delete-outline" variant="outline" size="sm" loading={isDeleting} onPress={handleDelete} accessibilityLabel={DELETE_TOOLTIP} />}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  refreshBar: { height: 2, borderRadius: 1, overflow: 'hidden' },
  refreshBarFill: { width: '40%', height: '100%' },
  field: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, gap: 12 },
  fieldIconWrap: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  fieldContent: { flex: 1, paddingVertical: 14 },
  fieldLabel: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 10.5, letterSpacing: 0.6, marginBottom: 3 },
  fieldValue: { fontFamily: 'InstrumentSans_500Medium', fontSize: 14.5, lineHeight: 20 },
  moneyRow: { gap: 2 },
  notice: { flexDirection: 'row', gap: 8, padding: 10, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
