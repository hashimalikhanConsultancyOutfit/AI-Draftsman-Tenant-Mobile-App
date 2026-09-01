import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { FRESHNESS_LABEL, FRESHNESS_TONE, type StatusTone } from '../knowledgeBaseRules';
import type { KnowledgeBase } from '../knowledgeBases.types';

interface KnowledgeBaseCardProps {
  base: KnowledgeBase;
  onPress: () => void;
}

const SCOPE_ICON = { Internal: 'business' as const, Agent: 'smart-toy' as const, Customer: 'person-outline' as const };

function toneColors(theme: ReturnType<typeof useAppTheme>['theme'], tone: StatusTone) {
  if (tone === 'success') return { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg };
  if (tone === 'warning') return { bg: theme.colors.statusWarningBg, fg: theme.colors.statusWarningFg };
  if (tone === 'error') return { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg };
  if (tone === 'info') return { bg: theme.colors.statusInfoBg, fg: theme.colors.statusInfoFg };
  return { bg: theme.colors.statusNeutralBg, fg: theme.colors.statusNeutralFg };
}

export function KnowledgeBaseCard({ base, onPress }: KnowledgeBaseCardProps) {
  const { theme } = useAppTheme();
  const freshTone = toneColors(theme, FRESHNESS_TONE[base.fresh]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${base.name}`}
    >
      <View style={styles.top}>
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
          <Icon name={SCOPE_ICON[base.scope]} size={20} color={theme.colors.accent} />
        </View>

        <View style={styles.identity}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={1}>
            {base.name}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }} numberOfLines={1}>
            {base.scope === 'Internal' ? 'Internal · workspace-wide' : `${base.scope} · ${base.scopeId || 'unassigned'}`}
          </Text>
        </View>

        <Icon name="chevron-right" size={22} color={theme.colors.textMuted} />
      </View>

      <View style={styles.bottomRow}>
        <View style={[styles.chip, { backgroundColor: freshTone.bg, borderRadius: theme.radii.full }]}>
          <Text style={[styles.chipText, { color: freshTone.fg }]}>{FRESHNESS_LABEL[base.fresh]}</Text>
        </View>

        <View style={styles.metaItem}>
          <Icon name="description" size={13} color={theme.colors.textMuted} />
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
            {base.docs} doc{base.docs === 1 ? '' : 's'}
          </Text>
        </View>

        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginLeft: 'auto' }}>
          Indexed {base.idx}
        </Text>
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
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
