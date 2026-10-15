import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Switch } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { AgentTeamMember } from '../agentTeams.types';
import { blockedGrants, memberVersionLine } from '../agentTeamsRules';
import { TagChip } from './TagChip';

interface MemberCardProps {
  member: AgentTeamMember;
  canBuild: boolean;
  isSubmitting: boolean;
  onToggle: () => void;
  onRemove: () => void;
}

/** One specialist — web's `MemberList` row: name, `v{n} · model`, its
 * capabilities, any tool grant that is not READY, the enable switch and
 * Remove. A disabled member stays on the team's revision. */
export function MemberCard({ member, canBuild, isSubmitting, onToggle, onRemove }: MemberCardProps) {
  const { theme } = useAppTheme();
  const grants = blockedGrants(member);
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}>
      <View style={styles.top}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }} numberOfLines={2}>
            {member.name}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.mono.regular, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
            {memberVersionLine(member)}
          </Text>
        </View>
        <Switch value={member.enabled} onValueChange={onToggle} disabled={!canBuild || isSubmitting} accessibilityLabel={`Enable ${member.name}`} />
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

      {canBuild && (
        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          {!member.enabled && <TagChip label="disabled" />}
          <TouchableOpacity onPress={onRemove} disabled={isSubmitting} style={[styles.remove, isSubmitting && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel={`Remove ${member.name}`}>
            <Text style={{ color: theme.colors.error, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12 }}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  remove: { marginLeft: 'auto', paddingVertical: 2 },
});
