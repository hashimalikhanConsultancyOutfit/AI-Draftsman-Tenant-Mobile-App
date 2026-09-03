import { StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatMoneyCents, formatPercent, formatRelativeTime } from '@/utils/format';

import type { ApiKey } from '../apiKeys.types';
import { ENV_LABEL, STATUS_LABEL, STATUS_TONE, SCOPE_LABEL, displayStatus, formatCountdown, isRotationOpen, maskPrefix } from '../apiKeysRules';

interface ApiKeyCardProps {
  apiKey: ApiKey;
  nowMs: number;
  canViewSpend: boolean;
  canEdit: boolean;
  canRotate: boolean;
  canRevoke: boolean;
  isRotating: boolean;
  isRevoking: boolean;
  onOpenUsage: () => void;
  onEdit: () => void;
  onRotate: () => void;
  onRevoke: () => void;
}

function Fact({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.factRow}>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, flex: 1 }}>{label}</Text>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.xs, flexShrink: 1, textAlign: 'right' }} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/**
 * One key, as a card — the mobile shape for web's table row. Ported from
 * `ApiKeys.tsx` (confirmed against that source, and `useApiKeys.tsx`'s
 * `ApiKeyRow` derivation, on 2026-09-03): name + env + status, prefix,
 * policy, usage-vs-cap, rate limits, last used, then the action row.
 *
 * `displayStatus` (not the raw `status`) drives the badge — a ROTATING row
 * whose window has silently closed while the screen sat open must not keep
 * reading as mid-rotation, so the caller re-derives it every tick against
 * `nowMs` rather than this card holding its own clock.
 */
export function ApiKeyCard({ apiKey, nowMs, canViewSpend, canEdit, canRotate, canRevoke, isRotating, isRevoking, onOpenUsage, onEdit, onRotate, onRevoke }: ApiKeyCardProps) {
  const { theme } = useAppTheme();
  const status = displayStatus(apiKey.status, apiKey.previousValidUntil, nowMs);
  const tone = STATUS_TONE[status];
  const toneColors =
    tone === 'success'
      ? { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg }
      : tone === 'error'
        ? { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg }
        : { bg: theme.colors.statusWarningBg, fg: theme.colors.statusWarningFg };

  const cap = apiKey.policy.budgetMinor;
  const used = apiKey.usage.costMinor;
  const percent = cap > 0 ? Math.min(100, (used / cap) * 100) : 100;
  const rotationOpen = status === 'ROTATING' && isRotationOpen(apiKey.previousValidUntil, nowMs);

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.md, flexShrink: 1 }} numberOfLines={1}>
          {apiKey.name}
        </Text>
        <View style={styles.badgeRow}>
          <View style={[styles.chip, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.full }]}>
            <Text style={{ color: theme.colors.statusNeutralFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>{ENV_LABEL[apiKey.environment]}</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: toneColors.bg, borderRadius: theme.radii.full }]}>
            <Text style={{ color: toneColors.fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>{STATUS_LABEL[status]}</Text>
          </View>
        </View>
      </View>

      {apiKey.customer ? (
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }}>Scoped to {apiKey.customer.name}</Text>
      ) : null}

      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.xs, marginTop: 6 }}>{maskPrefix(apiKey.prefix)}</Text>

      {rotationOpen ? (
        <Text style={{ color: theme.colors.statusWarningFg, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.xs, marginTop: 4 }}>
          old secret works for another {formatCountdown(new Date(apiKey.previousValidUntil as string).getTime() - nowMs)}
        </Text>
      ) : null}

      <View style={styles.facts}>
        <Fact label="Policy" value={`${apiKey.policy.name}${apiKey.policy.isDefault ? ' (default)' : ''} · ${SCOPE_LABEL[apiKey.policy.scopeType]}`} />
        {canViewSpend ? <Fact label="Usage vs cap" value={`${formatMoneyCents(used)} of ${formatMoneyCents(cap)} · ${formatPercent(percent)}`} /> : null}
        <Fact label="Limits" value={`${apiKey.policy.requestsPerMinute.toLocaleString('en-GB')} rpm · ${apiKey.policy.tokensPerMinute.toLocaleString('en-GB')} tpm`} />
        <Fact label="Last used" value={apiKey.lastUsedAt ? formatRelativeTime(apiKey.lastUsedAt) : 'Never used'} />
      </View>

      <View style={[styles.actionRow, { borderTopColor: theme.colors.border }]}>
        <Button label="Usage" size="sm" variant="outline" icon="bar-chart" onPress={onOpenUsage} style={styles.actionButton} />
        {canEdit ? <Button label="Edit" size="sm" variant="outline" icon="edit" onPress={onEdit} style={styles.actionButton} disabled={status === 'REVOKED'} /> : null}
        {canRotate ? (
          <Button label="Rotate" size="sm" variant="outline" icon="autorenew" loading={isRotating} onPress={onRotate} style={styles.actionButton} disabled={status === 'REVOKED'} />
        ) : null}
        {canRevoke ? (
          /* `danger`, not `outline` — the one action here that can't be undone
           * is deliberately the one that doesn't look like the others. */
          <Button label="Revoke" size="sm" variant="danger" icon="block" loading={isRevoking} onPress={onRevoke} style={styles.actionButton} disabled={status === 'REVOKED'} />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badgeRow: { flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 2 },
  facts: { marginTop: 10, gap: 4 },
  factRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 10 },
  actionButton: { flexGrow: 1, flexBasis: '47%' },
});
