import { StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatRelativeTime } from '@/utils/format';

import type { TeamMember } from '../team.types';
import { isOwnerRole, isPendingMember, removeDisabledReason, toRoleLabel } from '../teamRules';

interface MemberCardProps {
  member: TeamMember;
  team: TeamMember[];
  canInvite: boolean;
  canAssignRole: boolean;
  canRemove: boolean;
  isResending: boolean;
  isCopyingLink: boolean;
  isRemoving: boolean;
  onResend: () => void;
  onCopyLink: () => void;
  onChangeRole: () => void;
  onRemove: () => void;
}

/**
 * One member or pending invite, as a card — the mobile shape for web's
 * table row (`Team.tsx`, confirmed against that source 2026-09-04): name +
 * email, role + status chips, MFA and last-seen facts, then Resend /
 * Copy link (pending only) / Change role (hidden for Owner) / Remove.
 */
export function MemberCard({ member, team, canInvite, canAssignRole, canRemove, isResending, isCopyingLink, isRemoving, onResend, onCopyLink, onChangeRole, onRemove }: MemberCardProps) {
  const { theme } = useAppTheme();
  const pending = isPendingMember(member);
  const owner = isOwnerRole(member.role);
  const removeReason = removeDisabledReason(member, team, canRemove);
  const canShowChangeRole = canAssignRole && !owner;
  const canShowRemove = canRemove;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.md, flexShrink: 1 }} numberOfLines={1}>
          {member.name || member.email}
        </Text>
        <View style={styles.badgeRow}>
          <View style={[styles.chip, { backgroundColor: owner ? theme.colors.statusInfoBg : theme.colors.statusNeutralBg, borderRadius: theme.radii.full }]}>
            <Text style={{ color: owner ? theme.colors.statusInfoFg : theme.colors.statusNeutralFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>{toRoleLabel(member.role)}</Text>
          </View>
          {pending ? (
            <View style={[styles.chip, { backgroundColor: theme.colors.statusWarningBg, borderRadius: theme.radii.full }]}>
              <Text style={{ color: theme.colors.statusWarningFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>Invited</Text>
            </View>
          ) : null}
        </View>
      </View>

      {member.name ? (
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }} numberOfLines={1}>
          {member.email}
        </Text>
      ) : null}

      <View style={styles.facts}>
        <View style={styles.factRow}>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, flex: 1 }}>Last seen</Text>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.xs }}>{pending ? 'Invited' : member.lastLoginAt ? formatRelativeTime(member.lastLoginAt) : 'Never signed in'}</Text>
        </View>
        <View style={styles.factRow}>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, flex: 1 }}>MFA</Text>
          <View style={[styles.chip, { backgroundColor: member.mfaEnrolled ? theme.colors.statusSuccessBg : theme.colors.statusErrorBg, borderRadius: theme.radii.full }]}>
            <Text style={{ color: member.mfaEnrolled ? theme.colors.statusSuccessFg : theme.colors.statusErrorFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>
              {member.mfaEnrolled ? 'Enrolled' : 'Not enrolled'}
            </Text>
          </View>
        </View>
      </View>

      {(pending && canInvite) || canShowChangeRole || canShowRemove ? (
        <View style={[styles.actionRow, { borderTopColor: theme.colors.border }]}>
          {pending && canInvite ? <Button label="Resend" size="sm" variant="outline" icon="mail" loading={isResending} onPress={onResend} style={styles.actionButton} /> : null}
          {pending && canInvite ? <Button label="Copy link" size="sm" variant="outline" icon="content-copy" loading={isCopyingLink} onPress={onCopyLink} style={styles.actionButton} /> : null}
          {canShowChangeRole ? <Button label="Change role" size="sm" variant="outline" icon="manage-accounts" onPress={onChangeRole} style={styles.actionButton} /> : null}
          {canShowRemove ? (
            <Button
              label={pending ? 'Withdraw' : 'Remove'}
              size="sm"
              variant="danger"
              icon="person-remove"
              loading={isRemoving}
              disabled={Boolean(removeReason)}
              onPress={onRemove}
              style={styles.actionButton}
            />
          ) : null}
        </View>
      ) : null}
      {canShowRemove && removeReason ? (
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 6 }}>{removeReason}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badgeRow: { flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 2 },
  facts: { marginTop: 10, gap: 4 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 10 },
  actionButton: { flexGrow: 1, flexBasis: '47%' },
});
