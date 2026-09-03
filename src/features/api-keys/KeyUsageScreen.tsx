/**
 * KeyUsageScreen — one key's usage, in full. Ported from the "Usage" toggle
 * on web's `ApiKeys.tsx` (confirmed against `apps/gateway-b2b/.../
 * api-keys.controller.ts#usage` and `apps/b2b-core/.../api-key.service.ts
 * #usage` on 2026-09-03): daily spend, the model split, and the 50 most
 * recent requests — REJECTED ones included, not only successful calls, so
 * a key being probed is visible here rather than invisible.
 *
 * ── THE BAR CHART ────────────────────────────────────────────────────────
 * This app has no charting library (confirmed: Dashboard's own spend
 * series is a hand-built `MiniBarChart` of plain Views, not a library
 * component) — `UsageBarChart` below is that same shape, feature-local
 * since it is only needed once here.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Card, EmptyState, ErrorState, Loader, PickerField } from '@/components/ui';
import { USAGE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatDayLabel, formatMoneyCents, formatNumber, formatPercent, formatRelativeTime } from '@/utils/format';

import type { ApiKeysStackParamList } from '@/navigation/types';
import { useGetApiKeyUsageQuery } from './apiKeysApi';
import { OUTCOME_LABEL, OUTCOME_TONE } from './apiKeysRules';
import type { KeyUsageDailyPoint } from './apiKeys.types';

type Nav = NativeStackNavigationProp<ApiKeysStackParamList>;
type Rt = RouteProp<ApiKeysStackParamList, 'KeyUsage'>;

const WINDOW_OPTIONS = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
  { label: 'Last 365 days', value: '365' },
];

function SectionHeading({ children }: { children: string }) {
  const { theme } = useAppTheme();
  return <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md, marginBottom: 8 }}>{children}</Text>;
}

function Fact({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.factRow}>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, flex: 1 }}>{label}</Text>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.xs, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

/** One bar per day in the window — a real bar graph, not a sparkline
 * standing in for one. Tap a bar to see its date and spend. */
function UsageBarChart({ daily }: { daily: KeyUsageDailyPoint[] }) {
  const { theme } = useAppTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const values = daily.map((d) => d.costMinor);
  const max = Math.max(...values, 1);
  const activeIndex = selected ?? values.length - 1;
  const activePoint = daily[activeIndex];
  const firstPoint = daily[0];
  const lastPoint = daily[daily.length - 1];

  return (
    <View>
      <View style={styles.chartCallout}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.sm }}>{formatMoneyCents(values[activeIndex])}</Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{activePoint ? formatDayLabel(activePoint.date) : ''}</Text>
      </View>
      <View style={styles.chart} accessibilityRole="none" accessibilityLabel="Spend per day this window">
        {daily.map((point, i) => (
          <TouchableOpacity
            key={point.date}
            style={styles.chartCol}
            activeOpacity={0.7}
            onPress={() => setSelected(i)}
            accessibilityRole="button"
            accessibilityLabel={`${formatDayLabel(point.date)}: ${formatMoneyCents(point.costMinor)}`}
          >
            <View
              style={[
                styles.chartBar,
                { height: Math.max(3, (point.costMinor / max) * 64), backgroundColor: theme.colors.accent, opacity: i === activeIndex ? 1 : 0.55, borderRadius: theme.radii.sm },
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.chartAxis}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{firstPoint ? formatDayLabel(firstPoint.date) : ''}</Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{lastPoint ? formatDayLabel(lastPoint.date) : ''}</Text>
      </View>
    </View>
  );
}

export function KeyUsageScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const canViewSpend = usePermission(USAGE_PERMISSIONS.VIEW);

  const [windowDays, setWindowDays] = useState('30');
  const { data, isLoading, error, refetch } = useGetApiKeyUsageQuery({ id: params.id, days: Number(windowDays) });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={params.name ? `Usage · ${params.name}` : 'Key usage'} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        {isLoading ? (
          <Loader fullScreen />
        ) : error || !data ? (
          <ErrorState title="Could not load usage" message={getErrorMessage(error as never, 'Something went wrong.')} onRetry={refetch} />
        ) : (
          <>
            <PickerField label="Window" value={windowDays} options={WINDOW_OPTIONS} onChange={setWindowDays} />

            {canViewSpend ? (
              <Card>
                <SectionHeading>Cap this window</SectionHeading>
                <Fact label="Spent" value={formatMoneyCents(data.key.usage.costMinor)} />
                <Fact label="Cap" value={formatMoneyCents(data.key.policy.budgetMinor)} />
                <Fact label="Used" value={formatPercent(data.key.policy.budgetMinor > 0 ? (data.key.usage.costMinor / data.key.policy.budgetMinor) * 100 : 100)} />
              </Card>
            ) : null}

            <Card>
              <SectionHeading>Spend per day</SectionHeading>
              {data.daily.length === 0 ? <EmptyState icon="bar-chart" title="No usage recorded" description="Nothing came through this key in this window." /> : <UsageBarChart daily={data.daily} />}
            </Card>

            <Card>
              <SectionHeading>By model</SectionHeading>
              {data.byModel.length === 0 ? (
                <EmptyState icon="smart-toy" title="No usage recorded" description="Nothing came through this key in this window." />
              ) : (
                <View style={{ gap: 8 }}>
                  {data.byModel.map((row) => (
                    <Fact key={row.modelId} label={row.modelId} value={`${formatNumber(row.requestCount)} req · ${formatMoneyCents(row.costMinor)}`} />
                  ))}
                </View>
              )}
            </Card>

            <Card>
              <SectionHeading>Recent requests</SectionHeading>
              {data.recentRequests.length === 0 ? (
                <EmptyState icon="history" title="No requests recorded" description="Nothing came through this key in this window — rejections would show here too." />
              ) : (
                <View style={{ gap: 10 }}>
                  {data.recentRequests.map((req) => {
                    const tone = OUTCOME_TONE[req.outcome];
                    const toneColors =
                      tone === 'success'
                        ? { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg }
                        : tone === 'error'
                          ? { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg }
                          : tone === 'warning'
                            ? { bg: theme.colors.statusWarningBg, fg: theme.colors.statusWarningFg }
                            : { bg: theme.colors.statusNeutralBg, fg: theme.colors.statusNeutralFg };
                    return (
                      <View key={req.id} style={[styles.requestRow, { borderColor: theme.colors.border }]}>
                        <View style={styles.requestTop}>
                          <View style={[styles.chip, { backgroundColor: toneColors.bg, borderRadius: theme.radii.full }]}>
                            <Text style={{ color: toneColors.fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>{OUTCOME_LABEL[req.outcome]}</Text>
                          </View>
                          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{formatRelativeTime(req.occurredAt)}</Text>
                        </View>
                        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 4 }}>
                          {req.modelId ?? '—'} · {req.httpStatus ?? '—'} · {req.sourceIp ?? '—'}
                          {req.costMinor !== null ? ` · ${formatMoneyCents(req.costMinor)}` : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  chartCallout: { alignItems: 'center', marginBottom: 8 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 72 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  chartBar: { width: '100%' },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  requestRow: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 8 },
  requestTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { paddingHorizontal: 8, paddingVertical: 2 },
});
