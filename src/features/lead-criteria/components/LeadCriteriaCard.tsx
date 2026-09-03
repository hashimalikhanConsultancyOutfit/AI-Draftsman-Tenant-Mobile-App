import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { buildFacetPreview, buildHeadcountLabel, type LeadCriteriaRow } from '../leadCriteriaRules';

interface LeadCriteriaCardProps {
  row: LeadCriteriaRow;
  canEdit: boolean;
  onEdit: () => void;
  onManageRules: () => void;
  onDelete: () => void;
}

export function LeadCriteriaCard({ row, canEdit, onEdit, onManageRules, onDelete }: LeadCriteriaCardProps) {
  const { theme } = useAppTheme();
  const facets = buildFacetPreview(row);
  const isArchived = row.status === 'ARCHIVED';
  const statusTone = isArchived ? { bg: theme.colors.statusNeutralBg, fg: theme.colors.textMuted } : { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg };

  return (
    <TouchableOpacity onPress={onManageRules} activeOpacity={0.75} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}>
      <View style={styles.top}>
        <View style={styles.identity}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={1}>
            {row.name}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }} numberOfLines={2}>
            {row.description}
          </Text>
        </View>
        <View style={[styles.chip, { backgroundColor: statusTone.bg, borderRadius: theme.radii.full }]}>
          <Text style={{ color: statusTone.fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>{isArchived ? 'Archived' : 'Active'}</Text>
        </View>
      </View>

      {facets.chips.length > 0 && (
        <View style={styles.facetRow}>
          {facets.chips.map((chip) => (
            <View key={chip} style={[styles.facetChip, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.full }]}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 11 }} numberOfLines={1}>
                {chip}
              </Text>
            </View>
          ))}
          {facets.overflowLabels.length > 0 && (
            <View style={[styles.facetChip, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.full }]}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>+{facets.overflowLabels.length}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.metricRow}>
        <View style={styles.metric}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>RULES</Text>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: 13 }}>{row.ruleCount}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>MIN SCORE</Text>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: 13 }}>{row.minScore}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>EMPLOYEES</Text>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: 13 }}>{buildHeadcountLabel(row.employeeCountMin, row.employeeCountMax)}</Text>
        </View>
        <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginLeft: 'auto' }}>{row.updated}</Text>
      </View>

      {canEdit && (
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={onEdit} style={styles.actionBtn} accessibilityRole="button" accessibilityLabel={`Edit ${row.name}`}>
            <Icon name="edit" size={16} color={theme.colors.textMuted} />
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onManageRules} style={styles.actionBtn} accessibilityRole="button" accessibilityLabel={`Manage rules for ${row.name}`}>
            <Icon name="rule" size={16} color={theme.colors.textMuted} />
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Rules</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.actionBtn} accessibilityRole="button" accessibilityLabel={`Delete ${row.name}`}>
            <Icon name="delete" size={16} color={theme.colors.error} />
            <Text style={{ color: theme.colors.error, fontSize: 12 }}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 14, width: '100%', gap: 10 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  identity: { flex: 1, minWidth: 0 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  facetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  facetChip: { paddingHorizontal: 8, paddingVertical: 3 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  metric: { gap: 2 },
  actionRow: { flexDirection: 'row', gap: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)', paddingTop: 10, marginTop: 2 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
