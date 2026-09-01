import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';
import { formatMoney, formatNumber, formatRelativeTime } from '@/utils/format';

import type { RecentRun } from '../dashboard.types';
import { StatusBadge } from './StatusBadge';

export function RunRow({ run, showCost }: { run: RecentRun; showCost: boolean }) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }} numberOfLines={1}>
          {run.agent ?? 'Deleted agent'}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }} numberOfLines={1}>
          {run.customer ?? '—'} · {run.model}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }}>
          {formatNumber(run.tokens)} tokens · {formatRelativeTime(run.at)}
        </Text>
      </View>
      <View style={styles.trailing}>
        {showCost && (
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.sm }}>
            {formatMoney(run.cost)}
          </Text>
        )}
        <StatusBadge status={run.status} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  trailing: { alignItems: 'flex-end', gap: 6 },
});
