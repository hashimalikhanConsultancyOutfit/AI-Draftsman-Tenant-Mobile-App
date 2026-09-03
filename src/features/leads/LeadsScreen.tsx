import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Loader, useToast } from '@/components/ui';
import { StatTile } from '@/features/dashboard/components/StatTile';
import { LEAD_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { connectChatSocket, onChatSocketEvent } from '@/services/chatSocket';
import { useAppDispatch } from '@/store/hooks';
import { useAppTheme } from '@/theme/ThemeContext';

import type { LeadsStackParamList } from '@/navigation/types';
import { LeadCard } from './components/LeadCard';
import { leadsApi, useGetLeadStatsQuery, useGetLeadsQuery, useMoveLeadStageMutation, useRunLeadScoringMutation } from './leadsApi';
import {
  NO_MOVE_MESSAGE,
  NO_PERMISSION_MESSAGE,
  NO_SCORE_MESSAGE,
  SCORING_STARTED_MESSAGE,
  WON_STAGE,
  buildColumn,
  buildLeadMoveFromWonWarning,
  describeLeadEvaluationCompleted,
} from './leadsRules';
import type { Lead, LeadEvaluationCompletedPayload, LeadStage } from './leads.types';
import { LEAD_STAGES } from './leads.types';

type Nav = NativeStackNavigationProp<LeadsStackParamList>;

export function LeadsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const dispatch = useAppDispatch();

  const canView = usePermission(LEAD_PERMISSIONS.VIEW);
  const canCreate = usePermission(LEAD_PERMISSIONS.CREATE);
  const canUpdate = usePermission(LEAD_PERMISSIONS.UPDATE);
  const canScore = usePermission(LEAD_PERMISSIONS.SCORE);

  const [activeStage, setActiveStage] = useState<LeadStage>('New');

  const { data: leads, isLoading, isFetching, error, refetch } = useGetLeadsQuery(undefined, { skip: !canView });
  const statsQuery = useGetLeadStatsQuery(undefined, { skip: !canView });

  const [moveLeadStage, { isLoading: isMovingStage }] = useMoveLeadStageMutation();
  const [runLeadScoring, { isLoading: isScoring }] = useRunLeadScoringMutation();

  // Tenant-wide, on the same shared socket chat already keeps connected —
  // fires for a lead an evaluation just finished, on ANY tab, so the
  // board refetches (never patches the score locally: the ML side writes
  // it, this is only a "go re-read" signal). See `chatSocket.ts`.
  useEffect(() => {
    if (!canView) return undefined;
    void connectChatSocket();
    const unsubscribe = onChatSocketEvent<[LeadEvaluationCompletedPayload]>('lead:evaluation-completed', (payload) => {
      dispatch(leadsApi.util.invalidateTags([{ type: 'Lead', id: payload.leadId }, { type: 'Lead', id: 'LIST' }]));
      const { message, tone } = describeLeadEvaluationCompleted(payload);
      toast.show(message, { tone });
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast/dispatch are stable
  }, [canView]);

  const leadList = useMemo(() => leads ?? [], [leads]);
  const column = useMemo(() => buildColumn(leadList, activeStage), [leadList, activeStage]);
  const stageIndex = LEAD_STAGES.indexOf(activeStage);

  const runMove = async (lead: Lead, request: { stage: LeadStage } | { direction: 'forward' | 'back' }) => {
    try {
      const moved = await moveLeadStage('direction' in request ? { id: lead.id, direction: request.direction } : { id: lead.id, stage: request.stage }).unwrap();
      toast.show(`${moved.name} moved from ${lead.stage} to ${moved.stage}.`, { tone: 'neutral' });
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not move that lead.'), { tone: 'error' });
    }
  };

  const handleMove = (lead: Lead, direction: 'forward' | 'back') => {
    if (!canUpdate) {
      toast.show(NO_MOVE_MESSAGE, { tone: 'warning' });
      return;
    }
    if (lead.stage === WON_STAGE && direction === 'back') {
      Alert.alert('Move out of Won?', buildLeadMoveFromWonWarning(lead.name), [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Move it', onPress: () => void runMove(lead, { direction }) },
      ]);
      return;
    }
    void runMove(lead, { direction });
  };

  const handleRunScoring = async () => {
    if (!canScore) {
      toast.show(NO_SCORE_MESSAGE, { tone: 'warning' });
      return;
    }
    try {
      await runLeadScoring().unwrap();
      toast.show(SCORING_STARTED_MESSAGE, { tone: 'neutral' });
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not run the scoring agent.'), { tone: 'error' });
    }
  };

  const handleAddLead = () => {
    if (!canCreate) {
      toast.show(NO_PERMISSION_MESSAGE.create, { tone: 'warning' });
      return;
    }
    navigation.navigate('LeadForm', {});
  };

  if (!canView) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Leads" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />
        <View style={{ padding: 16 }}>
          <EmptyState icon="lock" title="You cannot view leads" description="Viewing the pipeline needs the &quot;View leads&quot; permission. Ask an owner or an admin to grant it." />
        </View>
      </View>
    );
  }

  const stats = statsQuery.data;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Leads" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />

      <FlatList
        data={column.items}
        keyExtractor={(l) => l.id}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => { void refetch(); void statsQuery.refetch(); }} tintColor={theme.colors.accent} />}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
              Prospective customers, from first contact to won, with the scoring agent's reasoning attached.
            </Text>

            {(canCreate || canScore) && (
              <View style={styles.actionRow}>
                {canCreate && (
                  <View style={{ flex: 1 }}>
                    <Button label="Add lead" icon="add" onPress={handleAddLead} fullWidth />
                  </View>
                )}
                {canScore && (
                  <View style={{ flex: 1 }}>
                    <Button label="Run scoring" icon="bolt" variant="outline" onPress={handleRunScoring} loading={isScoring} fullWidth />
                  </View>
                )}
              </View>
            )}

            {canUpdate && (
              <View style={styles.actionRow}>
                <Button label="Reasoning" icon="fact-check" variant="outline" size="sm" onPress={() => navigation.navigate('LeadReasoning')} fullWidth />
              </View>
            )}

            {!error && (
              <View style={styles.statsGrid}>
                <StatTile label="Open" value={stats ? String(stats.open) : '—'} icon="trending-up" />
                <StatTile label="Scored" value={stats ? String(stats.scored) : '—'} icon="fact-check" />
                <StatTile label="Unscored" value={stats ? String(stats.unscored) : '—'} icon="help-outline" />
                <StatTile label="Won" value={stats ? String(stats.won) : '—'} icon="emoji-events" />
              </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stageRow}>
              {LEAD_STAGES.map((stage) => {
                const isActive = stage === activeStage;
                const count = leadList.filter((l) => l.stage === stage).length;
                return (
                  <TouchableOpacity
                    key={stage}
                    onPress={() => setActiveStage(stage)}
                    style={[
                      styles.stagePill,
                      { borderRadius: theme.radii.full, borderColor: isActive ? theme.colors.accent : theme.colors.border, backgroundColor: isActive ? theme.colors.accent + '1A' : 'transparent' },
                    ]}
                  >
                    <Text style={{ color: isActive ? theme.colors.accent : theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: 13 }}>
                      {stage} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <LeadCard
            lead={item}
            canUpdate={canUpdate}
            onPress={() => navigation.navigate('LeadDetail', { id: item.id })}
            onMove={(direction) => handleMove(item, direction)}
            isFirstStage={stageIndex === 0}
            isLastStage={stageIndex === LEAD_STAGES.length - 1}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          isLoading ? (
            <Loader />
          ) : error ? (
            <ErrorState title="Could not load leads" message={getErrorMessage(error as never, 'Something went wrong.')} onRetry={refetch} />
          ) : (
            <EmptyState icon="trending-up" title={`No leads in ${activeStage}`} description="Leads move here as they're worked, or add one directly." actionLabel={canCreate ? 'Add lead' : undefined} onAction={canCreate ? handleAddLead : undefined} />
          )
        }
      />
      {isMovingStage && <Loader />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  headerBlock: { gap: 12, marginBottom: 4 },
  actionRow: { flexDirection: 'row', gap: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stageRow: { gap: 8, paddingVertical: 4 },
  stagePill: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 8 },
});
