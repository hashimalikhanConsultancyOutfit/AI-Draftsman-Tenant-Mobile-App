/**
 * RotatingKeysScreen — the clock behind the rotate promise, on demand.
 * Ported from web's `RotationDrawer.tsx` (confirmed against that source
 * 2026-09-03) as a pushed screen rather than a side drawer — this app's
 * established shape for "more detail than the row has room for" (same
 * choice Reports made for its run log). Reached from the "N rotations in
 * progress" banner on the registry.
 *
 * Ticks every second for as long as this screen is mounted — the countdown
 * is the entire point of being here, unlike the registry's own badge tick
 * (which tears down once nothing is rotating).
 */

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Card, EmptyState, ErrorState, Loader } from '@/components/ui';
import { USAGE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatMoneyCents } from '@/utils/format';

import type { ApiKeysStackParamList } from '@/navigation/types';
import { useGetApiKeysQuery } from './apiKeysApi';
import { ROTATION_COPY, ROTATION_WINDOW_MS, formatCountdown, formatDeadline, isRotationOpen, maskPrefix } from './apiKeysRules';

type Nav = NativeStackNavigationProp<ApiKeysStackParamList>;

export function RotatingKeysScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const canViewSpend = usePermission(USAGE_PERMISSIONS.VIEW);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data, isLoading, error, refetch } = useGetApiKeysQuery({ status: 'ROTATING' });
  const rotations = (data ?? []).filter((k) => isRotationOpen(k.previousValidUntil, now));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={ROTATION_COPY.title} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{ROTATION_COPY.description}</Text>

        {isLoading ? (
          <Loader fullScreen />
        ) : error ? (
          <ErrorState title="Could not load rotations" message={getErrorMessage(error as never, 'Something went wrong.')} onRetry={refetch} />
        ) : rotations.length === 0 ? (
          <EmptyState icon="autorenew" title="Nothing is rotating" description={ROTATION_COPY.allClosed} />
        ) : (
          rotations.map((key) => {
            const endsAt = new Date(key.previousValidUntil as string).getTime();
            const msLeft = endsAt - now;
            const remainingPercent = Math.max(0, Math.min(100, (msLeft / ROTATION_WINDOW_MS) * 100));
            const cap = key.policy.budgetMinor;
            const used = key.usage.costMinor;

            return (
              <Card key={key.id} style={styles.card}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.md }}>{key.name}</Text>
                <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginBottom: 8 }}>policy {key.policy.name}</Text>

                <View style={styles.handles}>
                  <View style={styles.handle}>
                    <View style={[styles.chip, { backgroundColor: theme.colors.statusWarningBg, borderRadius: theme.radii.full }]}>
                      <Text style={{ color: theme.colors.statusWarningFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>{ROTATION_COPY.oldLabel}</Text>
                    </View>
                    <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.xs, marginTop: 4 }}>{maskPrefix(key.previousPrefix as string)}</Text>
                  </View>
                  <View style={styles.handle}>
                    <View style={[styles.chip, { backgroundColor: theme.colors.statusSuccessBg, borderRadius: theme.radii.full }]}>
                      <Text style={{ color: theme.colors.statusSuccessFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>{ROTATION_COPY.newLabel}</Text>
                    </View>
                    <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.xs, marginTop: 4 }}>{maskPrefix(key.prefix)}</Text>
                  </View>
                </View>

                <View style={styles.countdownBlock}>
                  <View style={[styles.track, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.full }]}>
                    <View
                      style={[
                        styles.fill,
                        { width: `${remainingPercent}%`, backgroundColor: remainingPercent < 25 ? theme.colors.statusWarningFg : theme.colors.statusSuccessFg, borderRadius: theme.radii.full },
                      ]}
                    />
                  </View>
                  <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 4 }}>
                    old secret stops in {formatCountdown(msLeft)} · {formatDeadline(key.previousValidUntil as string)}
                  </Text>
                </View>

                <View style={styles.limits}>
                  {canViewSpend ? (
                    <View style={styles.limitCol}>
                      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>Cap left this window</Text>
                      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.xs }}>
                        {formatMoneyCents(Math.max(0, cap - used))} of {formatMoneyCents(cap)}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.limitCol}>
                    <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>Rate limits — shared by both secrets</Text>
                    <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.xs }}>
                      {key.policy.requestsPerMinute.toLocaleString('en-GB')} rpm · {key.policy.tokensPerMinute.toLocaleString('en-GB')} tpm
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card: { gap: 2 },
  handles: { flexDirection: 'row', gap: 16, marginTop: 4 },
  handle: { flex: 1 },
  chip: { paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  countdownBlock: { marginTop: 12 },
  track: { height: 6, width: '100%', overflow: 'hidden' },
  fill: { height: 6 },
  limits: { flexDirection: 'row', gap: 20, marginTop: 12 },
  limitCol: { gap: 2 },
});
