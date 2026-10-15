import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button, EmptyState, ErrorState, Loader } from '@/components/ui';
import { TagChip } from '@/features/agent-teams/components/TagChip';
import type { SurveysStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatRelativeTime } from '@/utils/format';

import { useGetSurveyRunsQuery, useGetSurveyScheduleQuery } from '../surveysApi';
import type { Survey, SurveyRun } from '../surveys.types';
import { RUN_STATUS_LABEL, RUN_STATUS_TONE, SCHEDULE_COPY, appendUnique, formatDate, formatDateTime } from '../surveysRules';
import { Muted, Panel } from './Panel';

type Nav = NativeStackNavigationProp<SurveysStackParamList>;

/**
 * Scheduled delivery and its runs — web's `SurveySchedule`. The schedule
 * form itself opens as a modal route (`SurveyScheduleForm`), the
 * convention every create/edit form in this app follows.
 */
export function SurveyScheduleSection({ survey }: { survey: Survey }) {
  const { theme } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const scheduleQuery = useGetSurveyScheduleQuery(survey.id);
  const schedule = scheduleQuery.data ?? null;

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [runs, setRuns] = useState<SurveyRun[]>([]);
  const runsQuery = useGetSurveyRunsQuery({ id: survey.id, cursor });
  useEffect(() => {
    if (runsQuery.data) setRuns((prev) => (cursor ? appendUnique(prev, runsQuery.data!.items) : runsQuery.data!.items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runsQuery.data]);

  const openForm = () => navigation.navigate('SurveyScheduleForm', { surveyId: survey.id });

  const line = (label: string, value: string) => <Muted key={label}>{`${label}: ${value}`}</Muted>;

  return (
    <View style={{ gap: 14 }}>
      <Panel
        title={SCHEDULE_COPY.title}
        action={schedule ? <Button label={SCHEDULE_COPY.edit} size="sm" variant="outline" onPress={openForm} /> : undefined}
      >
        {scheduleQuery.isLoading ? (
          <Loader />
        ) : scheduleQuery.isError ? (
          <ErrorState title={SCHEDULE_COPY.loadFailed} message="The workflow service did not answer. Try again in a moment." onRetry={scheduleQuery.refetch} />
        ) : !schedule ? (
          <>
            <Muted>{SCHEDULE_COPY.none}</Muted>
            <Button label={SCHEDULE_COPY.add} icon="event" onPress={openForm} />
          </>
        ) : (
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <TagChip label={schedule.mode === 'ONE_TIME' ? SCHEDULE_COPY.oneTime : SCHEDULE_COPY.recurring} tone="info" />
              <TagChip label={schedule.enabled ? SCHEDULE_COPY.active : SCHEDULE_COPY.inactive} tone={schedule.enabled ? 'success' : 'neutral'} />
            </View>
            {line(SCHEDULE_COPY.timezone, schedule.timezone)}
            {schedule.mode === 'RECURRING' && schedule.cron ? line(SCHEDULE_COPY.cron, schedule.cron) : null}
            {schedule.enabled && schedule.nextRunAt ? line(SCHEDULE_COPY.nextRun, `${formatDateTime(schedule.nextRunAt)} (${formatRelativeTime(schedule.nextRunAt)})`) : null}
            {schedule.occurrenceLimit ? <Muted>{SCHEDULE_COPY.fired(schedule.occurrencesFired, schedule.occurrenceLimit)}</Muted> : null}
            {schedule.endAt ? line(SCHEDULE_COPY.ends, formatDate(schedule.endAt)) : null}
          </View>
        )}
      </Panel>

      <Panel title={SCHEDULE_COPY.runsTitle}>
        {runsQuery.isLoading ? (
          <Loader />
        ) : runsQuery.isError && runs.length === 0 ? (
          <ErrorState title={SCHEDULE_COPY.runsError} message="The workflow service did not answer. Try again in a moment." onRetry={runsQuery.refetch} />
        ) : runs.length === 0 ? (
          <EmptyState icon="history" title={SCHEDULE_COPY.runsEmptyTitle} description={SCHEDULE_COPY.runsEmptyBody} />
        ) : (
          <View style={{ gap: 8 }}>
            {runs.map((run) => (
              <View key={run.id} style={[styles.run, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
                <View style={styles.runTop}>
                  <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: 13 }}>{`Due ${formatDate(run.dueAt)}`}</Text>
                  <TagChip label={RUN_STATUS_LABEL[run.status] ?? run.status} tone={RUN_STATUS_TONE[run.status] ?? 'neutral'} />
                </View>
                <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12 }}>
                  {`Fired ${run.firedAt ? formatRelativeTime(run.firedAt) : '—'} · ${run.eligibleCount} eligible · ${run.skippedCount} skipped`}
                </Text>
              </View>
            ))}
            {runsQuery.data?.hasMore ? (
              <Button label="Load more" variant="outline" loading={runsQuery.isFetching} onPress={() => runsQuery.data?.nextCursor && setCursor(runsQuery.data.nextCursor)} fullWidth />
            ) : null}
          </View>
        )}
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  run: { borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 4 },
  runTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
