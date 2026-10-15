import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { TagChip } from '@/features/agent-teams/components/TagChip';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatRelativeTime } from '@/utils/format';

import type { MySurveyAssignment } from '../surveys.types';
import { MY_STATUS_LABEL, MY_STATUS_TONE, MY_SURVEYS_COPY, isUnread, rowActionLabel } from '../mySurveysRules';

/**
 * One assignment — web's My Surveys row (Survey with an unread dot and a
 * bold title until it is done, Status, Due, Fill in / View) as this app's
 * card. Tapping anywhere opens it.
 */
export function MySurveyCard({ assignment, onOpen }: { assignment: MySurveyAssignment; onOpen: () => void }) {
  const { theme } = useAppTheme();
  const unread = isUnread(assignment.status);
  const done = assignment.status === 'COMPLETED';
  return (
    <TouchableOpacity
      onPress={onOpen}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}
      accessibilityRole="button"
      accessibilityLabel={`${rowActionLabel(assignment.status)}: ${assignment.survey.title}`}
    >
      <View style={styles.top}>
        <View style={[styles.iconBox, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
          <Icon name="assignment" size={20} color={theme.colors.accent} />
          {unread ? <View style={[styles.dot, { backgroundColor: theme.colors.accent, borderColor: theme.colors.surface }]} accessibilityLabel={MY_SURVEYS_COPY.notCompleted} /> : null}
        </View>
        <View style={styles.identity}>
          <Text
            style={{ color: theme.colors.text, fontFamily: unread ? theme.fontFamilies.display.semibold : theme.fontFamilies.body.medium, fontSize: theme.fontSizes.md }}
            numberOfLines={2}
          >
            {assignment.survey.title}
          </Text>
          <View style={{ marginTop: 5 }}>
            <TagChip label={MY_STATUS_LABEL[assignment.status] ?? assignment.status} tone={MY_STATUS_TONE[assignment.status] ?? 'neutral'} />
          </View>
        </View>
        <Icon name="chevron-right" size={22} color={theme.colors.textMuted} />
      </View>

      {assignment.survey.description ? (
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: 10, lineHeight: 19 }} numberOfLines={2}>
          {assignment.survey.description}
        </Text>
      ) : null}

      <View style={[styles.metrics, { backgroundColor: theme.colors.statusNeutralBg, borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>DUE</Text>
          <View style={styles.metricRow}>
            <Icon name="event" size={14} color={theme.colors.textMuted} />
            <Text style={[styles.metricValue, { color: theme.colors.text }]} numberOfLines={1}>
              {assignment.dueAt ? formatRelativeTime(assignment.dueAt) : '—'}
            </Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>{done ? 'COMPLETED' : 'SENT'}</Text>
          <Text style={[styles.metricValue, { color: theme.colors.text }]} numberOfLines={1}>
            {formatRelativeTime((done && assignment.completedAt) || assignment.createdAt)}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.action,
          done
            ? { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: theme.radii.md }
            : { borderColor: theme.colors.accent + '55', backgroundColor: theme.colors.accent + '12', borderRadius: theme.radii.md },
        ]}
      >
        <Icon name={done ? 'visibility' : 'edit-note'} size={16} color={done ? theme.colors.text : theme.colors.accent} />
        <Text style={{ color: done ? theme.colors.text : theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12 }}>{rowActionLabel(assignment.status)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 16, width: '100%' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -3, right: -3, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  identity: { flex: 1, minWidth: 0 },
  metrics: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingHorizontal: 12, marginTop: 12 },
  metric: { flex: 1, gap: 3 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricLabel: { fontFamily: 'InstrumentSans_700Bold', fontSize: 10, letterSpacing: 0.4 },
  metricValue: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 13 },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: 10 },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderWidth: 1, marginTop: 12 },
});
