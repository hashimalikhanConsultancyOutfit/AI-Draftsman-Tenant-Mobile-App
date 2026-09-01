import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { formatMoney } from '@/utils/format';
import { useAppTheme } from '@/theme/ThemeContext';

import { CLONE_STATE_TONE } from '../cloneRules';
import type { Clone } from '../customerAgents.types';

interface CloneCardProps {
  clone: Clone;
  canViewSpend: boolean;
  onPress: () => void;
}

const STATE_LABEL: Record<Clone['state'], string> = {
  'in sync': 'In sync',
  diverged: 'Diverged',
  pinned: 'Pinned',
};

export function CloneCard({ clone, canViewSpend, onPress }: CloneCardProps) {
  const { theme } = useAppTheme();
  const tone = CLONE_STATE_TONE[clone.state];
  const toneColor =
    tone === 'success' ? theme.colors.statusSuccessFg : tone === 'warning' ? theme.colors.statusWarningFg : theme.colors.statusInfoFg;
  const toneBg = tone === 'success' ? theme.colors.statusSuccessBg : tone === 'warning' ? theme.colors.statusWarningBg : theme.colors.statusInfoBg;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${clone.cust}'s copy of ${clone.parent}`}
    >
      <View style={styles.top}>
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
          <Icon name="person-outline" size={20} color={theme.colors.accent} />
        </View>

        <View style={styles.identity}>
          <Text
            style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}
            numberOfLines={1}
          >
            {clone.cust}
          </Text>
          <Text
            style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }}
            numberOfLines={1}
          >
            {`Copy of ${clone.parent} · v${clone.ver}`}
          </Text>
        </View>

        {clone.pinned && <Icon name="push-pin" size={16} color={theme.colors.statusInfoFg} />}
        <Icon name="chevron-right" size={22} color={theme.colors.textMuted} />
      </View>

      <View style={styles.bottomRow}>
        <View style={[styles.chip, { backgroundColor: toneBg, borderRadius: theme.radii.full }]}>
          <Text style={[styles.chipText, { color: toneColor }]}>{STATE_LABEL[clone.state]}</Text>
        </View>

        {clone.div.length > 0 && (
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, flex: 1 }} numberOfLines={1}>
            {clone.div.join(', ')}
          </Text>
        )}

        {canViewSpend && (
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.xs, marginLeft: 'auto' }}>
            {formatMoney(clone.spend, 'GBP')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 14, width: '100%' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1, minWidth: 0 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 11 },
});
