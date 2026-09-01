import { StyleSheet, Text, View } from 'react-native';

import type { IconName } from '@/components/ui';
import type { AppTheme } from '@/theme/ThemeContext';
import { useAppTheme } from '@/theme/ThemeContext';

import type { RunStatus } from '../dashboard.types';

const LABELS: Record<RunStatus, string> = {
  CHARGED: 'charged',
  NOT_CHARGED_CACHED: 'cached',
  NOT_CHARGED_FAILURE: 'failed',
  REVERSED: 'reversed',
};

/** The glyph `RunRow`'s status avatar uses — co-located with the color
 * tone below so a new `RunStatus` value can't add one without the other. */
export const RUN_STATUS_ICON: Record<RunStatus, IconName> = {
  CHARGED: 'check-circle',
  NOT_CHARGED_CACHED: 'cached',
  NOT_CHARGED_FAILURE: 'error-outline',
  REVERSED: 'undo',
};

/** Shared bg/fg pair for a run's status — the single source both this
 * pill and `RunRow`'s status avatar tint from, so the two never drift. */
export function runStatusTone(theme: AppTheme, status: RunStatus): { bg: string; fg: string } {
  switch (status) {
    case 'CHARGED':
      return { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg };
    case 'NOT_CHARGED_CACHED':
      return { bg: theme.colors.statusInfoBg, fg: theme.colors.statusInfoFg };
    case 'NOT_CHARGED_FAILURE':
      return { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg };
    case 'REVERSED':
      return { bg: theme.colors.statusWarningBg, fg: theme.colors.statusWarningFg };
  }
}

export function StatusBadge({ status }: { status: RunStatus }) {
  const { theme } = useAppTheme();
  const { bg, fg } = runStatusTone(theme, status);

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
