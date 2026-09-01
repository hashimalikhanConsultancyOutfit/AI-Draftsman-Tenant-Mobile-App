import { useEffect, useState } from 'react';
import type { SerializedError } from '@reduxjs/toolkit';
import { skipToken } from '@reduxjs/toolkit/query';
import * as Clipboard from 'expo-clipboard';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Icon, Loader, useToast, type IconName } from '@/components/ui';
import { AGENT_PERMISSIONS, BILLING_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import type { ApiQueryError } from '@/store/baseQuery';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatMoney } from '@/utils/format';

import type { CompanyAgentsStackParamList } from '@/navigation/types';
import {
  buildDeleteWarning,
  buildDetailRows,
  buildEvaluationBadge,
  formatAgentVersion,
  hasPassedGate,
  isClonedAgent,
  isCloneOutBlocked,
  isPublishBlocked,
} from './agentRules';
import {
  useDeleteAgentMutation,
  useEvaluateAgentMutation,
  useGetAgentEvaluationQuery,
  useGetAgentsQuery,
  usePublishAgentMutation,
} from './companyAgentsApi';

type Nav = NativeStackNavigationProp<CompanyAgentsStackParamList>;
type Rt = RouteProp<CompanyAgentsStackParamList, 'AgentDetail'>;

const FIELD_ICONS: Record<string, IconName> = {
  prompt: 'notes',
  model: 'smart-toy',
  tools: 'build',
  kb: 'menu-book',
  marketplace: 'storefront',
  creator: 'person-outline',
  memory: 'memory',
  support: 'support-agent',
  price: 'payments',
  evaluation: 'fact-check',
};

export function AgentDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const canBuild = usePermission(AGENT_PERMISSIONS.BUILD);
  const canEvaluate = usePermission(AGENT_PERMISSIONS.EVALUATE);
  const canPublish = usePermission(AGENT_PERMISSIONS.PUBLISH);
  const canClone = usePermission(AGENT_PERMISSIONS.CLONE);
  const canDelete = usePermission(AGENT_PERMISSIONS.DELETE);
  const canViewPricing = usePermission(BILLING_PERMISSIONS.VIEW);

  const { data: agents, isLoading, error, refetch } = useGetAgentsQuery();
  const agent = agents?.find((a) => a.id === params.id) ?? null;

  const [evaluateAgent, { isLoading: isStartingEval }] = useEvaluateAgentMutation();
  const [publishAgent, { isLoading: isPublishing }] = usePublishAgentMutation();
  const [deleteAgent, { isLoading: isDeleting }] = useDeleteAgentMutation();

  const [evalRunId, setEvalRunId] = useState<string | null>(null);
  const { data: evalRun } = useGetAgentEvaluationQuery(
    evalRunId && agent ? { id: agent.id, evalRunId } : skipToken,
    { pollingInterval: 4000 },
  );

  const isEvaluating = Boolean(evalRunId) && (!evalRun || evalRun.status === 'RUNNING');

  useEffect(() => {
    if (evalRun && evalRun.status !== 'RUNNING') {
      setEvalRunId(null);
      void refetch();
      toast.show(
        evalRun.passed ? `Evaluation passed — ${evalRun.score.toFixed(1)}` : `Evaluation finished — ${evalRun.score.toFixed(1)}, below the publish gate`,
        { tone: evalRun.passed ? 'success' : 'warning' },
      );
    }
  }, [evalRun, refetch, toast]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Agent" mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (error || !agent) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Agent" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message={error ? 'Could not load this agent.' : 'This agent no longer exists.'} onRetry={error ? refetch : undefined} />
      </View>
    );
  }

  const cloned = isClonedAgent(agent);
  const rows = buildDetailRows(agent, canViewPricing);
  const badge = buildEvaluationBadge(agent.score);
  const badgeTone =
    badge.tone === 'success'
      ? { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg }
      : { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg };

  const handleEvaluate = async () => {
    try {
      const run = await evaluateAgent({ id: agent.id, environment: 'sandbox' }).unwrap();
      setEvalRunId(run.evalRunId);
      if (run.status !== 'RUNNING') {
        void refetch();
      }
    } catch (err) {
      toast.show(getErrorMessage(err as ApiQueryError | SerializedError, 'Could not start the evaluation.'), { tone: 'error' });
    }
  };

  const handlePublish = async () => {
    try {
      await publishAgent(agent.id).unwrap();
      toast.show(`${agent.name} is now deployed.`, { tone: 'success' });
    } catch (err) {
      toast.show(getErrorMessage(err as ApiQueryError | SerializedError, 'Could not publish this agent.'), { tone: 'error' });
    }
  };

  const handleCopyPrompt = async (value: string) => {
    await Clipboard.setStringAsync(value);
    toast.show('Prompt copied to clipboard', { tone: 'success' });
  };

  const handleDelete = () => {
    Alert.alert('Delete agent?', buildDeleteWarning(agent.name, agent.clones), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAgent(agent.id).unwrap();
            navigation.goBack();
          } catch (err) {
            toast.show(getErrorMessage(err as ApiQueryError | SerializedError, 'Could not delete this agent.'), { tone: 'error' });
          }
        },
      },
    ]);
  };

  const publishBlocked = isPublishBlocked(agent);
  const cloneOutBlocked = isCloneOutBlocked(agent);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={agent.name} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <Card>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.bold, fontSize: theme.fontSizes.xl, flexShrink: 1 }}>
                  {agent.name}
                </Text>
                <View style={[styles.originChip, { borderColor: theme.colors.accent, borderRadius: theme.radii.full }]}>
                  <Text style={[styles.originChipText, { color: theme.colors.accent }]}>{cloned ? 'Cloned agent' : 'My agent'}</Text>
                </View>
              </View>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: 2 }}>
                {cloned ? 'Installed from the Agent Marketplace' : 'Master definition'}
              </Text>
            </View>
            {isEvaluating ? (
              <View style={[styles.badge, { backgroundColor: theme.colors.statusInfoBg, borderRadius: theme.radii.full }]}>
                <Text style={[styles.badgeText, { color: theme.colors.statusInfoFg }]}>Evaluating…</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: badgeTone.bg, borderRadius: theme.radii.full }]}>
                <Text style={[styles.badgeText, { color: badgeTone.fg }]}>{badge.label}</Text>
              </View>
            )}
          </View>

          <View
            style={[
              styles.metrics,
              { backgroundColor: theme.colors.statusNeutralBg, borderColor: theme.colors.border, borderRadius: theme.radii.md },
            ]}
          >
            <View style={styles.metric}>
              <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>VERSION</Text>
              <Text style={[styles.metricValue, { color: theme.colors.text }]}>{formatAgentVersion(agent)}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>LIFECYCLE</Text>
              <View style={styles.lifecycleRow}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        agent.state === 'deployed' ? theme.colors.success : agent.state === 'error' ? theme.colors.error : theme.colors.textMuted,
                    },
                  ]}
                />
                <Text style={[styles.metricValue, { color: theme.colors.text }]}>{agent.state === 'deployed' ? 'Deployed' : agent.state === 'error' ? 'Error' : 'Draft'}</Text>
              </View>
            </View>
            <View style={styles.metric}>
              <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>CLONES</Text>
              <Text style={[styles.metricValue, { color: theme.colors.text }]}>{agent.clones}</Text>
            </View>
          </View>

          {cloned && (
            <View style={[styles.notice, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
              <Icon name="info-outline" size={16} color={theme.colors.textMuted} />
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, flex: 1 }}>
                Installed from the Agent Marketplace. Its definition cannot be edited or deleted here — it can still be evaluated, published and cloned out to customers.
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            {canBuild && !cloned && (
              <Button label="Edit" icon="edit" variant="outline" size="sm" onPress={() => navigation.navigate('AgentForm', { id: agent.id })} />
            )}
            {canEvaluate && (
              <Button label="Evaluate" icon="science" variant="outline" size="sm" loading={isStartingEval || isEvaluating} onPress={handleEvaluate} />
            )}
            {canPublish && (
              <Button
                label={agent.state === 'deployed' ? 'Deployed' : 'Publish'}
                icon={agent.state === 'deployed' ? 'check-circle' : 'rocket-launch'}
                variant="outline"
                size="sm"
                loading={isPublishing}
                disabled={agent.state === 'deployed' || publishBlocked}
                onPress={handlePublish}
              />
            )}
            {canClone && (
              <Button
                label="Clone out"
                icon="content-copy"
                variant="outline"
                size="sm"
                disabled={cloneOutBlocked}
                onPress={() => navigation.navigate('AgentCloneOut', { id: agent.id })}
              />
            )}
            {canDelete && !cloned && (
              <Button label="Delete" icon="delete-outline" variant="outline" size="sm" loading={isDeleting} onPress={handleDelete} />
            )}
          </View>
          {canPublish && agent.state !== 'deployed' && publishBlocked && (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 8 }}>
              Blocked — the agent must score 50 or better before it can be published.
            </Text>
          )}
          {canClone && cloneOutBlocked && (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 8 }}>
              Blocked — publish this agent before cloning it out to customers.
            </Text>
          )}
        </Card>

        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>CONFIGURATION</Text>
        <Card elevated padded={false} style={{ borderRadius: theme.radii.xl, overflow: 'hidden' }}>
          {rows.map((row, index) => {
            const isMoney = row.moneyAmount !== undefined;
            const isEvaluation = row.id === 'evaluation';
            const evalTone = isEvaluation
              ? hasPassedGate(agent.score)
                ? theme.colors.statusSuccessFg
                : theme.colors.statusErrorFg
              : theme.colors.text;

            return (
              <View key={row.id} style={styles.field}>
                <View style={[styles.fieldIconWrap, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
                  <Icon name={FIELD_ICONS[row.id] ?? 'info-outline'} size={15} color={theme.colors.accent} />
                </View>
                <View
                  style={[
                    styles.fieldContent,
                    index < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
                  ]}
                >
                  <View style={styles.fieldTop}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.textMuted }]}>{row.label.toUpperCase()}</Text>
                    <View style={styles.fieldTopRight}>
                      {row.id === 'prompt' && (
                        <Pressable
                          onPress={() => handleCopyPrompt(row.value)}
                          hitSlop={8}
                          style={({ pressed }) => [styles.copyButton, { opacity: pressed ? 0.5 : 1 }]}
                        >
                          <Icon name="content-copy" size={13} color={theme.colors.textMuted} />
                        </Pressable>
                      )}
                      {row.isLocked && (
                        <View style={[styles.lockPill, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.full }]}>
                          <Icon name="lock" size={10} color={theme.colors.textMuted} />
                          <Text style={[styles.lockPillText, { color: theme.colors.textMuted }]}>Locked</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {row.id === 'prompt' ? (
                    <View
                      style={[
                        styles.promptBox,
                        { backgroundColor: theme.colors.statusNeutralBg, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
                      ]}
                    >
                      <Text style={[styles.promptText, { color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular }]}>{row.value}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.fieldValue, { color: evalTone }]}>
                      {row.value}
                      {isMoney && (
                        <Text style={[styles.fieldValueMoney, { color: theme.colors.accent }]}>
                          {'  —  '}
                          {formatMoney(row.moneyAmount, 'GBP')}
                        </Text>
                      )}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  originChip: { paddingHorizontal: 8, paddingVertical: 2, borderWidth: StyleSheet.hairlineWidth },
  originChipText: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 11 },
  metrics: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, padding: 10, marginTop: 12, gap: 8 },
  metric: { flex: 1, gap: 3 },
  metricLabel: { fontFamily: 'InstrumentSans_700Bold', fontSize: 10, letterSpacing: 0.4 },
  metricValue: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 13 },
  lifecycleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  notice: { flexDirection: 'row', gap: 8, padding: 10, marginTop: 12, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  sectionTitle: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 12, letterSpacing: 0.6, marginLeft: 2 },
  field: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, gap: 12 },
  fieldIconWrap: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  fieldContent: { flex: 1, paddingVertical: 14 },
  fieldTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 },
  fieldTopRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  copyButton: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 10.5, letterSpacing: 0.6 },
  fieldValue: { fontFamily: 'InstrumentSans_500Medium', fontSize: 14.5, lineHeight: 20 },
  fieldValueMoney: { fontFamily: 'SpaceMono_400Regular', fontSize: 14 },
  lockPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2 },
  lockPillText: { fontFamily: 'InstrumentSans_500Medium', fontSize: 10 },
  promptBox: { marginTop: 6, padding: 12, borderWidth: StyleSheet.hairlineWidth },
  promptText: { fontSize: 12.5, lineHeight: 19 },
});
