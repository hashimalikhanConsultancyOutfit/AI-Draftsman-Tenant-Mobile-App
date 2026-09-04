import { StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { RoleSummary } from '../roles.types';
import { FULL_ACCESS_LABEL, SYSTEM_ROLE_BLOCKED_MESSAGE, SYSTEM_ROLE_DELETE_BLOCKED_MESSAGE, canDeleteRoleRow, canEditRoleRow, isOwnerRoleRow, systemRoleCaption } from '../rolesRules';

interface RoleCardProps {
  role: RoleSummary;
  canUpdate: boolean;
  canDelete: boolean;
  viewerIsOwner: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * One role, as a card — the mobile shape for web's table row (`Roles.tsx`,
 * confirmed against that source 2026-09-04): name + system badge,
 * description, Full Access tag or permission count, member count, then
 * Edit/Delete — each gated by `canEditRoleRow`/`canDeleteRoleRow` rather
 * than the raw `canUpdate`/`canDelete` grants, since a system row can
 * override or refuse those independent of what the caller otherwise holds.
 */
export function RoleCard({ role, canUpdate, canDelete, viewerIsOwner, isDeleting, onEdit, onDelete }: RoleCardProps) {
  const { theme } = useAppTheme();
  const owner = isOwnerRoleRow(role);
  const canShowEdit = canEditRoleRow(role, canUpdate, viewerIsOwner);
  const canShowDelete = canDeleteRoleRow(role, canDelete);
  const caption = systemRoleCaption(role, viewerIsOwner, owner);
  const blockedEditNote = !canShowEdit && canUpdate && role.isSystem ? SYSTEM_ROLE_BLOCKED_MESSAGE : null;
  const blockedDeleteNote = !canShowDelete && canDelete && role.isSystem ? SYSTEM_ROLE_DELETE_BLOCKED_MESSAGE : null;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.md, flexShrink: 1 }} numberOfLines={1}>
          {role.name}
        </Text>
        {role.isSystem ? (
          <View style={[styles.chip, { backgroundColor: owner ? theme.colors.statusInfoBg : theme.colors.statusNeutralBg, borderRadius: theme.radii.full }]}>
            <Text style={{ color: owner ? theme.colors.statusInfoFg : theme.colors.statusNeutralFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>System</Text>
          </View>
        ) : null}
      </View>

      {role.description ? (
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }} numberOfLines={2}>
          {role.description}
        </Text>
      ) : null}

      <View style={styles.facts}>
        <View style={styles.factRow}>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, flex: 1 }}>Permissions</Text>
          {role.fullAccess ? (
            <View style={[styles.chip, { backgroundColor: theme.colors.statusInfoBg, borderRadius: theme.radii.full }]}>
              <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>{FULL_ACCESS_LABEL}</Text>
            </View>
          ) : (
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.xs }}>
              {role.permissionCount} {role.permissionCount === 1 ? 'permission' : 'permissions'}
            </Text>
          )}
        </View>
        <View style={styles.factRow}>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, flex: 1 }}>Members</Text>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.xs }}>{role.memberCount}</Text>
        </View>
      </View>

      {caption ? <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 8 }}>{caption}</Text> : null}

      {canShowEdit || canShowDelete ? (
        <View style={[styles.actionRow, { borderTopColor: theme.colors.border }]}>
          {canShowEdit ? <Button label="Edit" size="sm" variant="outline" icon="edit" onPress={onEdit} style={styles.actionButton} /> : null}
          {canShowDelete ? <Button label="Delete" size="sm" variant="danger" icon="delete" loading={isDeleting} onPress={onDelete} style={styles.actionButton} /> : null}
        </View>
      ) : null}
      {blockedEditNote ? <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 6 }}>{blockedEditNote}</Text> : null}
      {!blockedEditNote && blockedDeleteNote ? <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 6 }}>{blockedDeleteNote}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chip: { paddingHorizontal: 8, paddingVertical: 2 },
  facts: { marginTop: 10, gap: 4 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 10 },
  actionButton: { flexGrow: 1, flexBasis: '47%' },
});
