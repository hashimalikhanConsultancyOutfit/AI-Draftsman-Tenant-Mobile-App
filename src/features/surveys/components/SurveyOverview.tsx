import { StyleSheet, Text, View } from 'react-native';

import { ErrorState, Loader } from '@/components/ui';
import { TagChip } from '@/features/agent-teams/components/TagChip';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatRelativeTime } from '@/utils/format';

import { useGetSurveyDashboardQuery } from '../surveysApi';
import type { Survey } from '../surveys.types';
import {
  ASSIGNMENT_STATUS_LABEL,
  ASSIGNMENT_STATUS_ORDER,
  ASSIGNMENT_STATUS_TONE,
  DASHBOARD_COPY,
  RUN_STATUS_LABEL,
  RUN_STATUS_TONE,
  SCHEDULE_COPY,
  dashboardStats,
  formatDate,
} from '../surveysRules';
import { Muted, Panel } from './Panel';

/** The Overview tab — web's `SurveyDashboard`: stat tiles, assignments by
 * status, and the most recent runs. */
export function SurveyOverview({ survey }: { survey: Survey }) {
  const { theme } = useAppTheme();
  const { data, isLoading, isError, refetch } = useGetSurveyDashboardQuery(survey.id, { refetchOnMountOrArgChange: true });

  if (isLoading) return <Loader />;
  if (isError || !data) return <ErrorState title={DASHBOARD_COPY.error} message="The workflow service did not answer. Try again in a moment." onRetry={refetch} />;

  const stats = dashboardStats(data, survey.evaluationMode);
  return (
    <View style={{ gap: 14 }}>
      <View style={styles.tiles}>
        {stats.map((s) => (
          <View key={s.label} style={[styles.tile, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.medium, fontSize: 12 }}>{s.label}</Text>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: 22, marginTop: 4 }}>{s.value}</Text>
          </View>
        ))}
      </View>

      <Panel title={DASHBOARD_COPY.byStatus}>
        <View style={styles.chips}>
          {ASSIGNMENT_STATUS_ORDER.map((k) => (
            <TagChip key={k} label={`${ASSIGNMENT_STATUS_LABEL[k]}: ${data.byStatus?.[k] ?? 0}`} tone={ASSIGNMENT_STATUS_TONE[k]} />
          ))}
        </View>
      </Panel>

      <Panel title={DASHBOARD_COPY.recentRuns(data.lastRunAt ? formatRelativeTime(data.lastRunAt) : null)}>
        {(data.recentRuns ?? []).length === 0 ? (
          <Muted>{SCHEDULE_COPY.runsEmptyBody}</Muted>
        ) : (
          (data.recentRuns ?? []).map((run) => (
            <View key={run.id} style={[styles.run, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
              <View style={styles.runTop}>
                <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: 13 }}>{`Due ${formatDate(run.dueAt)}`}</Text>
                <TagChip label={RUN_STATUS_LABEL[run.status] ?? run.status} tone={RUN_STATUS_TONE[run.status] ?? 'neutral'} />
              </View>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{`Fired ${run.firedAt ? formatRelativeTime(run.firedAt) : '—'} · ${run.eligibleCount} eligible · ${run.skippedCount} skipped`}</Text>
            </View>
          ))
        )}
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  run: { borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 4 },
  runTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
