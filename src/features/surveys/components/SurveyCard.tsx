import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { TagChip } from '@/features/agent-teams/components/TagChip';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatRelativeTime } from '@/utils/format';

import type { Survey } from '../surveys.types';
import { EVALUATION_LABEL, STATUS_LABEL, STATUS_TONE, SURVEYS_COPY } from '../surveysRules';

/**
 * One survey — web's list row (title, description, status tag,
 * Evaluation, Created, View) laid out as this app's card: identity row
 * with the status, the description, a metric strip and a View action.
 * Tapping anywhere on the card opens the survey too.
 */
export function SurveyCard({ survey, onOpen }: { survey: Survey; onOpen: () => void }) {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onOpen}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${survey.title}`}
    >
      <View style={styles.top}>
        <View style={[styles.iconBox, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
          <Icon name="poll" size={20} color={theme.colors.accent} />
        </View>
        <View style={styles.identity}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={2}>
            {survey.title}
          </Text>
          <View style={{ marginTop: 5 }}>
            <TagChip label={STATUS_LABEL[survey.status] ?? survey.status} tone={STATUS_TONE[survey.status] ?? 'neutral'} />
          </View>
        </View>
        <Icon name="chevron-right" size={22} color={theme.colors.textMuted} />
      </View>

      {survey.description ? (
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: 10, lineHeight: 19 }} numberOfLines={2}>
          {survey.description}
        </Text>
      ) : null}

      <View style={[styles.metrics, { backgroundColor: theme.colors.statusNeutralBg, borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>EVALUATION</Text>
          <View style={styles.metricRow}>
            <Icon name={survey.evaluationMode === 'AI' ? 'auto-awesome' : 'rate-review'} size={14} color={theme.colors.textMuted} />
            <Text style={[styles.metricValue, { color: theme.colors.text }]}>{EVALUATION_LABEL[survey.evaluationMode] ?? survey.evaluationMode}</Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>CREATED</Text>
          <Text style={[styles.metricValue, { color: theme.colors.text }]} numberOfLines={1}>
            {formatRelativeTime(survey.createdAt)}
          </Text>
        </View>
      </View>

      <View style={[styles.action, { borderColor: theme.colors.accent + '55', backgroundColor: theme.colors.accent + '12', borderRadius: theme.radii.md }]}>
        <Icon name="visibility" size={15} color={theme.colors.accent} />
        <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12 }}>{SURVEYS_COPY.view}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 16, width: '100%' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1, minWidth: 0 },
  metrics: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingHorizontal: 12, marginTop: 12 },
  metric: { flex: 1, gap: 3 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricLabel: { fontFamily: 'InstrumentSans_700Bold', fontSize: 10, letterSpacing: 0.4 },
  metricValue: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 13 },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: 10 },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderWidth: 1, marginTop: 12 },
});
