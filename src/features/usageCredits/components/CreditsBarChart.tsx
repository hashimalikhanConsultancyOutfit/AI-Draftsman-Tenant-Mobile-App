/**
 * A tappable daily-spend bar chart — the same shape `DashboardScreen`'s
 * own local `MiniBarChart` already draws for "Spend by day" (this app's
 * one existing chart idiom, plain `View`s rather than a chart library),
 * adapted for the credit history's pence-typed points and its 7/30/90 day
 * window instead of a fixed month.
 */
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';
import { formatDayLabel, formatMoneyCents } from '@/utils/format';

import type { DailyUsagePoint } from '../usageCredits.types';

interface CreditsBarChartProps {
  points: DailyUsagePoint[];
  currency: string;
}

export function CreditsBarChart({ points, currency }: CreditsBarChartProps) {
  const { theme } = useAppTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(...points.map((p) => p.costCents), 1);
  const activeIndex = selected ?? points.length - 1;
  const active = points[activeIndex];
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  return (
    <View>
      <View style={styles.callout}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.sm }}>{formatMoneyCents(active?.costCents, currency)}</Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{active ? formatDayLabel(active.date) : ''}</Text>
      </View>
      <View style={styles.chart} accessibilityRole="none" accessibilityLabel="Credit usage per day">
        {points.map((point, i) => (
          <TouchableOpacity
            key={point.date}
            style={styles.col}
            activeOpacity={0.7}
            onPress={() => setSelected(i)}
            accessibilityRole="button"
            accessibilityLabel={`${formatDayLabel(point.date)}: ${formatMoneyCents(point.costCents, currency)}`}
          >
            <View style={[styles.bar, { height: Math.max(3, (point.costCents / max) * 64), backgroundColor: theme.colors.accent, opacity: i === activeIndex ? 1 : 0.55, borderRadius: theme.radii.sm }]} />
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.axis}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{firstPoint ? formatDayLabel(firstPoint.date) : ''}</Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{lastPoint ? formatDayLabel(lastPoint.date) : ''}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 72, marginTop: 8 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minWidth: 2 },
  bar: { width: '70%', minWidth: 2 },
  callout: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
});
