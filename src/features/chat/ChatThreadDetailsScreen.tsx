import type { SerializedError } from '@reduxjs/toolkit';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMemo, useState } from 'react';

import { AppHeader } from '@/components/shell/AppHeader';
import { Card, EmptyState, ErrorState, Icon, Loader, useToast } from '@/components/ui';
import { useGetAllKnowledgeBasesQuery } from '@/features/knowledge-bases/knowledgeBasesApi';
import { useGetAgentTeamQuery } from '@/features/agent-teams/agentTeamsApi';
import { AGENT_TEAM_PERMISSIONS, CHAT_PERMISSIONS, USAGE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import type { ApiQueryError } from '@/store/baseQuery';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatMoneyCents, formatNumber } from '@/utils/format';
import type { ChatConversationStackParamList } from '@/navigation/types';

import type { ChatModelOption } from './chat.types';
import {
  NO_ACCESS_BODY,
  NO_ACCESS_TITLE,
  agentDisplayName,
  formatPurgeDate,
  formatRetentionPolicy,
  threadDisplayName,
} from './chatRules';
import {
  useGetChatBalanceQuery,
  useGetChatModelsQuery,
  useGetChatThreadQuery,
  useSetChatThreadModelMutation,
} from './chatApi';
import { SetKnowledgeBaseSheet } from './components/SetKnowledgeBaseSheet';
import { TeamAttachSheet } from './components/TeamAttachSheet';
import {
  RUN_STATUS_LABEL,
  TEAM_DETAILS_COPY,
  agentStateLabel,
  formatClock,
  formatTokens,
  isTeamThread,
  microCentsToCents,
  runHeadline,
} from './teamChatRules';
import { useGetThreadTeamRunsQuery } from './teamRunApi';
import { useTeamRun } from './useTeamRun';

type Nav = NativeStackNavigationProp<ChatConversationStackParamList>;
type Rt = RouteProp<ChatConversationStackParamList, 'ChatThreadDetails'>;

const BLOCKED_REASON_LABEL: Record<NonNullable<ChatModelOption['blockedReason']>, string> = {
  HIDDEN_BY_TENANT_POLICY: 'Hidden by workspace policy',
  DEPRECATED: 'No longer available',
};

/**
 * The web's 320px right-hand rail, given its own screen (D-1). Three read
 * surfaces live here — model, retention, cost — plus the one control that
 * belongs on a "details" screen rather than a quick-action sheet: changing
 * the model. `chat.manage` controls are HIDDEN when absent, never shown
 * disabled (docs/chat-module-spec.md §3); cost figures are ABSENT from the
 * tree for a role that cannot see them, never rendered as a zero.
 */
export function ChatThreadDetailsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const canView = usePermission(CHAT_PERMISSIONS.VIEW);
  const canManage = usePermission(CHAT_PERMISSIONS.MANAGE);
  const canViewCost = usePermission(USAGE_PERMISSIONS.VIEW);

  const [kbSheetOpen, setKbSheetOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const canEditTeam = usePermission(AGENT_TEAM_PERMISSIONS.BUILD);

  const threadQuery = useGetChatThreadQuery(params.conversationId, { skip: !canView });
  const modelsQuery = useGetChatModelsQuery(params.conversationId, { skip: !canView });
  const balanceQuery = useGetChatBalanceQuery(params.conversationId, { skip: !canView || !canViewCost });
  const kbQuery = useGetAllKnowledgeBasesQuery(undefined, { skip: !canView });
  const [setModel, { isLoading: isSettingModel }] = useSetChatThreadModelMutation();

  const thread = threadQuery.data;

  /* ── Team threads: the team, its latest run, and every run ──────────── */
  const isTeam = isTeamThread(thread);
  const teamQuery = useGetAgentTeamQuery(thread?.agentTeamId ?? '', { skip: !isTeam });
  const team = teamQuery.data;
  const agentNames = useMemo(() => Object.fromEntries((team?.specialists ?? []).map((m) => [m.agentId, m.name])), [team]);
  const teamRun = useTeamRun({ conversationId: params.conversationId, enabled: isTeam, turnPending: false, agentNames });
  const runsQuery = useGetThreadTeamRunsQuery({ conversationId: params.conversationId }, { skip: !isTeam });
  const notNeeded = (team?.specialists ?? []).filter((m) => !teamRun.rows.some((r) => r.agentId === m.agentId));
  const knowledgeBaseName = thread?.knowledgeBaseId
    ? (kbQuery.data ?? []).find((kb) => kb.id === thread.knowledgeBaseId)?.name ?? 'Assigned'
    : 'None';

  const handleSelectModel = async (option: ChatModelOption) => {
    if (!option.allowed || option.modelSlug === modelsQuery.data?.selectedModelSlug) return;
    try {
      await setModel({ conversationId: params.conversationId, modelSlug: option.modelSlug }).unwrap();
      toast.show(`Model set to ${option.displayName}.`, { tone: 'success' });
    } catch (err) {
      toast.show(getErrorMessage(err as ApiQueryError | SerializedError, 'Could not change the model for this thread.'), {
        tone: 'error',
      });
    }
  };

  if (!canView) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Thread details" mode="stack" onBack={() => navigation.goBack()} />
        <EmptyState icon="lock-outline" title={NO_ACCESS_TITLE} description={NO_ACCESS_BODY} />
      </View>
    );
  }

  if (threadQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Thread details" mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (threadQuery.error || !thread) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Thread details" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState
          message={threadQuery.error ? 'Could not load this thread.' : 'This thread no longer exists.'}
          onRetry={threadQuery.error ? threadQuery.refetch : undefined}
        />
      </View>
    );
  }

  const title = threadDisplayName(thread.title);
  const models = modelsQuery.data;
  const currentModelLabel = models?.selectedModelSlug
    ? models.items.find((m) => m.modelSlug === models.selectedModelSlug)?.displayName ?? models.selectedModelSlug
    : thread.mode === 'AGENT'
      ? 'From the agent'
      : 'Workspace default';

  const conversationCost = balanceQuery.data?.conversation;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Thread details" mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <Card>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.bold, fontSize: theme.fontSizes.lg }}>
            {title}
          </Text>
          {thread.agentId && (
            <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginTop: 4 }}>
              {agentDisplayName(thread.agentName)}
              {thread.agentVersion !== null ? ` · v${thread.agentVersion}` : ''}
              {thread.agentDeleted ? ' · deleted' : ''}
            </Text>
          )}
          {isTeam && (
            <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginTop: 4 }}>
              {thread.agentTeamName || 'Team'}
              {team ? ` · ${team.specialists.length} agent${team.specialists.length === 1 ? '' : 's'}` : ''}
            </Text>
          )}
          <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 6 }}>
            {thread.purpose === 'SUPPORT' ? 'Support conversation' : 'General conversation'} · {thread.messageCount} messages
          </Text>
        </Card>

        <SectionLabel text="MODEL" />
        {isTeam ? (
          <Card elevated>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 }}>{TEAM_DETAILS_COPY.model}</Text>
          </Card>
        ) : (
        <Card elevated padded={false} style={{ borderRadius: theme.radii.xl, overflow: 'hidden' }}>
          <View style={[styles.row, { paddingVertical: 14 }]}>
            <Icon name="smart-toy" size={16} color={theme.colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 10.5, fontFamily: theme.fontFamilies.body.semibold, letterSpacing: 0.5 }}>
                CURRENT MODEL
              </Text>
              <Text style={{ color: theme.colors.text, fontSize: 14.5, marginTop: 2 }}>
                {modelsQuery.isLoading ? 'Loading…' : currentModelLabel}
              </Text>
            </View>
          </View>

          {canManage && models && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 8 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                {models.allowedCount} of {models.totalCount} models available on this workspace
              </Text>
              {models.items.map((option) => {
                const selected = option.modelSlug === models.selectedModelSlug;
                return (
                  <TouchableOpacity
                    key={option.modelSlug}
                    disabled={!option.allowed || isSettingModel}
                    onPress={() => handleSelectModel(option)}
                    style={[
                      styles.modelOption,
                      {
                        borderColor: selected ? theme.colors.accent : theme.colors.border,
                        borderRadius: theme.radii.md,
                        opacity: option.allowed ? 1 : 0.5,
                      },
                    ]}
                  >
                    <Icon
                      name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={18}
                      color={selected ? theme.colors.accent : theme.colors.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontSize: 13.5 }}>{option.displayName}</Text>
                      {!option.allowed && option.blockedReason && (
                        <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                          {BLOCKED_REASON_LABEL[option.blockedReason]}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Card>

        )}

        {isTeam ? (
          <>
            <SectionLabel text={TEAM_DETAILS_COPY.attachedLabel} />
            <Card elevated padded={false} style={{ borderRadius: theme.radii.xl, overflow: 'hidden' }}>
              <TouchableOpacity disabled={!team} onPress={() => setAttachOpen(true)} style={[styles.row, { paddingVertical: 14 }]}>
                <Icon name="attach-file" size={16} color={theme.colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 14.5 }}>
                    {TEAM_DETAILS_COPY.knowledge}: {TEAM_DETAILS_COPY.attachedCount(team?.knowledgeBaseIds.length ?? 0)}
                  </Text>
                  <Text style={{ color: theme.colors.text, fontSize: 14.5, marginTop: 2 }}>
                    {TEAM_DETAILS_COPY.connectors}: {TEAM_DETAILS_COPY.attachedCount(team?.connectorInstallIds.length ?? 0)}
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </Card>

            <SectionLabel text={TEAM_DETAILS_COPY.runLabel} />
            <Card elevated>
              {!teamRun.runId ? (
                <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>{TEAM_DETAILS_COPY.noRuns}</Text>
              ) : (
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: 14, flex: 1 }}>
                      {runHeadline({ phase: teamRun.phase, rows: teamRun.rows, teamSize: team?.specialists.length ?? 0, waitingName: null })}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{TEAM_DETAILS_COPY.onQuestion(teamRun.rows.length, team?.specialists.length ?? teamRun.rows.length)}</Text>
                  </View>
                  <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.mono.regular, fontSize: 12 }}>
                    ↑ {formatTokens(teamRun.tokensIn)} · ↓ {formatTokens(teamRun.tokensOut)}
                    {canViewCost && teamRun.costMicroCents !== null ? ` · ${formatMoneyCents(microCentsToCents(teamRun.costMicroCents))}` : ''}
                  </Text>
                  {teamRun.rows.map((row) => (
                    <View key={row.agentId} style={styles.agentRow}>
                      <Text style={{ color: theme.colors.text, fontSize: 13, flex: 1 }} numberOfLines={1}>{row.agentName ?? 'Specialist'}</Text>
                      <Text style={{ color: row.state === 'failed' ? theme.colors.error : theme.colors.textMuted, fontSize: 12 }}>{agentStateLabel(row.state)}</Text>
                    </View>
                  ))}
                  {teamRun.rows.length > 0 && notNeeded.length > 0 && (
                    <Text style={[styles.sectionTitle, { color: theme.colors.textMuted, marginLeft: 0, marginTop: 4 }]}>{TEAM_DETAILS_COPY.notNeeded(notNeeded.length)}</Text>
                  )}
                  {(teamRun.rows.length > 0 ? notNeeded : team?.specialists ?? []).map((m) => (
                    <View key={m.agentId} style={styles.agentRow}>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 13, flex: 1 }} numberOfLines={1}>{m.name}</Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{agentStateLabel('idle')}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            <SectionLabel text={TEAM_DETAILS_COPY.runsLabel} />
            <Card elevated padded={false} style={{ borderRadius: theme.radii.xl, overflow: 'hidden' }}>
              {(runsQuery.data?.items ?? []).length === 0 ? (
                <View style={{ padding: 16 }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>{runsQuery.isLoading ? 'Loading…' : TEAM_DETAILS_COPY.noRuns}</Text>
                </View>
              ) : (
                (runsQuery.data?.items ?? []).map((run, index, all) => {
                  const start = run.startedAt ? Date.parse(run.startedAt) : NaN;
                  const end = run.finishedAt ? Date.parse(run.finishedAt) : NaN;
                  const duration = Number.isFinite(start) && Number.isFinite(end) ? formatClock(end - start) : '—';
                  const when = run.startedAt ? new Date(run.startedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
                  return (
                    <DetailRow
                      key={run.id}
                      icon={run.status === 'SUCCEEDED' ? 'check-circle' : run.status === 'FAILED' || run.status === 'TIMED_OUT' ? 'error-outline' : 'autorenew'}
                      label={`RUN ${all.length - index} · ${when.toUpperCase()}`}
                      value={`${RUN_STATUS_LABEL[run.status] ?? run.status} · ${duration}${canViewCost && run.costMicroCents !== null ? ` · ${formatMoneyCents(microCentsToCents(run.costMicroCents))}` : ''}`}
                      last={index === all.length - 1}
                    />
                  );
                })
              )}
            </Card>
          </>
        ) : (
          <>
        <SectionLabel text="KNOWLEDGE BASE" />
        <Card elevated padded={false} style={{ borderRadius: theme.radii.xl, overflow: 'hidden' }}>
          <TouchableOpacity
            disabled={!canManage}
            onPress={() => setKbSheetOpen(true)}
            style={[styles.row, { paddingVertical: 14 }]}
          >
            <Icon name="menu-book" size={16} color={theme.colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 10.5, fontFamily: theme.fontFamilies.body.semibold, letterSpacing: 0.5 }}>
                ASSIGNED KNOWLEDGE BASE
              </Text>
              <Text style={{ color: theme.colors.text, fontSize: 14.5, marginTop: 2 }}>{knowledgeBaseName}</Text>
            </View>
            {canManage && <Icon name="chevron-right" size={18} color={theme.colors.textMuted} />}
          </TouchableOpacity>
        </Card>

          </>
        )}

        <SectionLabel text="RETENTION" />
        <Card elevated padded={false} style={{ borderRadius: theme.radii.xl, overflow: 'hidden' }}>
          {thread.retention ? (
            <>
              <DetailRow icon="schedule" label="POLICY" value={formatRetentionPolicy(thread.retention)} />
              <DetailRow icon="event-busy" label="THIS THREAD'S PURGE DATE" value={formatPurgeDate(thread.retention)} last={!canViewCost} />
              <DetailRow
                icon="school"
                label="TRAINING"
                value={thread.retention.trainingAllowed ? 'Allowed on this thread' : 'Not allowed'}
                last
              />
            </>
          ) : (
            <View style={{ padding: 16 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>Retention details are not available.</Text>
            </View>
          )}
        </Card>

        {canViewCost && (
          <>
            <SectionLabel text="COST" />
            <Card elevated padded={false} style={{ borderRadius: theme.radii.xl, overflow: 'hidden' }}>
              {balanceQuery.isLoading ? (
                <View style={{ padding: 16 }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>Loading…</Text>
                </View>
              ) : conversationCost ? (
                <>
                  <DetailRow
                    icon="payments"
                    label="TOTAL SPEND"
                    value={formatMoneyCents(conversationCost.totalCostCents, balanceQuery.data?.currency)}
                  />
                  <DetailRow icon="token" label="TOTAL TOKENS" value={formatNumber(conversationCost.totalTokens)} />
                  <DetailRow
                    icon="receipt-long"
                    label="PRICED TURNS"
                    value={`${conversationCost.pricedTurns} of ${conversationCost.messageCount} messages`}
                    last
                  />
                </>
              ) : (
                <View style={{ padding: 16 }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>No priced turns yet.</Text>
                </View>
              )}
            </Card>
          </>
        )}
      </ScrollView>

      {kbSheetOpen && <SetKnowledgeBaseSheet thread={thread} onClose={() => setKbSheetOpen(false)} />}
      {isTeam && team && (
        <TeamAttachSheet
          visible={attachOpen}
          teamId={team.id}
          knowledgeBaseIds={team.knowledgeBaseIds}
          connectorInstallIds={team.connectorInstallIds}
          canEdit={canEditTeam}
          onClose={() => setAttachOpen(false)}
        />
      )}
    </View>
  );
}

function SectionLabel({ text }: { text: string }) {
  const { theme } = useAppTheme();
  return (
    <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>{text}</Text>
  );
}

function DetailRow({
  icon,
  label,
  value,
  last,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  value: string;
  last?: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.row,
        { paddingVertical: 14 },
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
      ]}
    >
      <Icon name={icon} size={16} color={theme.colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 10.5, fontFamily: theme.fontFamilies.body.semibold, letterSpacing: 0.5 }}>
          {label}
        </Text>
        <Text style={{ color: theme.colors.text, fontSize: 14.5, marginTop: 2 }}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  sectionTitle: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 12, letterSpacing: 0.6, marginLeft: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  agentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modelOption: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, padding: 10 },
});
