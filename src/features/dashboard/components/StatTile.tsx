import { StyleSheet, Text, View } from 'react-native';

import { Card, Icon, type IconName } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

interface StatTileProps {
  label: string;
  value: string;
  caption?: string;
  icon: IconName;
  /** Renders a thin progress bar under the value — used for "61% of the
   * £5.00 cap" on Spend this month. Omit for tiles with no cap concept. */
  progressPct?: number;
  warning?: boolean;
}

export function StatTile({ label, value, caption, icon, progressPct, warning }: StatTileProps) {
  const { theme } = useAppTheme();

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>{label}</Text>
        <View style={[styles.iconChip, { backgroundColor: theme.colors.accent + '1A', borderRadius: theme.radii.md }]}>
          <Icon name={icon} size={16} color={theme.colors.accent} />
        </View>
      </View>
      <Text style={[styles.value, { color: theme.colors.text, fontFamily: theme.fontFamilies.display.bold }]}>{value}</Text>
      {caption && (
        <Text style={[styles.caption, { color: warning ? theme.colors.warning : theme.colors.textMuted }]}>{caption}</Text>
      )}
      {progressPct !== undefined && (
        <View style={[styles.track, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.full }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.min(100, Math.max(0, progressPct))}%`,
                backgroundColor: progressPct >= 80 ? theme.colors.warning : theme.colors.accent,
                borderRadius: theme.radii.full,
              },
            ]}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: '46%', gap: 6 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  label: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', flex: 1 },
  iconChip: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 22 },
  caption: { fontFamily: 'InstrumentSans_400Regular', fontSize: 11 },
  track: { height: 5, marginTop: 2, overflow: 'hidden' },
  fill: { height: '100%' },
});
