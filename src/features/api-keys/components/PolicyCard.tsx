import { StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatMoneyCents } from '@/utils/format';

import type { KeyPolicy } from '../apiKeys.types';
import { CADENCE_LABEL, SCOPE_LABEL } from '../apiKeysRules';

interface PolicyCardProps {
  policy: KeyPolicy;
  canViewSpend: boolean;
  canManage: boolean;
  canDelete: boolean;
  isDeleting: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** One policy, as a card. Ported from web's policies table row
 * (`ApiKeys.tsx`, confirmed 2026-09-03): name + default tag, scope, spend
 * cap + cadence, rate limits, training, key count, then View / Edit /
 * Delete — Delete pre-disabled while any key still points at this policy,
 * matching web's own client-side pre-disable (the server is still the real
 * authority, via a 409 naming the count). */
export function PolicyCard({ policy, canViewSpend, canManage, canDelete, isDeleting, onView, onEdit, onDelete }: PolicyCardProps) {
  const { theme } = useAppTheme();
  const keyCount = policy._count.apiKeys;
  const deleteBlocked = keyCount > 0;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.md, flexShrink: 1 }} numberOfLines={1}>
          {policy.name}
        </Text>
        {policy.isDefault ? (
          <View style={[styles.chip, { backgroundColor: theme.colors.statusInfoBg, borderRadius: theme.radii.full }]}>
            <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>default</Text>
          </View>
        ) : null}
      </View>

      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 4 }}>{SCOPE_LABEL[policy.scopeType]}</Text>

      <View style={styles.facts}>
        {canViewSpend ? (
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.xs }}>
            {formatMoneyCents(policy.budgetMinor)} cap · resets {CADENCE_LABEL[policy.budgetResetCadence].toLowerCase()}
          </Text>
        ) : null}
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.xs }}>
          {policy.requestsPerMinute.toLocaleString('en-GB')} rpm · {policy.tokensPerMinute.toLocaleString('en-GB')} tpm
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
          {policy.allowTraining ? 'Traffic may be used for training' : 'Traffic is not used for training'}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
          {keyCount === 0 ? 'No keys on this policy' : `${keyCount} key${keyCount === 1 ? '' : 's'} on this policy`}
        </Text>
      </View>

      <View style={[styles.actionRow, { borderTopColor: theme.colors.border }]}>
        <Button label="View" size="sm" variant="outline" icon="visibility" onPress={onView} style={styles.actionButton} />
        {canManage ? <Button label="Edit" size="sm" variant="outline" icon="edit" onPress={onEdit} style={styles.actionButton} /> : null}
        {canDelete ? (
          <Button label="Delete" size="sm" variant="danger" icon="delete-outline" loading={isDeleting} disabled={deleteBlocked} onPress={onDelete} style={styles.actionButton} />
        ) : null}
      </View>
      {canDelete && deleteBlocked ? (
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 6 }}>
          Move its keys to another policy first — a policy still in use can&apos;t be deleted.
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chip: { paddingHorizontal: 8, paddingVertical: 2 },
  facts: { marginTop: 8, gap: 4 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 10 },
  actionButton: { flexGrow: 1, flexBasis: '30%' },
});
