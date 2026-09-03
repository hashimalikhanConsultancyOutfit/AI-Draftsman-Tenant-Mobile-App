/**
 * ReportCard — one scheduled report in the registry. Ported from the web
 * app's `Reports.tsx` table row, restacked as a card: name + state up top,
 * the schedule/grouping/delivery/last-run facts, then a wrapped action row.
 * Each action is shown only when this session holds its grant — Logs is
 * unconditional, since reading a report's history needs only `report.view`,
 * already checked by the screen this card lives on.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { Report } from '../reports.types';
import { REPORT_STATE_TONE } from '../reportsRules';

interface ReportCardProps {
  report: Report;
  canRun: boolean;
  canManage: boolean;
  canDelete: boolean;
  isRunning: boolean;
  onOpenLogs: () => void;
  onRunNow: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ReportCard({ report, canRun, canManage, canDelete, isRunning, onOpenLogs, onRunNow, onEdit, onDelete }: ReportCardProps) {
  const { theme } = useAppTheme();
  const tone = REPORT_STATE_TONE[report.state] ?? 'neutral';
  const toneColors =
    tone === 'success'
      ? { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg }
      : tone === 'error'
        ? { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg }
        : { bg: theme.colors.statusNeutralBg, fg: theme.colors.textMuted };

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.xl, borderWidth: theme.borders.hairline, borderColor: theme.colors.border }]}>
      <View style={styles.head}>
        <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={2}>
          {report.name}
        </Text>
        <View style={[styles.stateChip, { backgroundColor: toneColors.bg, borderRadius: theme.radii.full }]}>
          <Text style={{ color: toneColors.fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }} numberOfLines={1}>
            {report.state}
          </Text>
        </View>
      </View>

      <View style={styles.facts}>
        <Fact label="Schedule" value={report.sched} />
        <Fact label="Group by" value={report.dims || '—'} />
        <Fact label="Delivery" value={report.dest} />
        <Fact label="Last run" value={report.last} />
      </View>

      <View style={[styles.actionRow, { borderTopColor: theme.colors.border }]}>
        <Button label="Logs" size="sm" variant="outline" icon="history" onPress={onOpenLogs} style={styles.actionButton} />
        {canRun ? <Button label="Run now" size="sm" variant="outline" icon="play-arrow" loading={isRunning} disabled={isRunning} onPress={onRunNow} style={styles.actionButton} /> : null}
        {canManage ? <Button label="Edit" size="sm" variant="outline" icon="edit" onPress={onEdit} style={styles.actionButton} /> : null}
        {/* `danger`, not `outline` — the one action here that can't be undone
            is deliberately the one that doesn't look like the other three. */}
        {canDelete ? <Button label="Delete" size="sm" variant="danger" icon="delete-outline" onPress={onDelete} style={styles.actionButton} /> : null}
      </View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.factRow}>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, width: 78 }}>{label}</Text>
      <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stateChip: { paddingHorizontal: 9, paddingVertical: 3 },
  facts: { gap: 4 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  /* Even 2-column grid regardless of how many of the four actions this
   * session holds — natural-width buttons wrapped 3-then-1, leaving a lone
   * button stranded on its own row with the rest of it empty. */
  actionButton: { flexGrow: 1, flexBasis: '47%' },
});
