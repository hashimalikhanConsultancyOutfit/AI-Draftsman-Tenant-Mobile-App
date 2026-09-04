/**
 * Usage & spend. Ported from web's `UsageSpend.tsx`/`useUsageSpend.tsx`
 * (both read in full, confirmed against that source 2026-09-04): six
 * stat tiles, a dimension tab strip, and a card list re-flowing web's
 * `UsageTable`. No period picker — web itself has none; both platforms
 * only ever read the current month.
 *
 * `usage.view` gates the whole screen (the placeholder this replaces
 * already declared that gate). `usage.export` gates the Export action
 * alone, shown disabled-with-a-caption rather than hidden when absent —
 * mirroring web's own disabled-button-plus-tooltip choice, made for the
 * same reason web states: Export is the only action on this page, so an
 * absent button would read as a missing feature rather than a
 * permission somebody could actually ask for.
 */
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Loader, StatusTabs } from '@/components/ui';
import { StatTile } from '@/features/dashboard/components/StatTile';
import { USAGE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatMoney } from '@/utils/format';

import { ExportSheet } from './components/ExportSheet';
import { UsageRowCard } from './components/UsageRowCard';
import { useGetUsageQuery } from './usageSpendApi';
import { monthElapsedFraction, NO_EXPORT_CAPTION, PAGE_DESCRIPTION, projectMonthEnd, USAGE_TABS } from './usageSpendRules';
import type { UsageDimension } from './usageSpend.types';

export function UsageSpendScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const canView = usePermission(USAGE_PERMISSIONS.VIEW);
  const canExport = usePermission(USAGE_PERMISSIONS.EXPORT);

  const [tab, setTab] = useState<UsageDimension>('model');
  const [exportOpen, setExportOpen] = useState(false);

  const { data: usage, isLoading, isFetching, error, refetch } = useGetUsageQuery({ dimension: tab }, { skip: !canView });

  const activeTab = USAGE_TABS.find((item) => item.value === tab);
  const rows = usage?.rows ?? [];

  const monthToDate = usage?.totals.cost ?? 0;
  const projected = useMemo(() => projectMonthEnd(monthToDate, monthElapsedFraction()), [monthToDate]);

  if (!canView) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Usage & spend" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />
        <View style={{ padding: 16 }}>
          <EmptyState icon="lock" title="You cannot view usage" description={'Viewing usage and spend needs the "View usage" permission. Ask an owner or an admin to grant it.'} />
        </View>
      </View>
    );
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.titleRow}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20, flex: 1 }}>{PAGE_DESCRIPTION}</Text>
      </View>

      <View style={{ gap: 6 }}>
        <Button label="Export" size="sm" variant="outline" icon="file-download" disabled={!canExport} onPress={() => setExportOpen(true)} style={{ alignSelf: 'flex-start' }} />
        {!canExport ? <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{NO_EXPORT_CAPTION}</Text> : null}
      </View>

      <View style={styles.statsGrid}>
        <StatTile label="Month to date" value={formatMoney(monthToDate)} icon="bolt" caption="Across every customer" />
        <StatTile label="Projected" value={formatMoney(projected)} icon="trending-up" caption="Straight-line to month end" warning />
        <StatTile label="Cached savings" value={formatMoney(usage?.totals.cachedSavings ?? 0)} icon="savings" caption="Not charged, thanks to cache hits" />
        <StatTile label="Charged to your customers" value={formatMoney(usage?.totals.sell ?? 0)} icon="storefront" caption="What you billed onward this period" />
        <StatTile label="Your margin" value={formatMoney(usage?.totals.margin ?? 0)} icon="payments" caption="Kept after what the platform charged you" />
        <StatTile label="Unbilled failures" value={String(usage?.totals.unbilledFailures ?? 0)} icon="error-outline" caption="Failed runs — you were charged £0.00 for these" />
      </View>

      <StatusTabs tabs={USAGE_TABS} value={tab} onChange={(v) => setTab(v as UsageDimension)} />

      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
        {activeTab?.label ?? 'Usage'}
        {!isLoading && !error ? ` (${rows.length})` : ''}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Usage & spend" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={listHeader}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
        renderItem={({ item }) => <UsageRowCard row={item} dimensionLabel={activeTab?.dimension ?? 'Dimension'} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          isLoading ? (
            <Loader />
          ) : error ? (
            <ErrorState title="Could not load usage" message={getErrorMessage(error, 'Something went wrong.')} onRetry={refetch} />
          ) : (
            <EmptyState icon="bar-chart" title="Nothing to report" description="No usage recorded for this breakdown yet." />
          )
        }
      />

      <ExportSheet visible={exportOpen} onClose={() => setExportOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  headerBlock: { gap: 12, marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
