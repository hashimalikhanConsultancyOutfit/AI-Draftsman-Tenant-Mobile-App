import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Loader, TextField, useToast } from '@/components/ui';
import { StatTile } from '@/features/dashboard/components/StatTile';
import { useGetCustomerStatsQuery } from '@/features/dashboard/dashboardApi';
import { useDebouncedValue } from '@/features/marketplace/useDebouncedValue';
import { BILLING_PERMISSIONS, CUSTOMER_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { CustomersStackParamList } from '@/navigation/types';
import { CustomerCard } from './components/CustomerCard';
import {
  CUSTOMERS_DESCRIPTION,
  CUSTOMERS_EMPTY_DESCRIPTION,
  CUSTOMERS_PAGE_SIZE,
  NO_PERMISSION_MESSAGE,
  REGISTRY_PANEL_TITLE,
  SEARCH_DEBOUNCE_MS,
  SEARCH_EMPTY_DESCRIPTION,
  SEARCH_EMPTY_TITLE,
  SEARCH_PLACEHOLDER,
  buildCustomerRows,
  toCustomerStats,
} from './customersRules';
import { useGetCustomersQuery } from './customersApi';
import type { Customer } from './customers.types';

type Nav = NativeStackNavigationProp<CustomersStackParamList>;

export function CustomersScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const canView = usePermission(CUSTOMER_PERMISSIONS.VIEW);
  const canCreate = usePermission(CUSTOMER_PERMISSIONS.CREATE);
  const canImport = usePermission(CUSTOMER_PERMISSIONS.IMPORT);
  const canViewBilling = usePermission(BILLING_PERMISSIONS.VIEW);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const isFiltered = Boolean(debouncedSearch);

  const [page, setPage] = useState(1);
  // A growing list, not a numbered pager — see CustomerAgentsScreen/
  // ConnectorCatalogueSection for the same established mobile pattern.
  const [loadedRows, setLoadedRows] = useState<Customer[]>([]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading, isFetching, error, refetch } = useGetCustomersQuery(
    { page, limit: CUSTOMERS_PAGE_SIZE, q: debouncedSearch || undefined },
    { skip: !canView },
  );
  const statsQuery = useGetCustomerStatsQuery(undefined, { skip: !canView });

  useEffect(() => {
    if (!data) return;
    setLoadedRows((prev) => {
      if (data.page <= 1) return data.items;
      const seen = new Set(prev.map((c) => c.id));
      return [...prev, ...data.items.filter((c) => !seen.has(c.id))];
    });
  }, [data]);

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, data?.totalPages ?? 1);
  const isEmpty = !isLoading && !error && !isFiltered && total === 0;

  // Only the 4 fields the stat tiles actually render — `active`/
  // `suspended` exist on `CustomerStats` for parity with web's type but
  // neither has a tile here either (matching web's own CustomerStats
  // component, which renders the same 4).
  const stats = statsQuery.data
    ? toCustomerStats(statsQuery.data)
    : { registered: isFiltered ? null : total, nearOrAtQuota: null, attributedSpend: null, clonesAssigned: null as number | null };

  const rows = buildCustomerRows(loadedRows);

  const handleRefresh = () => {
    setPage(1);
    void refetch();
    void statsQuery.refetch();
  };

  const handleLoadMore = () => {
    if (isFetching || page >= pageCount) return;
    setPage((p) => p + 1);
  };

  const handleRegister = () => {
    if (!canCreate) {
      toast.show(NO_PERMISSION_MESSAGE.register, { tone: 'warning' });
      return;
    }
    navigation.navigate('CustomerForm', {});
  };

  const handleImport = () => {
    if (!canImport) {
      toast.show(NO_PERMISSION_MESSAGE.import, { tone: 'warning' });
      return;
    }
    navigation.navigate('CustomerImport');
  };

  if (!canView) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader
          title="Customers"
          mode="tab"
          onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)}
        />
        <View style={{ padding: 16 }}>
          <EmptyState icon="lock" title="You cannot view customers" description="Viewing this workspace's customer registry needs the &quot;View customers&quot; permission. Ask an owner or an admin to grant it." />
        </View>
      </View>
    );
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
        {isEmpty ? CUSTOMERS_EMPTY_DESCRIPTION : CUSTOMERS_DESCRIPTION}
      </Text>

      {(canCreate || canImport) && (
        <View style={styles.actionRow}>
          {canCreate && (
            <View style={{ flex: 1 }}>
              <Button label="Register" icon="person-add-alt" onPress={handleRegister} fullWidth />
            </View>
          )}
          {canImport && (
            <View style={{ flex: 1 }}>
              <Button label="Import CSV" icon="upload-file" variant="outline" onPress={handleImport} fullWidth />
            </View>
          )}
        </View>
      )}

      {!isEmpty && !error && (
        <View style={styles.statsGrid}>
          <StatTile label="Registered" value={stats.registered === null ? '—' : String(stats.registered)} icon="business" />
          <StatTile
            label="Near or at quota"
            value={stats.nearOrAtQuota === null ? '—' : String(stats.nearOrAtQuota)}
            icon="speed"
            caption={stats.nearOrAtQuota !== null && stats.nearOrAtQuota > 0 ? 'review' : undefined}
            warning={stats.nearOrAtQuota !== null && stats.nearOrAtQuota > 0}
          />
          {canViewBilling && (
            <StatTile
              label="Attributed spend"
              value={stats.attributedSpend === null ? '—' : `£${stats.attributedSpend.toFixed(2)}`}
              icon="payments"
            />
          )}
          <StatTile label="Clones assigned" value={stats.clonesAssigned === null ? '—' : String(stats.clonesAssigned)} icon="content-copy" />
        </View>
      )}

      <View style={styles.searchRow}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
          {REGISTRY_PANEL_TITLE}
          {!isLoading && !error ? ` (${total})` : ''}
        </Text>
      </View>
      <TextField placeholder={SEARCH_PLACEHOLDER} leftIcon="search" value={search} onChangeText={setSearch} autoCapitalize="none" />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title="Customers"
        mode="tab"
        onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)}
      />

      <FlatList
        data={rows}
        keyExtractor={(c) => c.id}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={listHeader}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={handleRefresh} tintColor={theme.colors.accent} />}
        renderItem={({ item }) => (
          <CustomerCard customer={item} canViewBilling={canViewBilling} onPress={() => navigation.navigate('CustomerDetail', { id: item.id })} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          isLoading ? (
            <Loader />
          ) : error ? (
            <ErrorState title="Could not load your customers" message={getErrorMessage(error, 'Something went wrong.')} onRetry={refetch} />
          ) : isFiltered ? (
            <EmptyState icon="search-off" title={SEARCH_EMPTY_TITLE} description={SEARCH_EMPTY_DESCRIPTION} />
          ) : (
            <EmptyState
              icon="business"
              title="No customers registered"
              description="Register one and their usage attributes automatically. Four ways in, all equal — the API, MCP, a CSV import, or an invite link."
              actionLabel={canCreate ? 'Register' : canImport ? 'Import CSV' : undefined}
              onAction={canCreate ? handleRegister : canImport ? handleImport : undefined}
            />
          )
        }
        ListFooterComponent={
          !isLoading && !error && rows.length > 0 && page < pageCount ? (
            <View style={styles.pager}>
              <Button label="Load more" variant="outline" loading={isFetching} onPress={handleLoadMore} fullWidth />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  headerBlock: { gap: 12, marginBottom: 4 },
  actionRow: { flexDirection: 'row', gap: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  pager: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 8 },
});
