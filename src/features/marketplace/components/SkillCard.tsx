import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { CLONED_BADGE_LABEL, OWN_BADGE_LABEL, formatDate } from '../marketplaceRules';
import type { SkillRow } from '../marketplace.types';

interface SkillCardProps {
  skill: SkillRow;
  onPress: () => void;
}

/** Owned-skill tile — no per-skill logo exists, so a puzzle-piece icon tile
 * stands in for every row. No edit/delete/run controls: there is no
 * endpoint behind any of them (see marketplaceRules.SKILL_DETAIL_GAP). */
export function SkillCard({ skill, onPress }: SkillCardProps) {
  const { theme } = useAppTheme();
  const cloned = skill.origin === 'installed';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${skill.name}`}
    >
      <View style={styles.top}>
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
          <Icon name="extension" size={20} color={theme.colors.accent} />
        </View>
        <View style={styles.identity}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={1}>
            {skill.name}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }}>
            {cloned ? 'Installed' : 'Added'} {formatDate(skill.savedAt)}
          </Text>
        </View>
      </View>

      {skill.description && (
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 8 }} numberOfLines={3}>
          {skill.description}
        </Text>
      )}

      <View style={styles.metaRow}>
        <View style={[styles.chip, { backgroundColor: cloned ? theme.colors.statusInfoBg : theme.colors.statusSuccessBg }]}>
          <Text style={{ color: cloned ? theme.colors.statusInfoFg : theme.colors.statusSuccessFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>
            {cloned ? CLONED_BADGE_LABEL : OWN_BADGE_LABEL}
          </Text>
        </View>
        {skill.categoryName && (
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }} numberOfLines={1}>
            {skill.categoryName}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 14, width: '100%' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconCircle: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1, minWidth: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
});
