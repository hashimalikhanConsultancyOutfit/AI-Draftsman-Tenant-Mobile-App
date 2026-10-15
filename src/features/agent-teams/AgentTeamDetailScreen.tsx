import { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, EmptyState, ErrorState, Icon, Loader, StatusTabs, useToast } from '@/components/ui';
import type { AgentTeamsStackParamList } from '@/navigation/types';
import { AGENT_TEAM_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { AgentTeamMember, AgentTeamSchedule } from './agentTeams.types';
import {
  useDeleteAgentTeamScheduleMutation,
  useGetAgentTeamQuery,
  useGetAgentTeamSchedulesQuery,
  useRemoveAgentTeamMemberMutation,
  useRunAgentTeamScheduleNowMutation,
  useUpdateAgentTeamMemberMutation,
  useUpdateAgentTeamScheduleMutation,
} from './agentTeamsApi';
import { MEMBER_COPY, SCHEDULE_COPY, detailChatLabel, hierarchyRows, teamChatTarget, toAgentTeamRow } from './agentTeamsRules';
import { MemberCard } from './components/MemberCard';
import { ScheduleCard } from './components/ScheduleCard';
import { TagChip } from './components/TagChip';
import { openNewTeamChat, openTeamConversation } from './openTeamConversation';

type Nav = NativeStackNavigationProp<AgentTeamsStackParamList>;
type Rt = RouteProp<AgentTeamsStackParamList, 'AgentTeamDetail'>;
type Tab = 'members' | 'schedules';

const TABS = [
  { value: 'members', label: 'Members' },
  { value: 'schedules', label: 'Schedules' },
];

/**
 * One team — web's `AgentTeamBuilder` (`/agent-teams/:id`): a header with
 * the revision and the Chat button, then two tabs. Members lists the
 * specialists (enable switch, Remove, Add specialist) and the reporting
 * line; Schedules lists the team's recurring runs (Pause/Resume, Run now,
 * Stop, Add schedule).
 */
export function AgentTeamDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const canBuild = usePermission(AGENT_TEAM_PERMISSIONS.BUILD);
  const canSchedule = usePermission(AGENT_TEAM_PERMISSIONS.SCHEDULE);

  const [tab, setTab] = useState<Tab>('members');

  const { data: team, isLoading, isFetching, error, refetch } = useGetAgentTeamQuery(params.id);
  /* Fetched only while the Schedules tab is open, as on web. */
  const schedulesQuery = useGetAgentTeamSchedulesQuery(params.id, { skip: tab !== 'schedules' });

  const [removeMember, { isLoading: isRemoving }] = useRemoveAgentTeamMemberMutation();
  const [updateMember, { isLoading: isUpdating }] = useUpdateAgentTeamMemberMutation();
  const [updateSchedule] = useUpdateAgentTeamScheduleMutation();
  const [deleteSchedule] = useDeleteAgentTeamScheduleMutation();
  const [runScheduleNow] = useRunAgentTeamScheduleNowMutation();
  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);

  const isMemberSubmitting = isRemoving || isUpdating;
  const hierarchy = useMemo(() => (team ? hierarchyRows(team) : []), [team]);
  const title = team?.name ?? params.name ?? 'Team';

  const handleChat = () => {
    if (!team) return;
    const target = teamChatTarget(toAgentTeamRow(team));
    if (target.kind === 'thread') openTeamConversation(navigation, target.conversationId, team.name);
    else openNewTeamChat(navigation as never, target.agentIds);
  };

  const handleToggleMember = async (member: AgentTeamMember) => {
    try {
      await updateMember({ teamId: params.id, memberId: member.id, enabled: !member.enabled }).unwrap();
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not update that member.'), { tone: 'error' });
    }
  };

  const handleRemoveMember = (member: AgentTeamMember) => {
    Alert.alert(MEMBER_COPY.removeTitle(member.name), MEMBER_COPY.removeBody, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember({ teamId: params.id, memberId: member.id }).unwrap();
            toast.show(MEMBER_COPY.removed(member.name), { tone: 'success' });
          } catch (err) {
            toast.show(getErrorMessage(err as never, 'Could not remove that member.'), { tone: 'error' });
          }
        },
      },
    ]);
  };

  const handleToggleSchedule = async (schedule: AgentTeamSchedule) => {
    try {
      await updateSchedule({ teamId: params.id, scheduleId: schedule.id, enabled: !schedule.enabled }).unwrap();
      toast.show(schedule.enabled ? SCHEDULE_COPY.paused : SCHEDULE_COPY.resumed, { tone: 'success' });
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not update that schedule.'), { tone: 'error' });
    }
  };

  const handleRunNow = async (schedule: AgentTeamSchedule) => {
    setRunningScheduleId(schedule.id);
    try {
      await runScheduleNow({ teamId: params.id, scheduleId: schedule.id }).unwrap();
      toast.show(SCHEDULE_COPY.runStarted, { tone: 'success' });
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not start that run.'), { tone: 'error' });
    } finally {
      setRunningScheduleId(null);
    }
  };

  const handleStopSchedule = (schedule: AgentTeamSchedule) => {
    Alert.alert(SCHEDULE_COPY.stopTitle(schedule.preset), SCHEDULE_COPY.stopBody, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: SCHEDULE_COPY.stopConfirm,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSchedule({ teamId: params.id, scheduleId: schedule.id }).unwrap();
            /* "Stopped", not "deleted": the thread and its past runs stay. */
            toast.show(SCHEDULE_COPY.stopped, { tone: 'success' });
          } catch (err) {
            toast.show(getErrorMessage(err as never, 'Could not stop that schedule.'), { tone: 'error' });
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={title} mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (error || !team) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={title} mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message={getErrorMessage(error as never, 'This team could not be loaded.')} onRetry={refetch} />
      </View>
    );
  }

  const schedules = schedulesQuery.data ?? [];

  const membersTab = (
    <>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold }]}>Members</Text>
        {canBuild && <Button label="Add specialist" icon="add" size="sm" variant="outline" onPress={() => navigation.navigate('AgentTeamAddMember', { teamId: team.id })} />}
      </View>

      {team.specialists.length === 0 ? (
        <EmptyState icon="group-add" title={MEMBER_COPY.emptyTitle} description={MEMBER_COPY.emptyDescription} />
      ) : (
        team.specialists.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            canBuild={canBuild}
            isSubmitting={isMemberSubmitting}
            onToggle={() => void handleToggleMember(member)}
            onRemove={() => handleRemoveMember(member)}
          />
        ))
      )}

      <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, marginTop: 8 }]}>Reporting line</Text>
      <Card style={{ gap: 10 }}>
        {hierarchy.length === 0 ? (
          <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.sm }}>Nobody on this team yet.</Text>
        ) : (
          hierarchy.map((row) => (
            <View key={`${row.role}:${row.agentId}`} style={[styles.hierarchyRow, row.role === 'SPECIALIST' && styles.hierarchyChild]}>
              {row.role === 'SPECIALIST' && <Icon name="subdirectory-arrow-right" size={16} color={theme.colors.textMuted} />}
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <View style={styles.hierarchyName}>
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontFamily: row.role === 'SUPERVISOR' ? theme.fontFamilies.body.semibold : theme.fontFamilies.body.regular,
                      fontSize: theme.fontSizes.sm,
                      flexShrink: 1,
                    }}
                  >
                    {row.name}
                  </Text>
                  {row.role === 'SUPERVISOR' && <TagChip label="coordinator" tone="info" outlined />}
                  {/* A disabled member stays in the diagram — it is still on the revision. */}
                  {!row.enabled && <TagChip label="disabled" />}
                </View>
                {row.capabilities.length > 0 && <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{row.capabilities.join(' · ')}</Text>}
              </View>
            </View>
          ))
        )}
      </Card>
    </>
  );

  const schedulesTab = (
    <>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold }]}>{SCHEDULE_COPY.title}</Text>
        {canSchedule && <Button label="Add schedule" icon="add" size="sm" variant="outline" onPress={() => navigation.navigate('AgentTeamScheduleForm', { teamId: team.id })} />}
      </View>

      {schedulesQuery.isLoading ? (
        <Loader label="Loading schedules…" />
      ) : schedulesQuery.error ? (
        <ErrorState message={getErrorMessage(schedulesQuery.error as never, 'Schedules could not be loaded.')} onRetry={schedulesQuery.refetch} />
      ) : schedules.length === 0 ? (
        <EmptyState icon="schedule" title={SCHEDULE_COPY.emptyTitle} description={SCHEDULE_COPY.empty} />
      ) : (
        <>
          {/* Stated on the panel, not in a tooltip: a recurring run spends
              money with nobody watching. */}
          <View style={[styles.callout, { backgroundColor: theme.colors.statusWarningBg, borderRadius: theme.radii.lg }]}>
            <Icon name="warning-amber" size={18} color={theme.colors.statusWarningFg} />
            <Text style={{ color: theme.colors.statusWarningFg, fontSize: theme.fontSizes.xs, lineHeight: 17, flex: 1 }}>
              <Text style={{ fontFamily: theme.fontFamilies.body.semibold }}>{SCHEDULE_COPY.spendTitle} </Text>
              {SCHEDULE_COPY.spendNote}
            </Text>
          </View>
          {schedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              canSchedule={canSchedule}
              isRunning={runningScheduleId === schedule.id}
              onPause={() => void handleToggleSchedule(schedule)}
              onRunNow={() => void handleRunNow(schedule)}
              onStop={() => handleStopSchedule(schedule)}
            />
          ))}
        </>
      )}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={team.name} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => {
              void refetch();
              if (tab === 'schedules') void schedulesQuery.refetch();
            }}
            tintColor={theme.colors.accent}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <View style={styles.headerName}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg, flexShrink: 1 }}>{team.name}</Text>
              {team.origin === 'THREAD' && <TagChip label="From chat" tone="info" outlined />}
            </View>
            <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.xs }}>Revision {team.currentRevision}</Text>
          </View>
          <Button label={detailChatLabel(team.origin)} icon="chat-bubble-outline" variant="outline" size="sm" onPress={handleChat} />
        </View>

        {team.purpose && team.purpose !== team.name ? (
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{team.purpose}</Text>
        ) : null}

        <StatusTabs tabs={TABS} value={tab} onChange={(v) => setTab(v as Tab)} />

        {tab === 'members' ? membersTab : schedulesTab}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerName: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { fontSize: 15 },
  hierarchyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  hierarchyChild: { paddingLeft: 8 },
  hierarchyName: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  callout: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12 },
});
