import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { AgentTeamSchedule } from '../agentTeams.types';
import { formatScheduleTime } from '../agentTeamsRules';
import { TagChip } from './TagChip';

interface ScheduleCardProps {
  schedule: AgentTeamSchedule;
  canSchedule: boolean;
  isRunning: boolean;
  onPause: () => void;
  onRunNow: () => void;
  onStop: () => void;
}

/** One schedule — web's `SchedulePanel` row: cadence (with the cron and
 * zone it maps to), what it asks for, status, next/last run, and Pause or
 * Resume / Run now / Stop. */
export function ScheduleCard({ schedule, canSchedule, isRunning, onPause, onRunNow, onStop }: ScheduleCardProps) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}>
      <View style={styles.top}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{schedule.preset}</Text>
          {/* Shown, never posted — the client sends the label. */}
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.mono.regular, fontSize: 11, marginTop: 2 }}>
            {schedule.cron} · {schedule.timezone}
          </Text>
        </View>
        <TagChip label={schedule.enabled ? 'active' : 'paused'} tone={schedule.enabled ? 'success' : 'neutral'} />
      </View>

      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }} numberOfLines={4}>
        {schedule.objective}
      </Text>

      <View style={styles.times}>
        <View style={styles.time}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontFamily: theme.fontFamilies.body.semibold }}>NEXT RUN</Text>
          {/* A paused schedule's stored next run would promise a run that is not coming. */}
          <Text style={{ color: theme.colors.text, fontSize: 12 }}>{schedule.enabled ? formatScheduleTime(schedule.nextRunAt) : '—'}</Text>
        </View>
        <View style={styles.time}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontFamily: theme.fontFamilies.body.semibold }}>LAST RUN</Text>
          <Text style={{ color: theme.colors.text, fontSize: 12 }}>{formatScheduleTime(schedule.lastRunAt)}</Text>
        </View>
      </View>

      {canSchedule && (
        <View style={styles.actions}>
          <Button label={schedule.enabled ? 'Pause' : 'Resume'} variant="outline" size="sm" onPress={onPause} style={{ flex: 1 }} />
          <Button label={isRunning ? 'Starting…' : 'Run now'} variant="outline" size="sm" onPress={onRunNow} disabled={isRunning} style={{ flex: 1 }} />
          <Button label="Stop" variant="danger" size="sm" onPress={onStop} style={{ flex: 1 }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  times: { flexDirection: 'row', gap: 24 },
  time: { gap: 2 },
  actions: { flexDirection: 'row', gap: 8 },
});
