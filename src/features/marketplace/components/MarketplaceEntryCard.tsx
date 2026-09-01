import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { CLONE_COPY, formatDate } from '../marketplaceRules';
import type { ClonedEntryRecord, MarketplaceEntry, MarketplaceResource } from '../marketplace.types';

interface MarketplaceEntryCardProps {
  entry: MarketplaceEntry;
  resource: MarketplaceResource;
  saved?: ClonedEntryRecord;
  installed: boolean;
  pending: boolean;
  canClone: boolean;
  onPress: () => void;
  onClone: () => void;
}

/** Skill/agent marketplace browse tile — monogram-only (no artwork). */
export function MarketplaceEntryCard({ entry, resource, saved, installed, pending, canClone, onPress, onClone }: MarketplaceEntryCardProps) {
  const { theme } = useAppTheme();
  const copy = CLONE_COPY[resource];
  const done = Boolean(saved) || installed;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${entry.name}`}
    >
      <View style={styles.top}>
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
          <Icon name={resource === 'agent' ? 'smart-toy' : 'extension'} size={20} color={theme.colors.accent} />
        </View>
        <View style={styles.identity}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={1}>
            {entry.name}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }} numberOfLines={2}>
            {entry.description || 'No description provided.'}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={[styles.categoryChip, { backgroundColor: theme.colors.statusInfoBg }]}>
          <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }} numberOfLines={1}>
            {entry.category?.name ?? '—'}
          </Text>
        </View>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, flex: 1 }} numberOfLines={1}>
          Updated {formatDate(entry.updatedAt)}
        </Text>

        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            // Always fires, even without permission or mid-request — the
            // hook itself toasts why, which is the only way to explain a
            // disabled control on a device with no hover/tooltip.
            if (!done) onClone();
          }}
          disabled={done}
          style={[
            styles.cloneBtn,
            {
              backgroundColor: done ? theme.colors.statusSuccessBg : theme.colors.accent + (pending || !canClone ? '55' : ''),
              borderRadius: theme.radii.full,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={done ? copy.saved : copy.cloneLabel(entry.name)}
        >
          <Icon name={done ? 'check' : 'add'} size={16} color={done ? theme.colors.statusSuccessFg : theme.colors.textOnAccent} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 14, width: '100%' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconCircle: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1, minWidth: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  categoryChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, maxWidth: 140 },
  cloneBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
});
