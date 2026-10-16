import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { memberInitials, type HierarchyRow } from '../agentTeamsRules';
import { TagChip } from './TagChip';

/**
 * The reporting line as a tree: the team (or its coordinator, on an older
 * team that still has one) at the top, each specialist hanging off it on a
 * connector. A switched-off member stays in the tree, marked "off".
 */
export function ReportingLine({ teamName, rows }: { teamName: string; rows: readonly HierarchyRow[] }) {
  const { theme } = useAppTheme();
  const supervisor = rows.find((r) => r.role === 'SUPERVISOR');
  const specialists = rows.filter((r) => r.role === 'SPECIALIST');
  const line = theme.colors.border;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}>
      {/* Root */}
      <View style={styles.node}>
        <View style={[styles.rootIcon, { backgroundColor: theme.colors.accent, borderRadius: theme.radii.md }]}>
          <Icon name={supervisor ? 'support-agent' : 'account-tree'} size={18} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }} numberOfLines={1}>
            {supervisor ? supervisor.name : teamName}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{supervisor ? 'Coordinator' : 'Plans the work and writes the final answer'}</Text>
        </View>
      </View>

      {specialists.length === 0 ? (
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.sm, marginTop: 10, marginLeft: 4 }}>Nobody on this team yet.</Text>
      ) : (
        <View style={styles.children}>
          {specialists.map((row, i) => {
            const last = i === specialists.length - 1;
            return (
              <View key={row.agentId} style={styles.childRow}>
                {/* Connector: vertical trunk (stops at the last child) + elbow */}
                <View style={styles.connector}>
                  <View style={[styles.trunk, { backgroundColor: line }, last && styles.trunkLast]} />
                  <View style={[styles.elbow, { backgroundColor: line }]} />
                </View>
                <View style={[styles.child, { borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.background }, !row.enabled && { opacity: 0.6 }]}>
                  <View style={[styles.childAvatar, { backgroundColor: theme.colors.accent + '1A', borderRadius: theme.radii.sm }]}>
                    <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>{memberInitials(row.name)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }} numberOfLines={1}>
                      {row.name}
                    </Text>
                    {row.capabilities.length > 0 ? (
                      <Text style={{ color: theme.colors.textMuted, fontSize: 11 }} numberOfLines={1}>
                        {row.capabilities.join(' · ')}
                      </Text>
                    ) : (
                      <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>Specialist</Text>
                    )}
                  </View>
                  {!row.enabled && <TagChip label="off" />}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const ROOT = 36;
const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  node: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rootIcon: { width: ROOT, height: ROOT, alignItems: 'center', justifyContent: 'center' },
  children: { marginTop: 4, marginLeft: ROOT / 2 - 1 },
  childRow: { flexDirection: 'row', alignItems: 'stretch' },
  connector: { width: 22 },
  trunk: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 2 },
  trunkLast: { bottom: '50%' },
  elbow: { position: 'absolute', left: 0, top: '50%', width: 18, height: 2 },
  child: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingHorizontal: 12, marginVertical: 5 },
  childAvatar: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
