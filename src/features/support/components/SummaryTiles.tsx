/**
 * The four inbox tiles. Ported from web's `Support.tsx` (confirmed
 * against that source 2026-09-04) onto the shared `StatTile` — the same
 * reuse-over-promotion call already made for Organization Settings (see
 * that module's spec): `StatTile` already has four call sites outside
 * its own feature folder, so a fifth import is following the codebase's
 * actual practice rather than a formal "promoted" component.
 *
 * The late-reply figure rides on the Open tickets tile's own caption
 * rather than a fifth tile: every ticket it counts is already inside
 * `open`, so it is a fact ABOUT that number, not a number of its own.
 * It is deliberately not folded into "Breaching SLA" either — that tile
 * is the first-response verdict, a different clock from the next-reply
 * one this counts.
 */
import { View } from 'react-native';

import { StatTile } from '@/features/dashboard/components/StatTile';

import type { SupportSummary } from '../support.types';

interface SummaryTilesProps {
  summary: SupportSummary;
}

export function SummaryTiles({ summary }: SummaryTilesProps) {
  const breachCaption = summary.breachingSla === 0 ? 'All within SLA' : summary.firstResponseTargetLabel ? `standard first reply within ${summary.firstResponseTargetLabel}` : 'past the first-reply promise';

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      <StatTile
        label="Open tickets"
        value={String(summary.open)}
        icon="support-agent"
        caption={summary.lateReplies > 0 ? `${summary.lateReplies} late on a reply` : undefined}
        warning={summary.lateReplies > 0}
      />
      <StatTile label="Breaching SLA" value={String(summary.breachingSla)} icon="report-problem" caption={breachCaption} warning={summary.breachingSla > 0} />
      <StatTile label="Escalated to us" value={String(summary.escalated)} icon="arrow-upward" />
      <StatTile label="Median first response" value={summary.medianFirstResponseLabel} icon="access-time" />
    </View>
  );
}
