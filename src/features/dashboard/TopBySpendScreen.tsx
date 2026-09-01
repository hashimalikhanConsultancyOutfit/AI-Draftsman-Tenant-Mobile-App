import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { EmptyState, ErrorState, Loader } from '@/components/ui';
import { usePermission } from '@/permissions/usePermission';
import { USAGE_PERMISSIONS } from '@/permissions/slugs';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatMoney, formatPercent } from '@/utils/format';

import type { DashboardStackParamList } from '@/navigation/types';
import type { TopCustomerBySpend } from './dashboard.types';
import { useGetDashboardQuery } from './dashboardApi';

type Rt = RouteProp<DashboardStackParamList, 'TopBySpend'>;

export function TopBySpendScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { params } = useRoute<Rt>();
  const canSeeMoney = usePermission(USAGE_PERMISSIONS.VIEW);
  const { data, isLoading, error, refetch } = useGetDashboardQuery({ period: params.period });

  const renderItem = ({ item }: { item: TopCustomerBySpend }) => (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: theme.colors.border }]}
      onPress={() => goToCustomer(navigation, item.id)}
      accessibilityRole="button"
    >
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, flex: 1 }} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.xs, marginRight: 12 }}>
        {formatPercent(item.quotaUsedPct)}
      </Text>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.sm }}>
        {canSeeMoney ? formatMoney(item.spend) : '—'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Top by spend" mode="stack" onBack={() => navigation.goBack()} />
      {isLoading ? (
        <Loader fullScreen />
      ) : error ? (
        <ErrorState message="Could not load top customers by spend." onRetry={refetch} />
      ) : !data?.topCustomersBySpend.length ? (
        <EmptyState icon="apartment" title="No customer spend yet" description="Customers appear here once their agents start serving traffic." />
      ) : (
        <FlatList
          data={data.topCustomersBySpend}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        />
      )}
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-navigator jump, see AppDrawer's `id="RootDrawer"` note
function goToCustomer(navigation: any, _customerId: string) {
  // Customer detail lands with the Customers module — placeholder for now.
  navigation.getParent()?.getParent()?.navigate('Customers' as never);
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
