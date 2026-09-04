/**
 * One breakdown row, as a card — the mobile shape for web's
 * `UsageTable` row (confirmed against that source 2026-09-04): label
 * (relabelled when unattributed), requests/tokens, a cache-hit bar (an
 * em dash when never measured — a real reading, not a missing one), and
 * cost.
 */
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';
import { formatMoney } from '@/utils/format';

import type { UsageRow } from '../usageSpend.types';
import { rowDisplayLabel } from '../usageSpendRules';

interface UsageRowCardProps {
  row: UsageRow;
  dimensionLabel: string;
}

export function UsageRowCard({ row, dimensionLabel }: UsageRowCardProps) {
  const { theme } = useAppTheme();
  const label = rowDisplayLabel(row, dimensionLabel);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.xl, borderWidth: theme.borders.hairline, borderColor: theme.colors.border }]}>
      <View style={styles.headerRow}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm, flex: 1 }} numberOfLines={2}>
          {label}
        </Text>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>{formatMoney(row.cost)}</Text>
      </View>

      <View style={styles.factsRow}>
        <View style={styles.fact}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>Requests</Text>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: 13 }}>{row.requests.toLocaleString('en-GB')}</Text>
        </View>
        <View style={styles.fact}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>Tokens</Text>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: 13 }}>{row.tokens.toLocaleString('en-GB')}</Text>
        </View>
      </View>

      <View style={styles.cacheRow}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>Cache hit</Text>
        {row.cached === null ? (
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} accessibilityLabel={`${label} cache hit rate not measured`}>
            —
          </Text>
        ) : (
          <View style={styles.cacheBarRow} accessibilityLabel={`${label} cache hit rate ${String(row.cached)}%`}>
            <View style={[styles.track, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.full }]}>
              <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, row.cached))}%`, backgroundColor: theme.colors.statusSuccessFg, borderRadius: theme.radii.full }]} />
            </View>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: 12 }}>{row.cached}%</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  factsRow: { flexDirection: 'row', gap: 20 },
  fact: { gap: 2 },
  cacheRow: { gap: 4 },
  cacheBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 5, overflow: 'hidden' },
  fill: { height: '100%' },
});
