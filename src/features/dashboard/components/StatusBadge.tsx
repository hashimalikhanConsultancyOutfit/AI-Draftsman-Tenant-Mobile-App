import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

import type { RunStatus } from '../dashboard.types';

const LABELS: Record<RunStatus, string> = {
  CHARGED: 'charged',
  NOT_CHARGED_CACHED: 'cached',
  NOT_CHARGED_FAILURE: 'failed',
  REVERSED: 'reversed',
};

export function StatusBadge({ status }: { status: RunStatus }) {
  const { theme } = useAppTheme();
  const tone: Record<RunStatus, { bg: string; fg: string }> = {
    CHARGED: { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg },
    NOT_CHARGED_CACHED: { bg: theme.colors.statusInfoBg, fg: theme.colors.statusInfoFg },
    NOT_CHARGED_FAILURE: { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg },
    REVERSED: { bg: theme.colors.statusWarningBg, fg: theme.colors.statusWarningFg },
  };
  const { bg, fg } = tone[status];

  return (
    <View style={[styles.pill, { backgroundColor: bg, borderRadius: theme.radii.full }]}>
      <Text style={[styles.label, { color: fg }]}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  label: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 11, textTransform: 'lowercase' },
});
