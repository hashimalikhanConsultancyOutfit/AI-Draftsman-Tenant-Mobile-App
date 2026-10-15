import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

interface PanelProps {
  title: string;
  /** Right of the title — web's Panel `meta` slot (usually a button). */
  action?: ReactNode;
  children: ReactNode;
}

/** Web's `Panel` — a titled card section. */
export function Panel({ title, action, children }: PanelProps) {
  const { theme } = useAppTheme();
  return (
    <Card style={{ gap: 12 }}>
      <View style={styles.head}>
        <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>{title}</Text>
        {action}
      </View>
      {children}
    </Card>
  );
}

/** Muted body copy, the module's `Typography body2 text.secondary`. */
export function Muted({ children, tone }: { children: ReactNode; tone?: 'warning' | 'error' }) {
  const { theme } = useAppTheme();
  const color = tone === 'warning' ? theme.colors.statusWarningFg : tone === 'error' ? theme.colors.error : theme.colors.textMuted;
  return <Text style={{ color, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{children}</Text>;
}

/** Web's `CalloutBanner` — a tinted notice. */
export function Callout({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'success' | 'danger' }) {
  const { theme } = useAppTheme();
  const t = {
    info: { bg: theme.colors.statusInfoBg, fg: theme.colors.statusInfoFg },
    success: { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg },
    danger: { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg },
  }[tone];
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: theme.radii.md, padding: 12 }}>
      <Text style={{ color: t.fg, fontFamily: theme.fontFamilies.body.regular, fontSize: 13, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
