import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { LEAD_TYPE_TITLE, LEAD_TYPE_TONE, WON_STAGE, leadScoreTone } from '../leadsRules';
import type { Lead, StatusTone } from '../leads.types';

interface LeadCardProps {
  lead: Lead;
  canUpdate: boolean;
  onPress: () => void;
  onMove: (direction: 'forward' | 'back') => void;
  isFirstStage: boolean;
  isLastStage: boolean;
}

function toneColors(theme: ReturnType<typeof useAppTheme>['theme'], tone: StatusTone) {
  if (tone === 'success') return { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg };
  if (tone === 'danger') return { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg };
  if (tone === 'warning') return { bg: theme.colors.statusWarningBg, fg: theme.colors.statusWarningFg };
  if (tone === 'accent') return { bg: theme.colors.accent + '1A', fg: theme.colors.accent };
  if (tone === 'info' || tone === 'purple') return { bg: theme.colors.accent + '1A', fg: theme.colors.accent };
  return { bg: theme.colors.statusNeutralBg, fg: theme.colors.textMuted };
}

/** One card within a stage list. The forward/back arrows are the same
 * write the web's Kanban card carries — mobile has no drag, but the web
 * never required it either (`LeadBoardProps.onMove`). Only `back` shows
 * on Won (there is no forward past the last stage), and only `forward`
 * shows on New's "no back" edge — matching `LeadBoard`'s own arrow
 * visibility. */
export function LeadCard({ lead, canUpdate, onPress, onMove, isFirstStage, isLastStage }: LeadCardProps) {
  const { theme } = useAppTheme();
  const scoreTone = toneColors(theme, leadScoreTone(lead.score));
  const typeTone = LEAD_TYPE_TONE[lead.leadType] ? toneColors(theme, LEAD_TYPE_TONE[lead.leadType]) : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${lead.name}`}
    >
      <View style={styles.top}>
        <View style={styles.identity}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={1}>
            {lead.name}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }} numberOfLines={1}>
            {lead.src} · {lead.owner || 'Unassigned'}
          </Text>
        </View>
        <View style={[styles.chip, { backgroundColor: scoreTone.bg, borderRadius: theme.radii.full }]}>
          <Text style={{ color: scoreTone.fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>
            {lead.score === null ? 'unscored' : lead.score}
          </Text>
        </View>
      </View>

      <View style={styles.bottomRow}>
        {typeTone && (
          <View style={[styles.chip, { backgroundColor: typeTone.bg, borderRadius: theme.radii.full }]}>
            <Text style={{ color: typeTone.fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }} accessibilityLabel={LEAD_TYPE_TITLE[lead.leadType]}>
              {lead.leadType}
            </Text>
          </View>
        )}

        {canUpdate && (
          <View style={styles.arrows}>
            {!isFirstStage && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  onMove('back');
                }}
                style={[styles.arrowBtn, { borderColor: theme.colors.border, borderRadius: theme.radii.full }]}
                accessibilityRole="button"
                accessibilityLabel={lead.stage === WON_STAGE ? 'Move out of Won' : 'Move back a stage'}
              >
                <Icon name="arrow-back" size={14} color={theme.colors.text} />
              </TouchableOpacity>
            )}
            {!isLastStage && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  onMove('forward');
                }}
                style={[styles.arrowBtn, { borderColor: theme.colors.border, borderRadius: theme.radii.full }]}
                accessibilityRole="button"
                accessibilityLabel="Move forward a stage"
              >
                <Icon name="arrow-forward" size={14} color={theme.colors.text} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 14, width: '100%', gap: 10 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  identity: { flex: 1, minWidth: 0 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrows: { flexDirection: 'row', gap: 8, marginLeft: 'auto' },
  arrowBtn: { width: 28, height: 28, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
