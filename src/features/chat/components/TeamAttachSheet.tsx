import { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Checkbox, Icon, StatusTabs, useToast } from '@/components/ui';
import { useUpdateAgentTeamMutation } from '@/features/agent-teams/agentTeamsApi';
import { useGetAllKnowledgeBasesQuery } from '@/features/knowledge-bases/knowledgeBasesApi';
import { useGetConnectorInstallsQuery } from '@/features/marketplace/marketplaceApi';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import { TEAM_DETAILS_COPY, toggleAttachment } from '../teamChatRules';

interface TeamAttachSheetProps {
  visible: boolean;
  teamId: string;
  knowledgeBaseIds: string[];
  connectorInstallIds: string[];
  canEdit: boolean;
  onClose: () => void;
}

type Pane = 'knowledge' | 'connectors';

/**
 * What a team thread's team can draw on — web's composer `+` menu
 * (`TeamAttachMenu`). Each tick PATCHes the team at once, REPLACING the
 * whole list (`[]` detaches everything); attached to the TEAM means every
 * specialist sees it on every turn from here on.
 */
export function TeamAttachSheet({ visible, teamId, knowledgeBaseIds, connectorInstallIds, canEdit, onClose }: TeamAttachSheetProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [pane, setPane] = useState<Pane>('knowledge');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const kbQuery = useGetAllKnowledgeBasesQuery(undefined, { skip: !visible || pane !== 'knowledge' });
  const installsQuery = useGetConnectorInstallsQuery(undefined, { skip: !visible || pane !== 'connectors' });
  const [updateTeam] = useUpdateAgentTeamMutation();

  const toggle = async (kind: Pane, id: string) => {
    if (!canEdit) return;
    setPendingId(id);
    try {
      await updateTeam({
        id: teamId,
        body: kind === 'knowledge' ? { knowledgeBaseIds: toggleAttachment(knowledgeBaseIds, id) } : { connectorInstallIds: toggleAttachment(connectorInstallIds, id) },
      }).unwrap();
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not update what this team can draw on.'), { tone: 'error' });
    } finally {
      setPendingId(null);
    }
  };

  const tabs = [
    { value: 'knowledge', label: `${TEAM_DETAILS_COPY.knowledge} ${knowledgeBaseIds.length}` },
    { value: 'connectors', label: `${TEAM_DETAILS_COPY.connectors} ${connectorInstallIds.length}` },
  ];

  const loading = pane === 'knowledge' ? kbQuery.isLoading : installsQuery.isLoading;
  const error = pane === 'knowledge' ? kbQuery.error : installsQuery.error;
  const rows =
    pane === 'knowledge'
      ? (kbQuery.data ?? []).map((kb) => ({ id: kb.id, name: kb.name, hint: `${kb.docs} document${kb.docs === 1 ? '' : 's'}`, checked: knowledgeBaseIds.includes(kb.id), muted: false }))
      : (installsQuery.data ?? []).map((i) => ({
          id: i.id,
          name: i.connectorName,
          hint: i.status !== 'active' ? 'Disconnected — reconnect to use it' : (i.account?.login ?? i.account?.name ?? i.account?.email ?? 'Connected'),
          checked: connectorInstallIds.includes(i.id),
          muted: i.status !== 'active',
        }));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 16, borderTopLeftRadius: theme.radii.sheetTop, borderTopRightRadius: theme.radii.sheetTop }]}>
          <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          <View style={styles.header}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg, flex: 1 }}>What this team can draw on</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={22} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 20, gap: 10 }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 }}>{TEAM_DETAILS_COPY.attachedHint}</Text>
            <StatusTabs tabs={tabs} value={pane} onChange={(v) => setPane(v as Pane)} />
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            {loading ? (
              <ActivityIndicator color={theme.colors.accent} style={{ padding: 16 }} />
            ) : error ? (
              <Text style={{ color: theme.colors.error, fontSize: 13 }}>{getErrorMessage(error as never, 'Could not load the list.')}</Text>
            ) : rows.length === 0 ? (
              <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
                {pane === 'knowledge' ? 'You have no knowledge bases yet.' : 'No connectors are installed yet. Connect one from the Marketplace.'}
              </Text>
            ) : (
              rows.map((row) => (
                <View key={row.id} style={[styles.row, { borderBottomColor: theme.colors.border }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Checkbox label={row.name} checked={row.checked} disabled={!canEdit || pendingId !== null} onChange={() => void toggle(pane, row.id)} />
                    <Text style={{ color: row.muted ? theme.colors.warning : theme.colors.textMuted, fontSize: 11, marginLeft: 28, marginTop: 2 }}>{row.hint}</Text>
                  </View>
                  {pendingId === row.id && <ActivityIndicator size="small" color={theme.colors.accent} />}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '80%', paddingTop: 8 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 6, gap: 10 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
