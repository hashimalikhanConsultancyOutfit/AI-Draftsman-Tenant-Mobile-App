import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon, Switch } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { AgentTeamMember } from '../agentTeams.types';
import { blockedGrants, memberInitials } from '../agentTeamsRules';
import { TagChip } from './TagChip';

interface MemberCardProps {
  member: AgentTeamMember;
  canBuild: boolean;
  isSubmitting: boolean;
  onToggle: () => void;
  onRemove: () => void;
}

/**
 * One specialist — web's `MemberList` row: who it is (avatar, name), what
 * runs it (`v{n}` and the model), its capabilities and any tool grant that
 * is not READY, whether it answers in this team (Active / Off + the
 * switch), and Remove. A switched-off member stays on the revision.
 */
export function MemberCard({ member, canBuild, isSubmitting, onToggle, onRemove }: MemberCardProps) {
  const { theme } = useAppTheme();
  const grants = blockedGrants(member);
  const on = member.enabled;
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }, !on && styles.dimmed]}>
      <View style={styles.top}>
        <View style={[styles.avatar, { backgroundColor: on ? theme.colors.accent + '1A' : theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
          <Text style={{ color: on ? theme.colors.accent : theme.colors.textMuted, fontFamily: theme.fontFamilies.display.semibold, fontSize: 15 }}>{memberInitials(member.name)}</Text>
        </View>
        <View style={styles.identity}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={2}>
            {member.name}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.versionPill, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.sm }]}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>v{member.agentVersion}</Text>
            </View>
            <Icon name="memory" size={13} color={theme.colors.textMuted} />
            <Text style={{ flexShrink: 1, color: theme.colors.textMuted, fontFamily: theme.fontFamilies.mono.regular, fontSize: 11 }} numberOfLines={1}>
              {member.modelSlug}
            </Text>
          </View>
        </View>
      </View>

      {(member.capabilities.length > 0 || grants.length > 0) && (
        <View style={styles.chips}>
          {member.capabilities.map((c) => (
            <TagChip key={c} label={c} outlined />
          ))}
          {grants.map((g) => (
            <TagChip key={g.toolSlug} label={`${g.toolSlug}: ${g.status.toLowerCase()}`} tone="warning" />
          ))}
        </View>
      )}

      <View style={[styles.statusRow, { backgroundColor: theme.colors.statusNeutralBg, borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
        <View style={[styles.dot, { backgroundColor: on ? theme.colors.statusSuccessFg : theme.colors.textMuted }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: 13 }}>{on ? 'Active' : 'Off'}</Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>
            {on ? 'Answers in this team’s threads' : 'Kept on the team, but does not answer'}
          </Text>
        </View>
        <Switch value={on} onValueChange={onToggle} disabled={!canBuild || isSubmitting} accessibilityLabel={`${on ? 'Turn off' : 'Turn on'} ${member.name}`} />
      </View>

      {canBuild && (
        <TouchableOpacity
          onPress={onRemove}
          disabled={isSubmitting}
          activeOpacity={0.7}
          style={[styles.remove, { borderColor: theme.colors.error + '40', borderRadius: theme.radii.md }, isSubmitting && { opacity: 0.5 }]}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${member.name}`}
        >
          <Icon name="person-remove" size={16} color={theme.colors.error} />
          <Text style={{ color: theme.colors.error, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12 }}>Remove from team</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  dimmed: { opacity: 0.85 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1, minWidth: 0, gap: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  versionPill: { paddingHorizontal: 6, paddingVertical: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingHorizontal: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  remove: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, paddingVertical: 9 },
});
