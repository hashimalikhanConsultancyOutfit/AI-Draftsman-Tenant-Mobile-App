/**
 * PlaygroundScreen — try a system prompt against a use case before shipping
 * it as an agent. Ported from the web app's `Playground.tsx` /
 * `usePlayground.tsx` (confirmed against that source on 2026-09-03).
 *
 * ── FOUR GRANTS, FROM TWO MODULES ────────────────────────────────────────────
 *   `playground.view`  gates this screen (self-gated below, same convention
 *                      as Leads/Lead criteria — web gates it at the route).
 *   `playground.run`   runs a prompt against the model service.
 *   `agent.build`      saves a prompt as a new version, or the draft as a new
 *                      agent — an AGENT permission on purpose: both write the
 *                      agent registry, and Company agents reads the same slug.
 *   `agent.restore`    restores a historical version, which cuts a new one.
 *
 * One scoped-state pair (`promptDraft` / `responseState`) tracks the prompt
 * being edited and the last run's answer per agent, keyed by
 * `${agent.id}:${agent.prompt}` — so switching agents never carries one
 * agent's unsaved edit or stale answer onto another's card, mirroring web's
 * `AgentScopedValue`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, EmptyState, ErrorState, Loader, TextField, useToast } from '@/components/ui';
import {
  useGetAgentVersionsQuery,
  useGetAgentsQuery,
  useRestoreAgentVersionMutation,
  useUpdateAgentPromptMutation,
} from '@/features/company-agents/companyAgentsApi';
import type { Agent, AgentVersionWire } from '@/features/company-agents/companyAgents.types';
import { AGENT_PERMISSIONS, BILLING_PERMISSIONS, PLAYGROUND_PERMISSIONS, USAGE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatMoney } from '@/utils/format';

import type { PlaygroundStackParamList } from '@/navigation/types';
import { AgentRosterCard } from './components/AgentRosterCard';
import { EditPromptModal } from './components/EditPromptModal';
import { useRunPlaygroundMutation } from './playgroundApi';
import {
  AGENTS_PER_PAGE,
  ALREADY_CURRENT_MESSAGE,
  NOTHING_TO_RUN_MESSAGE,
  NO_BUILD_MESSAGE,
  NO_RESTORE_MESSAGE,
  NO_RUN_MESSAGE,
  PLAYGROUND_USE_CASE_DEFAULT,
  toPromptVersions,
} from './playgroundRules';
import type { AgentScopedValue, PlaygroundResponse } from './playground.types';
import type { EditPromptFormValues } from './schemas/editPromptSchema';

type Nav = NativeStackNavigationProp<PlaygroundStackParamList>;

export function PlaygroundScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const canView = usePermission(PLAYGROUND_PERMISSIONS.VIEW);
  const canRun = usePermission(PLAYGROUND_PERMISSIONS.RUN);
  const canBuild = usePermission(AGENT_PERMISSIONS.BUILD);
  const canRestore = usePermission(AGENT_PERMISSIONS.RESTORE);
  const canViewCost = usePermission(USAGE_PERMISSIONS.VIEW);
  const canViewPricing = usePermission(BILLING_PERMISSIONS.VIEW);

  const { data: agents, isLoading, error, refetch } = useGetAgentsQuery(undefined, { skip: !canView });

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const activeAgentId = (agents ?? []).some((a) => a.id === selectedAgentId) ? selectedAgentId : ((agents ?? [])[0]?.id ?? null);
  const activeAgent = (agents ?? []).find((a) => a.id === activeAgentId) ?? null;
  const activeAgentKey = activeAgent ? `${activeAgent.id}:${activeAgent.prompt}` : null;

  const [useCase, setUseCase] = useState(PLAYGROUND_USE_CASE_DEFAULT);
  /* A growing reveal ("Load more"), not numbered pages — matches Lead
     criteria's registry list. `agents` is the full company roster in one
     response, so "more" only ever means showing more of what's already
     loaded, never another fetch. */
  const [visibleAgentCount, setVisibleAgentCount] = useState(AGENTS_PER_PAGE);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const [promptDraft, setPromptDraft] = useState<AgentScopedValue<string>>({ agentKey: null, value: PLAYGROUND_USE_CASE_DEFAULT });
  const [responseState, setResponseState] = useState<AgentScopedValue<PlaygroundResponse | null>>({ agentKey: null, value: null });

  const promptText = promptDraft.agentKey === activeAgentKey ? promptDraft.value : (activeAgent?.prompt ?? PLAYGROUND_USE_CASE_DEFAULT);
  const response = responseState.agentKey === activeAgentKey ? responseState.value : null;

  const setPromptText = useCallback((value: string) => setPromptDraft({ agentKey: activeAgentKey, value }), [activeAgentKey]);
  const setResponse = useCallback((value: PlaygroundResponse | null) => setResponseState({ agentKey: activeAgentKey, value }), [activeAgentKey]);

  /* Version history — a growing list ("Load more"), not numbered pages,
     matching the Agents roster above and Lead criteria's own registry.
     `headPage` (always page 1, the version in force) is read separately from
     whatever has been loaded onto the growing list, same reasoning as web:
     the prompt panel's version stamp must not change just because someone
     has scrolled the history further down. */
  const [versionPage, setVersionPage] = useState(1);
  const [loadedVersions, setLoadedVersions] = useState<AgentVersionWire[]>([]);

  useEffect(() => {
    setVersionPage(1);
    setLoadedVersions([]);
  }, [activeAgentId]);

  const { data: headPage } = useGetAgentVersionsQuery(activeAgentId ? { agentId: activeAgentId, page: 1 } : skipToken);
  const { data: versionPageData, isFetching: isVersionPageFetching } = useGetAgentVersionsQuery(
    activeAgentId ? { agentId: activeAgentId, page: versionPage } : skipToken,
  );

  useEffect(() => {
    if (!versionPageData) return;
    setLoadedVersions((prev) => {
      const seen = new Set(prev.map((v) => v.id));
      const additions = versionPageData.items.filter((v) => !seen.has(v.id));
      return additions.length > 0 ? [...prev, ...additions] : prev;
    });
  }, [versionPageData]);

  const versions = useMemo(() => toPromptVersions(loadedVersions), [loadedVersions]);
  const currentVersion = useMemo(() => {
    const rows = toPromptVersions(headPage?.items ?? []);
    const pointer = activeAgent?.currentVersion ?? null;
    return (pointer !== null ? rows.find((r) => r.version === pointer) : undefined) ?? rows[0] ?? null;
  }, [headPage?.items, activeAgent?.currentVersion]);
  const versionTotal = versionPageData?.total ?? 0;
  const versionPageCount = Math.max(1, versionPageData?.totalPages ?? 1);
  const hasMoreVersions = versionPage < versionPageCount;

  const [runPlayground, { isLoading: isRunning }] = useRunPlaygroundMutation();
  const [updateAgentPrompt, { isLoading: isSavingPrompt }] = useUpdateAgentPromptMutation();
  const [restoreAgentVersion, { isLoading: isRestoring }] = useRestoreAgentVersionMutation();

  const handleSelectAgent = useCallback((agent: Agent) => setSelectedAgentId(agent.id), []);

  const handlePromptChange = useCallback(
    (next: string) => {
      setPromptText(next);
      setResponse(null);
    },
    [setPromptText, setResponse],
  );

  const handleUseCaseChange = useCallback(
    (next: string) => {
      setUseCase(next);
      setResponse(null);
    },
    [setResponse],
  );

  const canSend = canRun && Boolean(promptText.trim() && useCase.trim()) && !isRunning;

  const handleTry = useCallback(async () => {
    if (!canRun) {
      toast.show(NO_RUN_MESSAGE, { tone: 'warning' });
      return;
    }
    if (!promptText.trim() || !useCase.trim()) {
      toast.show(NOTHING_TO_RUN_MESSAGE, { tone: 'warning' });
      return;
    }
    const startedAt = Date.now();
    try {
      const result = await runPlayground({ systemPrompt: promptText.trim(), useCase: useCase.trim() }).unwrap();
      setResponse({ body: result.response, cost: 0, latencyMs: Date.now() - startedAt, citations: 0, served: result.served });
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not run that prompt.'), { tone: 'error' });
    }
  }, [canRun, promptText, useCase, runPlayground, setResponse, toast]);

  const handleSaveAsAgent = useCallback(() => {
    if (!canBuild) {
      toast.show(NO_BUILD_MESSAGE, { tone: 'warning' });
      return;
    }
    navigation.navigate('AgentForm', { initialPrompt: promptText });
  }, [canBuild, navigation, promptText, toast]);

  const handleEditPromptOpen = useCallback(
    (agent: Agent) => {
      if (!canBuild) {
        toast.show(NO_BUILD_MESSAGE, { tone: 'warning' });
        return;
      }
      setSelectedAgentId(agent.id);
      setEditingAgent(agent);
    },
    [canBuild, toast],
  );

  const handleEditPromptSubmit = useCallback(
    async (values: EditPromptFormValues) => {
      if (!editingAgent) return;
      try {
        const created = await updateAgentPrompt({ agentId: editingAgent.id, prompt: values.prompt.trim(), ...(values.note?.trim() ? { note: values.note.trim() } : {}) }).unwrap();
        setEditingAgent(null);
        setPromptText(values.prompt.trim());
        setResponse(null);
        toast.show(`Prompt saved as v${created.version}.`, { tone: 'success' });
      } catch (err) {
        toast.show(getErrorMessage(err as never, 'Could not update that prompt.'), { tone: 'error' });
      }
    },
    [editingAgent, updateAgentPrompt, setPromptText, setResponse, toast],
  );

  const handleRestore = useCallback(
    async (version: number) => {
      if (!canRestore || !activeAgentId) {
        toast.show(NO_RESTORE_MESSAGE, { tone: 'warning' });
        return;
      }
      if (version === currentVersion?.version) {
        toast.show(ALREADY_CURRENT_MESSAGE, { tone: 'neutral' });
        return;
      }
      try {
        const switched = await restoreAgentVersion({ agentId: activeAgentId, version }).unwrap();
        toast.show(`Switched to v${switched.version}.`, { tone: 'success' });
        if (switched.definition?.prompt !== undefined) {
          setPromptText(switched.definition.prompt);
          setResponse(null);
        }
      } catch (err) {
        toast.show(getErrorMessage(err as never, 'Could not switch to that version.'), { tone: 'error' });
      }
    },
    [activeAgentId, canRestore, currentVersion?.version, restoreAgentVersion, setPromptText, setResponse, toast],
  );

  if (!canView) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Playground" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />
        <View style={{ padding: 16 }}>
          <EmptyState icon="lock" title="You cannot view the playground" description={'Viewing the playground needs the "View playground" permission. Ask an owner or an admin to grant it.'} />
        </View>
      </View>
    );
  }

  const pagedAgents = (agents ?? []).slice(0, visibleAgentCount);
  const hasMoreAgents = (agents ?? []).length > visibleAgentCount;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Playground" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />

      {isLoading ? (
        <Loader fullScreen />
      ) : error ? (
        <View style={{ padding: 16 }}>
          <ErrorState message={getErrorMessage(error as never, 'Could not load the playground.')} retryLabel="Retry" onRetry={refetch} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
            Try a system prompt against a use case before you ship it as an agent.
          </Text>

          <SectionTitle>System prompt</SectionTitle>
          <Card>
            <TextField
              label={currentVersion ? currentVersion.label : undefined}
              value={promptText}
              onChangeText={handlePromptChange}
              placeholder="The system prompt — seeded from the use case, editable here."
              multiline
              numberOfLines={7}
              style={{ minHeight: 140, textAlignVertical: 'top' }}
            />
            {currentVersion ? (
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 8 }}>
                {`${currentVersion.label} · ${currentVersion.author} · ${currentVersion.at}`}
                {currentVersion.note ? `\n${currentVersion.note}` : ''}
              </Text>
            ) : null}
          </Card>

          <SectionTitle>Use case</SectionTitle>
          <Card>
            <TextField value={useCase} onChangeText={handleUseCaseChange} placeholder="Describe what you want the agent to do…" multiline numberOfLines={4} style={{ minHeight: 90, textAlignVertical: 'top' }} />
            <View style={{ height: 10 }} />
            <Button
              label="Run"
              icon="send"
              onPress={handleTry}
              loading={isRunning}
              disabled={!canSend}
              fullWidth
              accessibilityLabel={!canRun ? 'Running a prompt needs the "Run playground" permission' : undefined}
            />
          </Card>

          <SectionTitle>Response</SectionTitle>
          <Card>
            {response ? (
              <View>
                {activeAgent ? (
                  <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs, marginBottom: 8 }}>{activeAgent.name}</Text>
                ) : null}
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>{response.body}</Text>
                <View style={[styles.metaRow, { borderTopColor: theme.colors.border }]}>
                  {canViewCost ? <MetaPair label="Cost" value={formatMoney(response.cost)} /> : null}
                  <MetaPair label="Latency" value={`${response.latencyMs} ms`} />
                  <MetaPair label="Citations" value={String(response.citations)} />
                </View>
              </View>
            ) : (
              <EmptyState
                icon="forum"
                title={isRunning ? 'Running prompt…' : 'No response yet'}
                description={isRunning ? 'Waiting for the ML service.' : 'Hit Run to try the system prompt and use case.'}
              />
            )}
            {canBuild ? (
              <View style={{ marginTop: 12, alignItems: 'flex-end' }}>
                <Button label="Save as agent" variant="outline" icon="smart-toy" disabled={!promptText.trim()} onPress={handleSaveAsAgent} />
              </View>
            ) : null}
          </Card>

          <View style={styles.sectionHeadRow}>
            <SectionTitle noMargin>Agents</SectionTitle>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{`${agents?.length ?? 0} total`}</Text>
          </View>
          {pagedAgents.length === 0 ? (
            <Card>
              <EmptyState icon="smart-toy" title="No agents yet" description="Company agents you create will show up here." />
            </Card>
          ) : (
            pagedAgents.map((agent) => (
              <AgentRosterCard
                key={agent.id}
                agent={agent}
                selected={agent.id === activeAgentId}
                canViewPricing={canViewPricing}
                canBuild={canBuild}
                onSelect={() => handleSelectAgent(agent)}
                onEditPrompt={() => handleEditPromptOpen(agent)}
              />
            ))
          )}
          {hasMoreAgents ? (
            <Button label="Load more" variant="outline" onPress={() => setVisibleAgentCount((c) => c + AGENTS_PER_PAGE)} fullWidth />
          ) : null}

          <View style={styles.sectionHeadRow}>
            <SectionTitle noMargin>Version history</SectionTitle>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{`${versionTotal} versions`}</Text>
          </View>
          <Card padded={false}>
            {versions.length === 0 ? (
              <View style={{ padding: 16 }}>
                <EmptyState icon="history" title="No versions yet" description="Editing the prompt cuts the first version." />
              </View>
            ) : (
              versions.map((row, index) => (
                <View key={row.id} style={[styles.versionRow, { borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: row.id === currentVersion?.id ? theme.colors.accent : theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
                      {row.label}
                      {row.id === currentVersion?.id ? ' · current' : ''}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }} numberOfLines={2}>
                      {row.note}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }}>
                      {`${row.author} · ${row.at}`}
                    </Text>
                  </View>
                  {canRestore ? (
                    <Button
                      label={row.id === currentVersion?.id ? 'Current' : 'Restore'}
                      size="sm"
                      variant="outline"
                      disabled={isRestoring || row.id === currentVersion?.id}
                      onPress={() => handleRestore(row.version)}
                    />
                  ) : null}
                </View>
              ))
            )}
          </Card>
          {hasMoreVersions ? (
            <View style={{ marginTop: 10 }}>
              <Button label="Load more" variant="outline" loading={isVersionPageFetching} onPress={() => setVersionPage((p) => p + 1)} fullWidth />
            </View>
          ) : null}
        </ScrollView>
      )}

      {editingAgent ? (
        <EditPromptModal
          visible
          agentName={editingAgent.name}
          initialPrompt={editingAgent.id === activeAgentId ? promptText : editingAgent.prompt}
          isSubmitting={isSavingPrompt}
          onClose={() => setEditingAgent(null)}
          onSubmit={handleEditPromptSubmit}
        />
      ) : null}
    </View>
  );
}

function SectionTitle({ children, noMargin }: { children: string; noMargin?: boolean }) {
  const { theme } = useAppTheme();
  return (
    <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md, marginTop: noMargin ? 0 : 18, marginBottom: 8 }}>
      {children}
    </Text>
  );
}

function MetaPair({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{label}</Text>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 },
  metaRow: { flexDirection: 'row', gap: 18, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  versionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
});
