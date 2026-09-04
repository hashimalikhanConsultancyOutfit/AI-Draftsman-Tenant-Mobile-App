/**
 * OrganizationSettingsScreen — ported from web's `OrganizationSettings.tsx`
 * (confirmed against that source 2026-09-04). The whole screen is two
 * numbers and their difference: what a credit costs this workspace (£1,
 * by definition), what it charges its customers for one, and the margin
 * — all three read from `GET /organization/pricing`, including the
 * margin, which is deliberately NOT recomputed client-side (a second
 * implementation of the subtraction is free to disagree with the one the
 * invoice is built from).
 *
 * `billing.view` gates the read; `billing.manage` gates the rate editor.
 * The editor button stays visible-but-disabled rather than hidden when
 * the grant is missing — matching web's own choice, stated in its source:
 * this is the only place in the portal to set a selling rate, so an
 * absent button would read as a missing feature rather than a missing
 * permission.
 */

import { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, EmptyState, Loader } from '@/components/ui';
import { StatTile } from '@/features/dashboard/components/StatTile';
import { BILLING_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatMoneyCents } from '@/utils/format';

import type { OrganizationSettingsStackParamList } from '@/navigation/types';
import { useGetOrganizationPricingQuery } from './organizationSettingsApi';
import {
  CREDIT_CARD_TITLE,
  NO_MANAGE_MESSAGE,
  NO_RATE_COPY,
  NO_VIEW_DESCRIPTION,
  OTHER_MECHANISM_COPY,
  PAGE_DESCRIPTION,
  PERIOD_CARD_TITLE,
  PERIOD_EMPTY_COPY,
  PERIOD_UNAVAILABLE_COPY,
  UNAVAILABLE_COPY,
  formatCredits,
  formatMargin,
  formatMarginPct,
  formatPeriod,
  marginPct,
  marginToneOf,
} from './organizationSettingsRules';

type Nav = NativeStackNavigationProp<OrganizationSettingsStackParamList>;

export function OrganizationSettingsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const canView = usePermission(BILLING_PERMISSIONS.VIEW);
  const canManage = usePermission(BILLING_PERMISSIONS.MANAGE);

  const { data, isLoading, isFetching, error, refetch } = useGetOrganizationPricingQuery(undefined, { skip: !canView });
  const isUnavailable = canView && Boolean(error) && !data;

  const openHeader = () => (
    <AppHeader title="Organization settings" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />
  );

  const handleEditRate = useCallback(() => {
    navigation.navigate('CreditRateForm');
  }, [navigation]);

  if (!canView) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {openHeader()}
        <View style={{ padding: 16 }}>
          <EmptyState icon="lock" title="You cannot view pricing" description={NO_VIEW_DESCRIPTION} />
        </View>
      </View>
    );
  }

  if (isUnavailable) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {openHeader()}
        <View style={{ padding: 16 }}>
          <EmptyState icon="cloud-off" title={UNAVAILABLE_COPY.title} description={UNAVAILABLE_COPY.description} />
        </View>
      </View>
    );
  }

  if (isLoading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {openHeader()}
        <Loader fullScreen />
      </View>
    );
  }

  const rate = data?.creditRate ?? null;
  const sellPence = rate?.sellPencePerCredit ?? null;
  const costPence = rate?.costPencePerCredit ?? 100;
  const marginPence = rate?.marginPencePerCredit ?? null;
  const hasRate = sellPence !== null;
  const pct = marginPence === null ? null : marginPct(marginPence, costPence);
  const marginTone = marginToneOf(marginPence);
  const otherMechanism = data?.otherMechanism ?? null;

  const periodRaw = data?.period ?? null;
  const periodMarginTone = periodRaw && periodRaw.resoldCredits > 0 ? marginToneOf(periodRaw.marginCents) : null;
  const periodIsEmpty = periodRaw ? periodRaw.entries === 0 : false;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {openHeader()}
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]} refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{PAGE_DESCRIPTION}</Text>

        <Button label={hasRate ? 'Change selling rate' : 'Set selling rate'} icon="sell" onPress={handleEditRate} disabled={!canManage} fullWidth />
        {!canManage ? <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{NO_MANAGE_MESSAGE}</Text> : null}

        <Card style={styles.section}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>{CREDIT_CARD_TITLE}</Text>
          <View style={styles.tileRow}>
            <StatTile label="You pay" value={formatMoneyCents(costPence)} caption="Per credit, whichever model serves the call" icon="payments" />
            <StatTile label="You charge" value={hasRate ? formatMoneyCents(sellPence as number) : '—'} caption={hasRate ? 'Per credit, to your customers' : 'Not set yet'} warning={!hasRate} icon="sell" />
            <StatTile label="You keep" value={marginPence === null ? '—' : formatMargin(marginPence)} valueTone={marginTone} caption={pct === null ? 'Set a rate to see your margin' : formatMarginPct(pct)} warning={marginTone === 'negative'} icon="trending-up" />
          </View>
        </Card>

        {!hasRate ? (
          <Card style={[styles.section, { backgroundColor: theme.colors.statusInfoBg, borderColor: theme.colors.statusInfoBg }]}>
            <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{NO_RATE_COPY.title}.</Text>
            <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 18, marginTop: 4 }}>{otherMechanism ? OTHER_MECHANISM_COPY[otherMechanism] : NO_RATE_COPY.description}</Text>
          </Card>
        ) : null}

        <Card style={styles.section}>
          <View style={styles.periodHeader}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>{PERIOD_CARD_TITLE}</Text>
            {periodRaw ? <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{formatPeriod(periodRaw.period)}</Text> : null}
          </View>

          {periodRaw === null ? (
            <EmptyState icon="cloud-off" title={PERIOD_UNAVAILABLE_COPY.title} description={PERIOD_UNAVAILABLE_COPY.description} />
          ) : periodIsEmpty ? (
            <EmptyState icon="event-busy" title={PERIOD_EMPTY_COPY.title} description={PERIOD_EMPTY_COPY.description} />
          ) : (
            <View style={styles.tileRow}>
              <StatTile label="Consumed" value={`${formatCredits(periodRaw.credits)} credits`} caption={isFetching ? 'Refreshing…' : 'Charged this period'} icon="bolt" />
              <StatTile label="Cost you" value={formatMoneyCents(periodRaw.costCents)} icon="payments" />
              <StatTile label="Charged on" value={formatMoneyCents(periodRaw.sellCents)} icon="sell" />
              <StatTile label="Kept" value={formatMargin(periodRaw.marginCents)} valueTone={periodMarginTone} caption={periodMarginTone === null ? 'Nothing resold this period' : 'On resold credits only'} warning={periodMarginTone === 'negative'} icon="trending-up" />
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  section: { gap: 10 },
  tileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  periodHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
