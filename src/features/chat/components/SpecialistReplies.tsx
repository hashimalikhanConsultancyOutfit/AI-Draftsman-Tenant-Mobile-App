import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { SPECIALIST_REPLIES_COPY, specialistsSummary, type SpecialistsState } from '../teamChatRules';

interface SpecialistRepliesProps {
  state: SpecialistsState;
  count: number;
  names: readonly string[];
  children: ReactNode;
}

/**
 * The specialists' own replies to one question, folded into one row — web's
 * `SpecialistReplies`. Under a finished answer it reads "Based on N
 * specialist replies" and opens on tap; while the answer is being written it
 * says who has finished; if the answer failed it starts OPEN, because then
 * the specialists' replies are the only result there is.
 */
export function SpecialistReplies({ state, count, names, children }: SpecialistRepliesProps) {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(state === 'no-answer');
  const canToggle = state !== 'writing';

  return (
    <View style={styles.wrap}>
      <View style={[styles.row, { backgroundColor: state === 'writing' ? theme.colors.statusNeutralBg : 'transparent', borderRadius: theme.radii.md }]}>
        <Icon name={state === 'no-answer' ? 'error-outline' : 'check-circle'} size={16} color={state === 'no-answer' ? theme.colors.warning : theme.colors.success} />
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, flex: 1, lineHeight: 17 }}>{specialistsSummary(state, count, names)}</Text>
      </View>
      {canToggle && (
        <TouchableOpacity
          onPress={() => setOpen((v) => !v)}
          style={[styles.toggle, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12 }}>
            {open ? SPECIALIST_REPLIES_COPY.hide(count) : SPECIALIST_REPLIES_COPY.show(count)}
          </Text>
          <Icon name={open ? 'expand-less' : 'expand-more'} size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      )}
      {open && canToggle && <View style={styles.children}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 6, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 5 },
  children: { gap: 4, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: 'rgba(200,98,42,0.25)' },
});
