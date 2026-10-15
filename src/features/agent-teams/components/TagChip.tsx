import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

export type TagTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

interface TagChipProps {
  label: string;
  tone?: TagTone;
  /** Outlined rather than filled — web's `StatusTag outlined`. */
  outlined?: boolean;
}

/** The mobile shape of web's `StatusTag` — a small pill in one of the
 * theme's status tones. */
export function TagChip({ label, tone = 'neutral', outlined = false }: TagChipProps) {
  const { theme } = useAppTheme();
  const tones: Record<TagTone, { bg: string; fg: string }> = {
    neutral: { bg: theme.colors.statusNeutralBg, fg: theme.colors.statusNeutralFg },
    info: { bg: theme.colors.statusInfoBg, fg: theme.colors.statusInfoFg },
    success: { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg },
    warning: { bg: theme.colors.statusWarningBg, fg: theme.colors.statusWarningFg },
    danger: { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg },
    accent: { bg: theme.colors.accent + '1A', fg: theme.colors.accent },
  };
  const t = tones[tone];
  return (
    <View
      style={[
        styles.chip,
        {
          borderRadius: theme.radii.full,
          backgroundColor: outlined ? 'transparent' : t.bg,
          borderColor: outlined ? t.fg : 'transparent',
        },
      ]}
    >
      <Text style={{ color: t.fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth, maxWidth: '100%' },
});
