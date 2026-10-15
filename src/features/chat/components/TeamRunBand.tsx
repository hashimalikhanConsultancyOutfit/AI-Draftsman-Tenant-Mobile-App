import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import {
  TEAM_STATUS_COPY,
  agentStateLabel,
  formatClock,
  formatTokens,
  runHeadline,
  runSubline,
  type AgentRunState,
  type TeamAgentRow,
  type TeamMeterPhase,
} from '../teamChatRules';

interface TeamRunBandProps {
  phase: TeamMeterPhase;
  isLive: boolean;
  rows: readonly TeamAgentRow[];
  teamSize: number;
  waitingName: string | null;
  startedAtMs: number | null;
  endedAtMs: number | null;
  tokensIn: number;
  tokensOut: number;
  canCancel: boolean;
  isCancelling: boolean;
  onCancel: () => void;
}

/** Ticks once a second, only while something is live. */
function useNow(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [on]);
  return now;
}

const STATE_ICON: Record<AgentRunState, IconName> = {
  done: 'check-circle',
  failed: 'error-outline',
  input: 'help-outline',
  queued: 'schedule',
  working: 'autorenew',
};

/**
 * The team's run for the latest question — web's `TeamMeterBand` and
 * `TeamStatusCard` in one card above the composer: what the team is doing
 * (or that it finished), the run clock, the tokens it has used, and one row
 * per agent working on the question. Collapsible; open by default while the
 * run is live and closed once it settles.
 */
export function TeamRunBand(props: TeamRunBandProps) {
  const { phase, isLive, rows, startedAtMs, endedAtMs, tokensIn, tokensOut, canCancel, isCancelling, onCancel } = props;
  const { theme } = useAppTheme();
  const now = useNow(isLive);
  const [open, setOpen] = useState(isLive);
  useEffect(() => setOpen(isLive), [isLive]);

  const clockMs = startedAtMs === null ? null : (isLive ? now : (endedAtMs ?? now)) - startedAtMs;
  const tone =
    phase === 'failed'
      ? { fg: theme.colors.statusErrorFg, bg: theme.colors.statusErrorBg }
      : phase === 'needs-you'
        ? { fg: theme.colors.statusWarningFg, bg: theme.colors.statusWarningBg }
        : phase === 'ready'
          ? { fg: theme.colors.statusSuccessFg, bg: theme.colors.statusSuccessBg }
          : { fg: theme.colors.accent, bg: theme.colors.accent + '14' };
  const icon: IconName = phase === 'ready' ? 'local-fire-department' : phase === 'failed' ? 'error-outline' : phase === 'stopped' ? 'stop-circle' : phase === 'needs-you' ? 'pan-tool' : 'groups';
  const allSettled = rows.length > 0 && rows.every((r) => r.state === 'done' || r.state === 'failed');

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}>
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        disabled={rows.length === 0}
        style={styles.head}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={runHeadline(props)}
      >
        <View style={[styles.iconBox, { backgroundColor: tone.bg, borderRadius: theme.radii.md }]}>
          {isLive && phase !== 'needs-you' ? <ActivityIndicator size="small" color={tone.fg} /> : <Icon name={icon} size={18} color={tone.fg} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleRow}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm, flexShrink: 1 }} numberOfLines={1}>
              {runHeadline(props)}
            </Text>
            {clockMs !== null && <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.mono.regular, fontSize: 11 }}>{formatClock(clockMs)}</Text>}
          </View>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 1 }} numberOfLines={2}>
            {runSubline(props)}
          </Text>
        </View>
        {rows.length > 0 && <Icon name={open ? 'expand-less' : 'expand-more'} size={20} color={theme.colors.textMuted} />}
      </TouchableOpacity>

      <View style={styles.metaRow}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: 12 }}>
          ↑ {formatTokens(tokensIn)} · ↓ {formatTokens(tokensOut)}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{isLive ? 'this run so far' : 'this run'}</Text>
        {isLive && canCancel && (
          <TouchableOpacity onPress={onCancel} disabled={isCancelling} style={styles.stop} accessibilityRole="button" accessibilityLabel="Stop this run">
            <Icon name="stop" size={14} color={theme.colors.error} />
            <Text style={{ color: theme.colors.error, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12 }}>{isCancelling ? 'Stopping…' : 'Stop run'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {open && rows.length > 0 && (
        <View style={[styles.rows, { borderTopColor: theme.colors.border }]}>
          {rows.map((row) => {
            const failed = row.state === 'failed';
            const stateText =
              row.state === 'working' && row.startedAtUnixMs !== null ? `${agentStateLabel('working')} · ${formatClock(now - row.startedAtUnixMs)}` : agentStateLabel(row.state);
            return (
              <View key={row.agentId} style={styles.agentRow}>
                <Icon name={STATE_ICON[row.state]} size={16} color={row.state === 'done' ? theme.colors.success : failed ? theme.colors.error : row.state === 'input' ? theme.colors.warning : theme.colors.textMuted} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: 13 }} numberOfLines={1}>
                    {row.agentName ?? TEAM_STATUS_COPY.unnamed}
                  </Text>
                  {row.step ? (
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11 }} numberOfLines={1}>
                      {row.step}
                      {row.totalSteps > 1 ? ` · ${TEAM_STATUS_COPY.stepCount(row.doneSteps, row.totalSteps)}` : ''}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ color: failed ? theme.colors.error : theme.colors.textMuted, fontSize: 11, fontFamily: theme.fontFamilies.body.medium }}>{stateText}</Text>
              </View>
            );
          })}
          {isLive && <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2 }}>{allSettled ? TEAM_STATUS_COPY.footDone : TEAM_STATUS_COPY.foot}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, marginHorizontal: 16, marginBottom: 8, padding: 12, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 44 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' },
  rows: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 8 },
  agentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
