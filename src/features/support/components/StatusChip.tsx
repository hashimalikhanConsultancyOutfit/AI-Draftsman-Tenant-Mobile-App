/**
 * A small coloured pill — the same inline `Chip` shape `DomainCard.tsx`
 * already draws locally for Branding & Domain, pulled out here since
 * Support needs it in four places (ticket state, SLA state, priority
 * flag, message kind) rather than one.
 */
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

import type { Tone } from '../supportRules';

interface StatusChipProps {
  label: string;
  tone: Tone;
}

export function StatusChip({ label, tone }: StatusChipProps) {
  const { theme } = useAppTheme();
  const pair: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: theme.colors.statusNeutralBg, fg: theme.colors.statusNeutralFg },
    success: { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg },
    warning: { bg: theme.colors.statusWarningBg, fg: theme.colors.statusWarningFg },
    error: { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg },
    info: { bg: theme.colors.statusInfoBg, fg: theme.colors.statusInfoFg },
  };
  const { bg, fg } = pair[tone];

  return (
    <View style={[styles.chip, { backgroundColor: bg, borderRadius: theme.radii.full }]}>
      <Text style={{ color: fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
});
