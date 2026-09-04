/**
 * Usage and credits — the workspace's wallet balance, grants and metered
 * spend. Ported from web's `UsageCreditsPanel` (confirmed against that
 * source and `GET /auth/my-settings/usage-credits` 2026-09-04).
 *
 * ── REACHABLE BY ANYONE; THE MONEY INSIDE IS GATED, NOT THE SCREEN ────────
 * Web's `MySettings.data.ts` lists this tab in the ungated "account"
 * group — every signed-in member can open it, same as `AccountScreen`.
 * What IS permission-gated is seeing the actual figures: `canViewSpend`
 * (`usage.view`) follows the exact pattern `DashboardScreen` already
 * established (`canSeeMoney`) — hide the amount behind an em-dash and a
 * "Needs the 'View usage' permission" caption, never the row itself.
 *
 * ── SESSIONS AND GRANTS ARE RENDERED AS CARD LISTS, NOT TABLES ────────────
 * Web renders `DataTable`s for the grant and session lists; this app has
 * no table primitive (every other module's lists are Card-wrapped rows —
 * see `UsageRowCard`, `TicketDetailScreen`'s attachment rows), so those
 * become simple row lists here instead, same data and columns.
 */

import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Card, EmptyState, ErrorState, Icon, Loader, StatusTabs } from '@/components/ui';
import { StatTile } from '@/features/dashboard/components/StatTile';
import { USAGE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatDayLabel, formatMoneyCents } from '@/utils/format';

import { CreditsBarChart } from './components/CreditsBarChart';
import { useGetUsageCreditsQuery } from './usageCreditsApi';
import {
  CREDITS_ARE_POUNDS_NOTE,
  DEFAULT_WINDOW,
  grantTypeLabel,
  isLowBalance,
  NO_DAILY_MESSAGE,
  NO_DAILY_TITLE,
  NO_GRANTS_MESSAGE,
  NO_GRANTS_TITLE,
  NO_HISTORY_MESSAGE,
  NO_HISTORY_TITLE,
  PAGE_DESCRIPTION,
  SEAT_NOT_TRACKED_CAPTION,
  UNFUNDED_MESSAGE,
  UNFUNDED_TITLE,
  WINDOW_TABS,
} from './usageCreditsRules';
import type { CreditGrant, UsageCreditsWindow, UsageHistoryRow } from './usageCredits.types';

const NEEDS_PERMISSION_CAPTION = 'Needs the “View usage” permission';

export function UsageCreditsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const canViewSpend = usePermission(USAGE_PERMISSIONS.VIEW);

  const [window, setWindow] = useState<UsageCreditsWindow>(DEFAULT_WINDOW);
  const { data, isLoading, isFetching, isError, error, refetch } = useGetUsageCreditsQuery(window);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Usage and credits" mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen label="Loading your wallet…" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Usage and credits" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message={getErrorMessage(error as never, 'Could not load your wallet.')} onRetry={refetch} />
      </View>
    );
  }

  const orgUsed = canViewSpend ? formatMoneyCents(data.orgUsedCents, data.currency) : '—';
  const granted = formatMoneyCents(data.grantedCents, data.currency);
  const remaining = canViewSpend ? formatMoneyCents(data.balanceCents, data.currency) : '—';
  const seatUsed = data.seatUsedCents === null ? '—' : canViewSpend ? formatMoneyCents(data.seatUsedCents, data.currency) : '—';
  const lowBalance = isLowBalance(data);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Usage and credits" mode="stack" onBack={() => navigation.goBack()} />
      <FlatList
        data={data.history}
        keyExtractor={(row) => row.id}
        renderItem={({ item }) => <SessionRow theme={theme} row={item} currency={data.currency} canViewSpend={canViewSpend} />}
        ListEmptyComponent={<EmptyState icon="history" title={NO_HISTORY_TITLE} description={NO_HISTORY_MESSAGE} />}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
        contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{PAGE_DESCRIPTION}</Text>

            {!data.walletProvisioned && (
              <Card style={[styles.banner, { backgroundColor: theme.colors.statusInfoBg }]}>
                <Icon name="info-outline" size={18} color={theme.colors.statusInfoFg} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{UNFUNDED_TITLE}</Text>
                  <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.regular, fontSize: 12, marginTop: 2 }}>{UNFUNDED_MESSAGE}</Text>
                </View>
              </Card>
            )}

            <SectionTitle theme={theme} title="Credit usage" />
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12, marginTop: -4, marginBottom: 4 }}>{CREDITS_ARE_POUNDS_NOTE}</Text>
            <View style={styles.statsGrid}>
              <StatTile label="Org credits used" value={orgUsed} caption={canViewSpend ? `Of ${granted} granted` : NEEDS_PERMISSION_CAPTION} icon="payments" />
              <StatTile label="Seat credits used" value={seatUsed} caption={data.seatUsedCents === null ? SEAT_NOT_TRACKED_CAPTION : canViewSpend ? undefined : NEEDS_PERMISSION_CAPTION} icon="person" />
              <StatTile
                label="Remaining balance"
                value={remaining}
                caption={!canViewSpend ? NEEDS_PERMISSION_CAPTION : lowBalance ? 'At or below the low-balance alert' : 'Available to spend'}
                warning={canViewSpend && lowBalance}
                icon="savings"
              />
            </View>

            <SectionTitle theme={theme} title="Credit grant" />
            <Card style={styles.section}>
              {data.grants.length === 0 ? (
                <EmptyState icon="card-giftcard" title={NO_GRANTS_TITLE} description={NO_GRANTS_MESSAGE} />
              ) : (
                data.grants.map((grant, i) => <GrantRow key={grant.id} theme={theme} grant={grant} currency={data.currency} canViewSpend={canViewSpend} last={i === data.grants.length - 1} />)
              )}
            </Card>

            <View style={styles.historyHeader}>
              <SectionTitle theme={theme} title="Credit usage history" />
              <StatusTabs tabs={WINDOW_TABS.map((t) => ({ label: t.label, value: String(t.value) }))} value={String(window)} onChange={(v) => setWindow(Number(v) as UsageCreditsWindow)} />
            </View>
            <Card style={styles.section}>
              {data.daily.length === 0 ? <EmptyState icon="bar-chart" title={NO_DAILY_TITLE} description={NO_DAILY_MESSAGE} /> : canViewSpend ? <CreditsBarChart points={data.daily} currency={data.currency} /> : <EmptyState icon="lock-outline" title="Not visible to you" description={NEEDS_PERMISSION_CAPTION} />}
            </Card>

            <SectionTitle theme={theme} title="Sessions" />
          </View>
        }
      />
    </View>
  );
}

function SectionTitle({ theme, title }: { theme: ReturnType<typeof useAppTheme>['theme']; title: string }) {
  return <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 }}>{title}</Text>;
}

function GrantRow({ theme, grant, currency, canViewSpend, last }: { theme: ReturnType<typeof useAppTheme>['theme']; grant: CreditGrant; currency: string; canViewSpend: boolean; last: boolean }) {
  return (
    <View style={[styles.row, !last && { borderBottomWidth: theme.borders.hairline, borderBottomColor: theme.colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>{grantTypeLabel(grant.type)}</Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12, marginTop: 1 }}>{formatDayLabel(grant.grantedAt)}</Text>
      </View>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.sm }}>{canViewSpend ? formatMoneyCents(grant.amountCents, currency) : '—'}</Text>
    </View>
  );
}

function SessionRow({ theme, row, currency, canViewSpend }: { theme: ReturnType<typeof useAppTheme>['theme']; row: UsageHistoryRow; currency: string; canViewSpend: boolean }) {
  return (
    <Card style={styles.sessionCard}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }} numberOfLines={1}>
            {row.modelSlug}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12, marginTop: 1 }}>{row.agentRef ?? 'No agent'}</Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 1 }}>{formatDayLabel(row.occurredAt)}</Text>
        </View>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.sm }}>{canViewSpend ? formatMoneyCents(row.costCents, currency) : '—'}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  listContainer: { padding: 16, gap: 10 },
  header: { gap: 12, marginBottom: 4 },
  banner: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  section: { gap: 0 },
  sessionCard: { gap: 0 },
  historyHeader: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 8 },
});
