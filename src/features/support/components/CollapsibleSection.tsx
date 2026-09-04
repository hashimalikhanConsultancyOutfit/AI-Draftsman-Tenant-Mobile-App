/**
 * A folded reference section — Details/Service level/Attachments on the
 * ticket screen, closed by default. Ported in spirit from web's
 * `CollapsibleSection` (`TicketDrawer.tsx`): these three answer "what is
 * this ticket", while the thread above answers "what has been said" and
 * is why the screen was opened, so folding them lifts the conversation
 * rather than making the reader scroll past rows of metadata first.
 */
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

interface CollapsibleSectionProps {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({ title, badge, defaultOpen = false, children }: CollapsibleSectionProps) {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg, borderWidth: theme.borders.hairline, borderColor: theme.colors.border }]}>
      <TouchableOpacity onPress={() => setOpen((v) => !v)} style={styles.header} accessibilityRole="button">
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm, flex: 1 }}>{title}</Text>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: theme.colors.statusInfoBg, borderRadius: theme.radii.full }]}>
            <Text style={{ color: theme.colors.statusInfoFg, fontSize: 11, fontFamily: theme.fontFamilies.body.semibold }}>{badge}</Text>
          </View>
        ) : null}
        <Icon name={open ? 'expand-less' : 'expand-more'} size={20} color={theme.colors.textMuted} />
      </TouchableOpacity>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  badge: { paddingHorizontal: 8, paddingVertical: 2 },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
});
