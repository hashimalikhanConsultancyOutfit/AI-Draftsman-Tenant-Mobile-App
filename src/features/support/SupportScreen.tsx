/**
 * Support inbox. Ported from web's `Support.tsx` (confirmed against
 * that source 2026-09-04): four summary tiles, a state-filter pill row,
 * a debounced server-side search (customer/subject/owner only — the
 * route's own limit), and a growing paged list — the same "Load more"
 * pattern `CustomersScreen` already established for a server-paginated
 * list, rather than web's numbered `TablePager` (page size still 10,
 * matching the server default).
 *
 * No websocket — realtime here is polling, same as web: 30s on the
 * inbox, achieved with RTK Query's `pollingInterval` rather than a
 * manual timer.
 */
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Loader, StatusTabs, TextField } from '@/components/ui';
import { useDebouncedValue } from '@/features/marketplace/useDebouncedValue';
import { SUPPORT_PERMISSIONS } from '@/permissions/slugs';
import { useHasFullAccess, usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { SupportStackParamList } from '@/navigation/types';
import { SummaryTiles } from './components/SummaryTiles';
import { TicketCard } from './components/TicketCard';
import { useGetSupportSummaryQuery, useGetSupportTicketsQuery } from './supportApi';
import { STATE_FILTER_OPTIONS } from './supportRules';
import type { SupportTicket, SupportTicketState } from './support.types';

type Nav = NativeStackNavigationProp<SupportStackParamList>;

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 350;
const INBOX_POLL_MS = 30_000;

export function SupportScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const canView = usePermission(SUPPORT_PERMISSIONS.VIEW);
  const canCreate = usePermission(SUPPORT_PERMISSIONS.CREATE);
  const hasFullAccess = useHasFullAccess();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [stateFilter, setStateFilter] = useState<SupportTicketState | 'ALL'>('ALL');

  const [page, setPage] = useState(1);
  const [loadedRows, setLoadedRows] = useState<SupportTicket[]>([]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, stateFilter]);

  const { data, isLoading, isFetching, error, refetch } = useGetSupportTicketsQuery(
    { page, limit: PAGE_SIZE, search: debouncedSearch || undefined, state: stateFilter === 'ALL' ? undefined : stateFilter },
    { skip: !canView, pollingInterval: INBOX_POLL_MS },
  );
  const summaryQuery = useGetSupportSummaryQuery(undefined, { skip: !canView, pollingInterval: INBOX_POLL_MS });

  useEffect(() => {
    if (!data) return;
    setLoadedRows((prev) => {
      if (data.page <= 1) return data.items;
      const seen = new Set(prev.map((t) => t.id));
      return [...prev, ...data.items.filter((t) => !seen.has(t.id))];
    });
  }, [data]);

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, data?.totalPages ?? 1);
  const isFiltered = Boolean(debouncedSearch) || stateFilter !== 'ALL';

  const handleRefresh = () => {
    setPage(1);
    void refetch();
    void summaryQuery.refetch();
  };

  const handleLoadMore = () => {
    if (isFetching || page >= pageCount) return;
    setPage((p) => p + 1);
  };

  if (!canView) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Support" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />
        <View style={{ padding: 16 }}>
          <EmptyState icon="lock" title="You cannot view support" description={'Viewing tickets needs the "View support tickets" permission. Ask an owner or an admin to grant it.'} />
        </View>
      </View>
    );
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
        Tickets your customers raised, and anything you have handed to the platform team.
      </Text>

      {summaryQuery.data ? <SummaryTiles summary={summaryQuery.data} /> : summaryQuery.isLoading ? <Loader /> : null}

      <View style={styles.actionRow}>
        {hasFullAccess ? <Button label="SLA policy" size="sm" variant="outline" icon="schedule" onPress={() => navigation.navigate('SlaPolicy')} /> : null}
        {canCreate ? <Button label="Raise ticket" size="sm" icon="add" onPress={() => navigation.navigate('RaiseTicket')} /> : null}
      </View>

      <TextField placeholder="Search by customer, subject or owner" leftIcon="search" value={search} onChangeText={setSearch} autoCapitalize="none" />
      <StatusTabs tabs={STATE_FILTER_OPTIONS} value={stateFilter} onChange={(v) => setStateFilter(v as SupportTicketState | 'ALL')} />

      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
        {!isLoading && !error ? `${total} ticket${total === 1 ? '' : 's'}` : 'Tickets'}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Support" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />

      <FlatList
        data={loadedRows}
        keyExtractor={(t) => t.id}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={listHeader}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={handleRefresh} tintColor={theme.colors.accent} />}
        renderItem={({ item }) => <TicketCard ticket={item} onPress={() => navigation.navigate('TicketDetail', { id: item.id })} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          isLoading ? (
            <Loader />
          ) : error ? (
            <ErrorState title="Could not load your tickets" message={getErrorMessage(error, 'Something went wrong.')} onRetry={refetch} />
          ) : isFiltered ? (
            <EmptyState icon="search-off" title="No tickets match" description="Try a different search term, or clear the filters to see the whole inbox." />
          ) : (
            <EmptyState
              icon="support-agent"
              title="No tickets"
              description={canCreate ? 'Raise one and it appears here immediately.' : 'Nothing has been raised yet.'}
              actionLabel={canCreate ? 'Raise ticket' : undefined}
              onAction={canCreate ? () => navigation.navigate('RaiseTicket') : undefined}
            />
          )
        }
        ListFooterComponent={
          !isLoading && !error && loadedRows.length > 0 && page < pageCount ? (
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
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pager: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 8 },
});
