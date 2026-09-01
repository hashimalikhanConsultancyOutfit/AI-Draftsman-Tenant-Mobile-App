import { useCallback, useMemo, useState } from 'react';
import { Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Card, EmptyState, ErrorState, Icon, Loader } from '@/components/ui';
import { AGENT_PERMISSIONS, BILLING_PERMISSIONS, CUSTOMER_PERMISSIONS, KEY_PERMISSIONS, USAGE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { ApiError, NetworkError } from '@/services/httpClient';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatCompactNumber, formatDayLabel, formatMoney, formatMonthLabel, formatNumber, formatPercent } from '@/utils/format';

import type { DashboardStackParamList } from '@/navigation/types';
import { useGetCustomerStatsQuery, useGetDashboardQuery } from './dashboardApi';
import { currentPeriod, getTrailingPeriods } from './periods';
import { expandSpendByDay } from './spendByDay';
import { RunRow } from './components/RunRow';
import { StatTile } from './components/StatTile';

type Nav = NativeStackNavigationProp<DashboardStackParamList>;


interface QuickAction {
  label: string;
  icon: 'person-add-alt' | 'add-circle-outline' | 'vpn-key' | 'tune';
  permission: string;
  onPress: () => void;
}

export function DashboardScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [refreshing, setRefreshing] = useState(false);

  /* The month filter. Confirmed live against the web app on 2026-09-01 —
     see periods.ts for the range and the exact `period` query-param
     contract. Defaults to the current month; every stat, chart and table
     on this screen reads that period, and it rides along to each "See
     all" screen so they stay in sync with what's on screen here. */
  const [period, setPeriod] = useState(() => currentPeriod());
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const isCurrentPeriod = period === currentPeriod();
  const monthLabel = formatMonthLabel(period);
  const periodOptions = useMemo(() => getTrailingPeriods(), []);

  const canSeeMoney = usePermission(USAGE_PERMISSIONS.VIEW);
  const canCreateCustomer = usePermission(CUSTOMER_PERMISSIONS.CREATE);
  const canBuildAgent = usePermission(AGENT_PERMISSIONS.BUILD);
  const canCreateKey = usePermission(KEY_PERMISSIONS.CREATE);
  const canManageBilling = usePermission(BILLING_PERMISSIONS.MANAGE);

  const dashboardQuery = useGetDashboardQuery({ period });
  const statsQuery = useGetCustomerStatsQuery();

  /* One bar per calendar day of the period (up to today, for the current
     month) — the server sends only the days that saw spend, see
     `spendByDay.ts`. Matches the web app's own `expandSpendByDay` so the two
     surfaces draw the same chart from the same response. */
  const spendSeries = useMemo(
    () =>
      dashboardQuery.data
        ? expandSpendByDay(dashboardQuery.data.period, dashboardQuery.data.spendByDay)
        : { values: [], dates: [] },
    [dashboardQuery.data],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([dashboardQuery.refetch(), statsQuery.refetch()]);
    setRefreshing(false);
  }, [dashboardQuery, statsQuery]);

  const allQuickActions: QuickAction[] = [
    { label: 'Register customer', icon: 'person-add-alt', permission: CUSTOMER_PERMISSIONS.CREATE, onPress: () => goToDrawer(navigation, 'Customers') },
    { label: 'Create agent', icon: 'add-circle-outline', permission: AGENT_PERMISSIONS.BUILD, onPress: () => goToTab(navigation, 'CompanyAgentsTab') },
    { label: 'Issue API key', icon: 'vpn-key', permission: KEY_PERMISSIONS.CREATE, onPress: () => goToDrawer(navigation, 'ApiKeys') },
    { label: 'Edit limits', icon: 'tune', permission: BILLING_PERMISSIONS.MANAGE, onPress: () => goToTab(navigation, 'SettingsTab') },
  ];
  const quickActions = allQuickActions.filter((a) =>
    a.permission === CUSTOMER_PERMISSIONS.CREATE ? canCreateCustomer :
    a.permission === AGENT_PERMISSIONS.BUILD ? canBuildAgent :
    a.permission === KEY_PERMISSIONS.CREATE ? canCreateKey :
    canManageBilling,
  );

  const isFirstLoad = dashboardQuery.isLoading || statsQuery.isLoading;
  const error = dashboardQuery.error;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title="Dashboard"
        mode="tab"
        onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        onAvatarPress={() => goToTab(navigation, 'SettingsTab')}
      />

      {isFirstLoad ? (
        <Loader fullScreen label="Loading your dashboard…" />
      ) : error ? (
        <ErrorState
          message={errorMessage(error)}
          onRetry={() => {
            void dashboardQuery.refetch();
            void statsQuery.refetch();
          }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
        >
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
            Activity, spend and recent runs across every agent and customer.
          </Text>

          <TouchableOpacity
            onPress={() => setMonthPickerOpen(true)}
            style={[styles.monthPill, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.full }]}
            accessibilityRole="button"
            accessibilityLabel={`Month: ${monthLabel}. Tap to change.`}
          >
            <Icon name="event" size={15} color={theme.colors.accent} />
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
              {monthLabel}
            </Text>
            <Icon name="expand-more" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>

          {quickActions.length > 0 && (
            <View style={styles.actionsRow}>
              {quickActions.map((a) => (
                <TouchableOpacity
                  key={a.label}
                  onPress={a.onPress}
                  style={[styles.actionChip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                >
                  <Icon name={a.icon} size={16} color={theme.colors.accent} />
                  <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>
                    {a.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {statsQuery.data?.registered === 0 ? (
            <Card>
              <EmptyState
                icon="rocket-launch"
                title="Nothing running yet"
                description={
                  canCreateCustomer
                    ? 'Register your first customer to start attributing usage and spend.'
                    : 'Setting the first customer up needs a permission you do not hold. Ask an owner or an admin.'
                }
                actionLabel={canCreateCustomer ? 'Register a customer' : undefined}
                onAction={canCreateCustomer ? () => goToDrawer(navigation, 'Customers') : undefined}
              />
            </Card>
          ) : (
            <>
              <View style={styles.statsGrid}>
                <StatTile
                  label={isCurrentPeriod ? 'Spend this month' : `Spend in ${monthLabel}`}
                  value={canSeeMoney ? formatMoney(dashboardQuery.data?.summary.spend, dashboardQuery.data?.currency) : '—'}
                  caption={
                    !canSeeMoney
                      ? 'Needs the “View usage” permission'
                      /* The cap is a live, forward-looking budget — a
                         percentage of it only means something for the
                         month actually in progress. Matches the web app:
                         any other month just states the total. */
                      : !isCurrentPeriod
                        ? `Total metered spend for ${monthLabel}`
                        : dashboardQuery.data?.spendCap
                          ? `${Math.round(((dashboardQuery.data.summary.spend ?? 0) / dashboardQuery.data.spendCap) * 100)}% of the ${formatMoney(dashboardQuery.data.spendCap, dashboardQuery.data.currency)} cap`
                          : 'No spend cap set'
                  }
                  icon="payments"
                  progressPct={
                    canSeeMoney && isCurrentPeriod && dashboardQuery.data?.spendCap
                      ? ((dashboardQuery.data.summary.spend ?? 0) / dashboardQuery.data.spendCap) * 100
                      : undefined
                  }
                />
                <StatTile
                  label="Tokens"
                  value={formatCompactNumber(dashboardQuery.data?.summary.tokens)}
                  caption={isCurrentPeriod ? 'Month to date, all agents' : `${monthLabel}, all agents`}
                  icon="bolt"
                />
                <StatTile
                  label="Requests"
                  value={formatNumber(dashboardQuery.data?.summary.requests)}
                  caption={isCurrentPeriod ? 'Month to date, all keys' : `${monthLabel}, all keys`}
                  icon="swap-vert"
                />
                <StatTile
                  label="Active customers"
                  value={formatNumber(statsQuery.data?.active)}
                  caption={statsQuery.data?.nearOrAtQuota != null ? `${statsQuery.data.nearOrAtQuota} near quota` : 'Quota use unavailable'}
                  icon="apartment"
                  warning={Boolean(statsQuery.data?.nearOrAtQuota)}
                />
              </View>

              <SectionCard
                title="Spend by day"
                trailing={canSeeMoney ? formatMoney(dashboardQuery.data?.summary.spend, dashboardQuery.data?.currency) : undefined}
                onSeeAll={() => navigation.navigate('SpendByDay', { period })}
                empty={!canSeeMoney || spendSeries.values.length === 0}
                emptyLabel={canSeeMoney ? 'No spend yet' : 'Needs the “View usage” permission'}
              >
                {canSeeMoney && dashboardQuery.data && spendSeries.values.length > 0 && (
                  <MiniBarChart
                    values={spendSeries.values}
                    dates={spendSeries.dates}
                    currency={dashboardQuery.data.currency}
                  />
                )}
              </SectionCard>

              <SectionCard
                title="Top by spend"
                onSeeAll={() => navigation.navigate('TopBySpend', { period })}
                empty={!dashboardQuery.data?.topCustomersBySpend.length}
                emptyLabel="No customer spend yet"
              >
                {dashboardQuery.data?.topCustomersBySpend.slice(0, 5).map((c) => (
                  <View key={c.id} style={[styles.spendRow, { borderBottomColor: theme.colors.border }]}>
                    <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, flex: 1 }} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.xs, marginRight: 10 }}>
                      {formatPercent(c.quotaUsedPct)}
                    </Text>
                    <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.sm }}>
                      {canSeeMoney ? formatMoney(c.spend) : '—'}
                    </Text>
                  </View>
                ))}
              </SectionCard>

              <SectionCard
                title="Recent runs"
                trailing={
                  dashboardQuery.data
                    ? `${dashboardQuery.data.recentRuns.length} shown${isCurrentPeriod ? '' : ` · ${monthLabel}`}`
                    : undefined
                }
                onSeeAll={() => navigation.navigate('RecentRuns', { period })}
                empty={!dashboardQuery.data?.recentRuns.length}
                emptyLabel="No runs yet"
              >
                {dashboardQuery.data?.recentRuns.slice(0, 5).map((run) => (
                  <RunRow key={run.id} run={run} showCost={canSeeMoney} />
                ))}
              </SectionCard>
            </>
          )}
        </ScrollView>
      )}

      <Modal
        visible={monthPickerOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMonthPickerOpen(false)}
      >
        <TouchableOpacity
          style={[styles.sheetScrim, { backgroundColor: theme.colors.scrim }]}
          activeOpacity={1}
          onPress={() => setMonthPickerOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.sheetCard,
              { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 12, borderTopLeftRadius: theme.radii.sheetTop, borderTopRightRadius: theme.radii.sheetTop },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.sheetTitle, { color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold }]}>Month</Text>
            <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
              {periodOptions.map((p, index) => {
                const active = p === period;
                return (
                  <TouchableOpacity
                    key={p}
                    onPress={() => {
                      setPeriod(p);
                      setMonthPickerOpen(false);
                    }}
                    style={[
                      styles.sheetRow,
                      index < periodOptions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={formatMonthLabel(p)}
                  >
                    <Text
                      style={{
                        color: active ? theme.colors.accent : theme.colors.text,
                        fontFamily: active ? theme.fontFamilies.body.semibold : theme.fontFamilies.body.regular,
                        fontSize: theme.fontSizes.md,
                      }}
                    >
                      {formatMonthLabel(p)}
                    </Text>
                    {active && <Icon name="check" size={18} color={theme.colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function goToDrawer(navigation: Nav, route: string) {
  navigation.getParent()?.getParent()?.navigate(route as never);
}

function goToTab(navigation: Nav, route: string) {
  navigation.getParent()?.navigate(route as never);
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'status' in error) {
    const e = error as { status: number | string; messages?: string[]; data?: { messages?: string[] } };
    const messages = e.messages ?? e.data?.messages;
    if (messages?.[0]) return messages[0];
    if (e.status === 'NETWORK_ERROR') return new NetworkError().message;
  }
  if (error instanceof ApiError) return error.messages[0] ?? error.message;
  if (error instanceof NetworkError) return error.message;
  return 'The figures for this period did not come back. Nothing has changed — try again in a moment.';
}

function SectionCard({
  title,
  trailing,
  onSeeAll,
  empty,
  emptyLabel,
  children,
}: {
  title: string;
  trailing?: string;
  onSeeAll: () => void;
  empty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  const { theme } = useAppTheme();
  return (
    <Card>
      <View style={styles.sectionHeader}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>
          {title}
        </Text>
        <View style={styles.sectionHeaderRight}>
          {trailing && (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.sm }}>
              {trailing}
            </Text>
          )}
          {!empty && (
            <TouchableOpacity onPress={onSeeAll} accessibilityRole="button" accessibilityLabel={`See all — ${title}`}>
              <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>
                See all
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {empty ? (
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: 8 }}>
          {emptyLabel}
        </Text>
      ) : (
        children
      )}
    </Card>
  );
}

/**
 * One bar per calendar day of the period — a real bar graph, not a sparkline
 * standing in for one. Tap a bar to see its date and amount, since a phone has
 * no hover to reveal a tooltip on.
 */
function MiniBarChart({ values, dates, currency }: { values: number[]; dates: string[]; currency: string }) {
  const { theme } = useAppTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(...values, 0.01);
  const activeIndex = selected ?? values.length - 1;

  return (
    <View>
      <View style={styles.chartCallout}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.sm }}>
          {formatMoney(values[activeIndex], currency)}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
          {dates[activeIndex] ? formatDayLabel(dates[activeIndex]) : ''}
        </Text>
      </View>
      <View style={styles.chart} accessibilityRole="none" accessibilityLabel="Spend per day this period">
        {values.map((spend, i) => (
          <TouchableOpacity
            key={dates[i]}
            style={styles.chartCol}
            activeOpacity={0.7}
            onPress={() => setSelected(i)}
            accessibilityRole="button"
            accessibilityLabel={`${formatDayLabel(dates[i] ?? "")}: ${formatMoney(spend, currency)}`}
          >
            <View
              style={[
                styles.chartBar,
                {
                  height: Math.max(3, (spend / max) * 64),
                  backgroundColor: i === activeIndex ? theme.colors.accent : theme.colors.accent,
                  opacity: i === activeIndex ? 1 : 0.55,
                  borderRadius: theme.radii.sm,
                },
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.chartAxis}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
          {dates[0] ? formatDayLabel(dates[0] ?? '') : ''}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
          {dates[dates.length - 1] ? formatDayLabel(dates[dates.length - 1] ?? '') : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 72, marginTop: 8 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minWidth: 4 },
  chartBar: { width: '70%', minWidth: 2 },
  chartCallout: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 12 },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  sheetScrim: { flex: 1, justifyContent: 'flex-end' },
  sheetCard: { maxHeight: '70%', paddingTop: 10 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  sheetTitle: { fontSize: 17, paddingHorizontal: 20, marginBottom: 4 },
  sheetList: { paddingHorizontal: 20 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
});
