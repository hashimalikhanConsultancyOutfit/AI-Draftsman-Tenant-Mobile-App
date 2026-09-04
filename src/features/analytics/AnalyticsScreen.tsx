/**
 * Analytics — where consumption went over a 7/30/90-day window. Ported
 * from web's `AnalyticsPanel` (confirmed against that source and
 * `GET /auth/my-settings/analytics` 2026-09-04).
 *
 * ── REACHABLE BY ANYONE; THE MONEY INSIDE IS GATED, NOT THE SCREEN ────────
 * Same rule as `UsageCreditsScreen` and `AccountScreen`: web's
 * `MySettings.data.ts` lists this tab in the ungated "account" group, and
 * there's no server-side permission guard on the route either. The
 * placeholder this replaces got this wrong (it gated the whole screen on
 * `usage.view`) — the fix is to gate only the money/usage figures via
 * `usePermission(USAGE_PERMISSIONS.VIEW)`, exactly as `UsageCreditsScreen`
 * already does, not the screen itself.
 *
 * ── THE DAILY CHART IS REUSED, NOT FORKED ──────────────────────────────────
 * `daily` here is structurally identical to `usage-credits`'s
 * `DailyUsagePoint` (`{date, costCents, tokens, requests}`, both
 * zero-filled server-side the same way) and web's own chart for this tab
 * is likewise a single cost-only series — so this screen imports
 * `CreditsBarChart` directly from the Usage & Credits feature rather than
 * duplicating an identical ~55-line component. `StatTile`/`StatusTabs`
 * are already reused this same way across every reporting-style module.
 *
 * ── DURATIONS IS A TABLE, NOT A CHART, AND ONLY WHEN THERE'S DATA ─────────
 * Only the API-key meter records a per-request latency — chat turns and
 * computer sessions have none and are skipped, not bucketed as "unknown".
 * The whole section is omitted when nothing was ever measured
 * (`durationsMeasuredRequests === 0`), matching web exactly — never an
 * empty-state card for it.
 */

import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, EmptyState, ErrorState, Loader, StatusTabs } from '@/components/ui';
import { StatTile } from '@/features/dashboard/components/StatTile';
import { CreditsBarChart } from '@/features/usageCredits/components/CreditsBarChart';
import { USAGE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme, type AppTheme } from '@/theme/ThemeContext';
import { formatMoneyCents, formatNumber, formatRelativeTime } from '@/utils/format';

import { AnalyticsExportSheet } from './components/AnalyticsExportSheet';
import { useGetAnalyticsQuery } from './analyticsApi';
import {
  AVG_PER_ACTIVE_DAY_CAPTION,
  DEFAULT_GROUP_BY,
  DEFAULT_WINDOW,
  DURATIONS_TITLE,
  durationsCoverageCaption,
  GROUP_BY_TABS,
  NO_ACTIVITY_NOTE,
  NO_BREAKDOWN_MESSAGE,
  NO_BREAKDOWN_TITLE,
  NO_DAILY_MESSAGE,
  NO_DAILY_TITLE,
  PAGE_DESCRIPTION,
  UTC_NOTE,
  WINDOW_TABS,
} from './analyticsRules';
import type { AnalyticsGroupBy, AnalyticsWindow, DurationBucket, UsageBreakdownSlice } from './analytics.types';

const NEEDS_PERMISSION_CAPTION = 'Needs the “View usage” permission';

export function AnalyticsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const canViewSpend = usePermission(USAGE_PERMISSIONS.VIEW);

  const [window, setWindow] = useState<AnalyticsWindow>(DEFAULT_WINDOW);
  const [groupBy, setGroupBy] = useState<AnalyticsGroupBy>(DEFAULT_GROUP_BY);
  const [exportVisible, setExportVisible] = useState(false);
  const { data, isLoading, isFetching, isError, error, refetch } = useGetAnalyticsQuery(window);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Analytics" mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen label="Loading analytics…" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Analytics" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message={getErrorMessage(error as never, 'Could not load analytics.')} onRetry={refetch} />
      </View>
    );
  }

  const breakdown: UsageBreakdownSlice[] = groupBy === 'model' ? data.byModel : groupBy === 'agent' ? data.byAgent : data.byCustomer;
  const hasDurations = data.durationsMeasuredRequests > 0;
  const partialDurations = hasDurations && data.durationsMeasuredRequests < data.totalRequests;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Analytics" mode="stack" onBack={() => navigation.goBack()} />
      <AnalyticsExportSheet visible={exportVisible} onClose={() => setExportVisible(false)} groupBy={groupBy} rows={breakdown} />
      <FlatList
        data={breakdown}
        keyExtractor={(row, i) => `${row.key}-${i}`}
        renderItem={({ item, index }) => <BreakdownRow theme={theme} row={item} canViewSpend={canViewSpend} currency="GBP" last={index === breakdown.length - 1} />}
        ListEmptyComponent={<EmptyState icon="bar-chart" title={NO_BREAKDOWN_TITLE} description={NO_BREAKDOWN_MESSAGE} />}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
        contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{PAGE_DESCRIPTION}</Text>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>
              {UTC_NOTE} {data.lastEventAt ? `Last activity ${formatRelativeTime(data.lastEventAt)}.` : NO_ACTIVITY_NOTE}
            </Text>

            <StatusTabs tabs={WINDOW_TABS.map((t) => ({ label: t.label, value: String(t.value) }))} value={String(window)} onChange={(v) => setWindow(Number(v) as AnalyticsWindow)} />

            <View style={styles.statsGrid}>
              <StatTile label="Total credits" value={canViewSpend ? formatMoneyCents(data.totalCostCents, 'GBP') : '—'} caption={canViewSpend ? `${formatNumber(data.totalRequests)} requests` : NEEDS_PERMISSION_CAPTION} icon="payments" />
              <StatTile label="Active days" value={String(data.activeDays)} caption={`Of ${data.days} in the window`} icon="calendar-today" />
              <StatTile label="Avg credits / active day" value={canViewSpend ? formatMoneyCents(data.averageCostPerActiveDayCents, 'GBP') : '—'} caption={canViewSpend ? AVG_PER_ACTIVE_DAY_CAPTION : NEEDS_PERMISSION_CAPTION} icon="trending-up" />
            </View>

            <View style={styles.groupByRow}>
              <View style={{ flex: 1 }}>
                <StatusTabs tabs={GROUP_BY_TABS.map((t) => ({ label: t.label, value: t.value }))} value={groupBy} onChange={(v) => setGroupBy(v as AnalyticsGroupBy)} />
              </View>
              <Button label="Export" size="sm" variant="outline" icon="file-download" onPress={() => setExportVisible(true)} />
            </View>

            <Card style={styles.section}>{data.daily.length === 0 ? <EmptyState icon="bar-chart" title={NO_DAILY_TITLE} description={NO_DAILY_MESSAGE} /> : <CreditsBarChart points={data.daily} currency="GBP" />}</Card>

            <SectionTitle theme={theme} title={`${GROUP_BY_TABS.find((t) => t.value === groupBy)?.label ?? ''} breakdown`} />
          </View>
        }
        ListFooterComponent={
          hasDurations ? (
            <View style={styles.footer}>
              <SectionTitle theme={theme} title={DURATIONS_TITLE} />
              <Card style={styles.section}>
                {data.durations.map((bucket, i) => (
                  <DurationRow key={bucket.label} theme={theme} bucket={bucket} last={i === data.durations.length - 1} />
                ))}
              </Card>
              {partialDurations && (
                <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, lineHeight: 16 }}>{durationsCoverageCaption(data.durationsMeasuredRequests, data.totalRequests)}</Text>
              )}
            </View>
          ) : null
        }
      />
    </View>
  );
}

function SectionTitle({ theme, title }: { theme: AppTheme; title: string }) {
  return <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 }}>{title}</Text>;
}

function BreakdownRow({ theme, row, canViewSpend, currency, last }: { theme: AppTheme; row: UsageBreakdownSlice; canViewSpend: boolean; currency: string; last: boolean }) {
  return (
    <Card style={[styles.rowCard, !last && { marginBottom: 8 }]}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }} numberOfLines={1}>
            {row.key}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12, marginTop: 1 }}>
            {formatNumber(row.requests)} requests · {formatNumber(row.tokens)} tokens
          </Text>
        </View>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.sm }}>{canViewSpend ? formatMoneyCents(row.costCents, currency) : '—'}</Text>
      </View>
    </Card>
  );
}

function DurationRow({ theme, bucket, last }: { theme: AppTheme; bucket: DurationBucket; last: boolean }) {
  return (
    <View style={[styles.row, !last && { borderBottomWidth: theme.borders.hairline, borderBottomColor: theme.colors.border }]}>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>{bucket.label}</Text>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>{formatNumber(bucket.requests)} requests</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: { padding: 16, gap: 0 },
  header: { gap: 12, marginBottom: 4 },
  footer: { gap: 8, marginTop: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  groupByRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  section: { gap: 0 },
  rowCard: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 8 },
});
