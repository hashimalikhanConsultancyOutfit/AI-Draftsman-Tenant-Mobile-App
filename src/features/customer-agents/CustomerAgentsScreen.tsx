import { useEffect, useMemo, useState } from 'react';
import type { SerializedError } from '@reduxjs/toolkit';
import { FlatList, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, EmptyState, Icon, Loader, Switch, useToast, type IconName } from '@/components/ui';
import { useGetAgentsQuery } from '@/features/company-agents/companyAgentsApi';
import { CLONE_PERMISSIONS, USAGE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import type { ApiQueryError } from '@/store/baseQuery';
import { useAppTheme } from '@/theme/ThemeContext';

import type { CustomerAgentsStackParamList } from '@/navigation/types';
import { CloneCard } from './components/CloneCard';
import {
  CLONES_LIST_PAGE_SIZE,
  CONFLICT_MODE_OPTIONS,
  PUSH_BUCKET_COPY,
  STAGED_ROLLOUT_PERCENT,
  filterClonesByTab,
  planPush,
} from './cloneRules';
import { useGetAllClonesQuery, useGetClonesQuery, useUpdateCloneMutation } from './customerAgentsApi';
import type { Clone, CloneTab, PushBucket, PushHistoryRecord, PushOptions } from './customerAgents.types';
import { buildPushPatch } from './cloneRules';

type Nav = NativeStackNavigationProp<CustomerAgentsStackParamList>;

const BUCKET_ORDER: PushBucket[] = ['clean', 'merge', 'conflict', 'pinned'];

const BUCKET_ICONS: Record<PushBucket, IconName> = {
  clean: 'check-circle',
  merge: 'call-merge',
  conflict: 'report-problem',
  pinned: 'push-pin',
};

function toneColors(theme: ReturnType<typeof useAppTheme>['theme'], tone: 'success' | 'warning' | 'error' | 'info') {
  if (tone === 'success') return { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg };
  if (tone === 'warning') return { bg: theme.colors.statusWarningBg, fg: theme.colors.statusWarningFg };
  if (tone === 'error') return { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg };
  return { bg: theme.colors.statusInfoBg, fg: theme.colors.statusInfoFg };
}

function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.pill,
        {
          borderRadius: theme.radii.full,
          borderWidth: theme.borders.interactive,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          backgroundColor: selected ? theme.colors.accent + '14' : theme.colors.statusNeutralBg,
        },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      {selected && <View style={[styles.pillDot, { backgroundColor: theme.colors.accent }]} />}
      <Text
        style={{
          color: selected ? theme.colors.accent : theme.colors.text,
          fontFamily: selected ? theme.fontFamilies.body.semibold : theme.fontFamilies.body.medium,
          fontSize: theme.fontSizes.xs,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function PillPicker<T extends string>({ options, value, onChange }: { options: Array<{ label: string; value: T }>; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.pillWrap}>
      {options.map((opt) => (
        <Pill key={opt.value} label={opt.label} selected={opt.value === value} onPress={() => onChange(opt.value)} />
      ))}
    </View>
  );
}

/** Same pills, single scrolling row — for a list that can run longer than
 * one line's worth of chips (the master-agent picker), so it never wraps
 * into a ragged multi-row block. */
function PillScroller<T extends string>({ options, value, onChange }: { options: Array<{ label: string; value: T }>; value: T; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillWrap}>
      {options.map((opt) => (
        <Pill key={opt.value} label={opt.label} selected={opt.value === value} onPress={() => onChange(opt.value)} />
      ))}
    </ScrollView>
  );
}

/** Icon chip + label, the same visual language AgentDetailScreen's field
 * table uses — keeps every "premium" section header in the app consistent. */
function SectionLabel({ icon, children }: { icon: IconName; children: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.sectionLabelRow}>
      <View style={[styles.sectionIconWrap, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
        <Icon name={icon} size={14} color={theme.colors.accent} />
      </View>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{children}</Text>
    </View>
  );
}

function SwitchRow({ icon, label, hint, value, onValueChange }: { icon: IconName; label: string; hint?: string; value: boolean; onValueChange: (v: boolean) => void }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.switchRow}>
      <View style={[styles.sectionIconWrap, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
        <Icon name={icon} size={14} color={theme.colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>{label}</Text>
        {hint && (
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 2 }}>{hint}</Text>
        )}
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

export function CustomerAgentsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const canPush = usePermission(CLONE_PERMISSIONS.PUSH);
  const canRollback = usePermission(CLONE_PERMISSIONS.ROLLBACK);
  const canViewSpend = usePermission(USAGE_PERMISSIONS.VIEW);

  const [tab, setTab] = useState<CloneTab>('all');
  const [page, setPage] = useState(1);
  // "All clones" is a load-more list, not a numbered pager: every page
  // fetched so far is appended here and rendered as one growing list.
  const [loadedRows, setLoadedRows] = useState<Clone[]>([]);

  const { data: clonePage, isLoading: isPageLoading, isFetching: isPageFetching, refetch: refetchPage } = useGetClonesQuery({
    page,
    limit: CLONES_LIST_PAGE_SIZE,
  });
  const { data: allClones, isLoading: isAllLoading, refetch: refetchAll } = useGetAllClonesQuery();
  const { data: agents } = useGetAgentsQuery();

  const [updateClone] = useUpdateCloneMutation();

  // Page 1 always replaces (first load, tab switch back to "all", pull to
  // refresh — see handleSetTab / onRefresh, both of which reset `page` to
  // 1). Any later page is appended, de-duplicated by id so a background
  // refetch of an already-loaded page can never double an entry.
  useEffect(() => {
    if (!clonePage) return;
    setLoadedRows((prev) => {
      if (clonePage.page <= 1) return clonePage.items;
      const seen = new Set(prev.map((c) => c.id));
      return [...prev, ...clonePage.items.filter((c) => !seen.has(c.id))];
    });
  }, [clonePage]);

  const cloneList = useMemo(() => allClones ?? [], [allClones]);
  const agentList = useMemo(() => agents ?? [], [agents]);
  const total = clonePage?.total ?? 0;
  const pageCount = Math.max(1, clonePage?.totalPages ?? 1);

  const tabCounts = useMemo(
    () => ({
      all: total,
      diverged: cloneList.filter((c) => c.div.length > 0).length,
      pinned: cloneList.filter((c) => c.pinned).length,
    }),
    [cloneList, total],
  );

  const handleSetTab = (next: CloneTab) => {
    setTab(next);
    setPage(1);
  };

  const handleLoadMore = () => {
    if (isPageFetching || page >= pageCount) return;
    setPage((p) => p + 1);
  };

  const rows: Clone[] = tab === 'all' ? loadedRows : filterClonesByTab(cloneList, tab);
  const isLoading = tab === 'all' ? isPageLoading : isAllLoading;

  /* --- Push planning --------------------------------------------------- */
  const [pushAgentId, setPushAgentId] = useState('');
  const [pushOptions, setPushOptions] = useState<PushOptions>({ conflictMode: 'skip', forcePinned: false });
  const [isStagedRollout, setStagedRollout] = useState(false);
  const [pushHistory, setPushHistory] = useState<PushHistoryRecord[]>([]);
  const [isPushing, setIsPushing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const pushAgent = useMemo(() => agentList.find((a) => a.id === pushAgentId) ?? agentList[0] ?? null, [agentList, pushAgentId]);
  const pushPlan = useMemo(() => planPush(cloneList, pushAgent, pushOptions), [cloneList, pushAgent, pushOptions]);

  const lastPush = pushHistory[0] ?? null;
  const canUndo = lastPush !== null;
  const undoLabel = lastPush ? `Undo push of ${lastPush.masterName} v${lastPush.toVersion} (${lastPush.previous.length} clones)` : 'No push to undo';

  const handleApplyPush = async () => {
    if (!pushPlan || !pushAgent) return;
    const applying = pushPlan.entries.filter((e) => e.willApply);
    if (applying.length === 0) {
      toast.show('Nothing to push — every clone was skipped.', { tone: 'neutral' });
      return;
    }
    const previous = applying
      .map((e) => cloneList.find((c) => c.id === e.cloneId))
      .filter((c): c is Clone => c !== undefined)
      .map((c) => ({ ...c }));

    setIsPushing(true);
    try {
      await Promise.all(
        applying.map((entry) => {
          const clone = cloneList.find((c) => c.id === entry.cloneId);
          if (!clone) return Promise.resolve();
          const patch = buildPushPatch(clone, pushAgent, entry.bucket);
          return updateClone(patch).unwrap();
        }),
      );
      setPushHistory((h) => [
        { id: `push-${pushAgent.id}-${String(previous.length)}-${h.length}`, masterName: pushAgent.name, toVersion: pushAgent.ver, at: Date.now(), previous },
        ...h,
      ]);
      toast.show(
        `${pushAgent.name} v${pushAgent.ver} pushed to ${applying.length} clone${applying.length === 1 ? '' : 's'}.${
          isStagedRollout ? ` Staged rollout acknowledged — first ${STAGED_ROLLOUT_PERCENT}%.` : ''
        } Undo available for 24 hours.`,
        { tone: 'success' },
      );
      setPreviewOpen(false);
      void refetchAll();
      void refetchPage();
    } catch (err) {
      toast.show(getErrorMessage(err as ApiQueryError | SerializedError, 'Could not complete the push.'), { tone: 'error' });
    } finally {
      setIsPushing(false);
    }
  };

  const handleUndoPush = async () => {
    if (!lastPush || !canUndo) return;
    if (!canRollback) {
      toast.show('Undoing a push needs the "Roll back clones" permission, which is separate from pushing.', { tone: 'warning' });
      return;
    }
    setIsPushing(true);
    try {
      await Promise.all(lastPush.previous.map((clone) => updateClone({ id: clone.id, prompt: clone.prompt, model: clone.model, tools: clone.tools, ver: clone.ver }).unwrap()));
      setPushHistory((h) => h.filter((r) => r.id !== lastPush.id));
      toast.show(`Push undone — ${lastPush.previous.length} clone${lastPush.previous.length === 1 ? '' : 's'} restored to their previous definitions.`, { tone: 'success' });
      void refetchAll();
      void refetchPage();
    } catch (err) {
      toast.show(getErrorMessage(err as ApiQueryError | SerializedError, 'Could not undo the push.'), { tone: 'error' });
    } finally {
      setIsPushing(false);
    }
  };

  const listHeader = (
    <View style={styles.headerBlock}>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
        Every clone is a full independent copy of its master. Editing one never reaches back into the company agent, and deleting the master leaves the clone running.
      </Text>

      <View style={styles.tabRow}>
        {(
          [
            { value: 'all' as const, label: 'All clones', count: tabCounts.all },
            { value: 'diverged' as const, label: 'Diverged', count: tabCounts.diverged },
            { value: 'pinned' as const, label: 'Pinned', count: tabCounts.pinned },
            { value: 'push' as const, label: 'Push update', count: undefined },
          ]
        ).map((t) => {
          const active = tab === t.value;
          return (
            <TouchableOpacity
              key={t.value}
              onPress={() => handleSetTab(t.value)}
              style={[
                styles.tabChip,
                { borderRadius: theme.radii.full, backgroundColor: active ? theme.colors.accent : theme.colors.statusNeutralBg },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={{ color: active ? theme.colors.textOnAccent : theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>
                {t.label}
                {t.count !== undefined ? ` (${t.count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'diverged' && (
        <Card style={{ backgroundColor: theme.colors.statusWarningBg, borderWidth: 0 }}>
          <Text style={{ color: theme.colors.statusWarningFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 18 }}>
            Divergence is recalculated on every save: it is a comparison against the master, not a flag. Edit a field back to the master's value and the clone returns to "in sync" on that same save.
          </Text>
        </Card>
      )}

      {tab === 'pinned' && (
        <Card style={{ backgroundColor: theme.colors.statusInfoBg, borderWidth: 0 }}>
          <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 18 }}>
            Pinned clones: held at their current version and skipped by every push, unless someone explicitly ticks "force locked fields onto pinned clones" on the Push update tab.
          </Text>
        </Card>
      )}

      {tab === 'push' && (
        <PushPanelCard
          agents={agentList}
          pushAgentId={pushAgent?.id ?? ''}
          onPushAgentChange={setPushAgentId}
          options={pushOptions}
          onConflictModeChange={(conflictMode) => setPushOptions((p) => ({ ...p, conflictMode }))}
          onForcePinnedChange={(forcePinned) => setPushOptions((p) => ({ ...p, forcePinned }))}
          isStagedRollout={isStagedRollout}
          onStagedRolloutChange={setStagedRollout}
          plan={pushPlan}
          canPush={canPush}
          canRollback={canRollback}
          canUndo={canUndo}
          undoLabel={undoLabel}
          onPreview={() => setPreviewOpen(true)}
          onUndo={handleUndoPush}
        />
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title="Customer agents"
        mode="tab"
        onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)}
      />

      {tab === 'push' ? (
        <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>{listHeader}</ScrollView>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
          ListHeaderComponent={listHeader}
          refreshControl={
            <RefreshControl
              refreshing={isPageFetching}
              onRefresh={() => {
                setPage(1);
                void refetchPage();
                void refetchAll();
              }}
              tintColor={theme.colors.accent}
            />
          }
          renderItem={({ item }) => (
            <CloneCard clone={item} canViewSpend={canViewSpend} onPress={() => navigation.navigate('CloneDetail', { id: item.id })} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            isLoading ? (
              <Loader />
            ) : (
              <EmptyState icon="groups" title="No clones here" description="Clone a company agent out to a customer to see it listed." />
            )
          }
          ListFooterComponent={
            tab === 'all' && !isLoading && loadedRows.length > 0 && page < pageCount ? (
              <View style={styles.pager}>
                <Button
                  label="Load more"
                  variant="outline"
                  loading={isPageFetching}
                  onPress={handleLoadMore}
                  fullWidth
                />
              </View>
            ) : null
          }
        />
      )}

      <Modal visible={previewOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPreviewOpen(false)}>
        <TouchableOpacity style={[styles.sheetScrim, { backgroundColor: theme.colors.scrim }]} activeOpacity={1} onPress={() => setPreviewOpen(false)}>
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.sheetCard, { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 16, borderTopLeftRadius: theme.radii.sheetTop, borderTopRightRadius: theme.radii.sheetTop }]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: theme.colors.border }]} />
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg, paddingHorizontal: 20 }}>
              {pushPlan ? `Push ${pushPlan.masterName} v${pushPlan.toVersion}?` : 'Push master version?'}
            </Text>
            {pushPlan && (
              <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
                <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: 8, marginBottom: 12 }}>
                  {`${pushPlan.applyCount} of ${pushPlan.entries.length} clones will be written. Everything else is left exactly as it is.`}
                  {isStagedRollout ? ` Staged rollout is ticked — first ${STAGED_ROLLOUT_PERCENT}% is recorded as an acknowledgement, not enforced by this build.` : ''}
                </Text>

                {BUCKET_ORDER.map((bucket) => {
                  const copy = PUSH_BUCKET_COPY[bucket];
                  const tone = toneColors(theme, copy.tone);
                  const entries = pushPlan.entries.filter((e) => e.bucket === bucket);
                  return (
                    <View key={bucket} style={{ marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{copy.title}</Text>
                        <View style={{ backgroundColor: tone.bg, borderRadius: theme.radii.full, paddingHorizontal: 8, paddingVertical: 2 }}>
                          <Text style={{ color: tone.fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>{pushPlan.counts[bucket]}</Text>
                        </View>
                      </View>
                      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }}>{copy.description}</Text>
                      {entries.length === 0 ? (
                        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 6 }}>None.</Text>
                      ) : (
                        entries.map((entry) => (
                          <View key={entry.cloneId} style={{ marginTop: 6, paddingLeft: 4 }}>
                            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.xs }}>{`${entry.customer} · v${entry.fromVersion}`}</Text>
                            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{entry.reason}</Text>
                          </View>
                        ))
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Button label="Cancel" variant="outline" onPress={() => setPreviewOpen(false)} fullWidth />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={pushPlan ? `Apply to ${pushPlan.applyCount} clones` : 'Apply'}
                  variant={pushOptions.conflictMode === 'overwrite' || pushOptions.forcePinned ? 'danger' : 'primary'}
                  loading={isPushing}
                  disabled={!pushPlan || pushPlan.applyCount === 0}
                  onPress={handleApplyPush}
                  fullWidth
                />
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/* -------------------------------------------------------------------------- */

interface PushPanelCardProps {
  agents: Array<{ id: string; name: string; ver: number }>;
  pushAgentId: string;
  onPushAgentChange: (id: string) => void;
  options: PushOptions;
  onConflictModeChange: (mode: PushOptions['conflictMode']) => void;
  onForcePinnedChange: (force: boolean) => void;
  isStagedRollout: boolean;
  onStagedRolloutChange: (staged: boolean) => void;
  plan: ReturnType<typeof planPush>;
  canPush: boolean;
  canRollback: boolean;
  canUndo: boolean;
  undoLabel: string;
  onPreview: () => void;
  onUndo: () => void;
}

function PushPanelCard({
  agents,
  pushAgentId,
  onPushAgentChange,
  options,
  onConflictModeChange,
  onForcePinnedChange,
  isStagedRollout,
  onStagedRolloutChange,
  plan,
  canPush,
  canRollback,
  canUndo,
  undoLabel,
  onPreview,
  onUndo,
}: PushPanelCardProps) {
  const { theme } = useAppTheme();

  if (!canPush) {
    return (
      <Card>
        <EmptyState
          icon="lock"
          title="You cannot push master versions"
          description={'Rolling a master agent’s new version out to its clones needs the "Push to clones" permission. Ask an owner or an admin to grant it.'}
        />
      </Card>
    );
  }

  return (
    <Card elevated padded={false} style={{ borderRadius: theme.radii.xl, overflow: 'hidden' }}>
      <View style={styles.pushHeader}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>Push master version</Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }}>
            Roll a new definition out to every clone of one agent.
          </Text>
        </View>
        {plan && (
          <View style={[styles.writeBadge, { backgroundColor: theme.colors.accent + '1A', borderRadius: theme.radii.full }]}>
            <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.mono.regular, fontSize: 12 }}>
              {plan.applyCount}/{plan.entries.length}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.pushSection, { borderTopColor: theme.colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
        <SectionLabel icon="smart-toy">Master agent</SectionLabel>
        <PillScroller options={agents.map((a) => ({ label: `${a.name} — v${a.ver}`, value: a.id }))} value={pushAgentId} onChange={onPushAgentChange} />
        <Text style={styles.hintText}>Clones of this agent are the ones a push reaches.</Text>
      </View>

      <View style={[styles.pushSection, { borderTopColor: theme.colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
        <SectionLabel icon="call-split">Conflicted clones (2+ local changes)</SectionLabel>
        <PillPicker options={CONFLICT_MODE_OPTIONS} value={options.conflictMode} onChange={onConflictModeChange} />
        <Text style={styles.hintText}>Skip protects the customer's work; overwrite discards it.</Text>
      </View>

      <View style={[styles.pushSection, { borderTopColor: theme.colors.border, borderTopWidth: StyleSheet.hairlineWidth, gap: 2 }]}>
        <SwitchRow icon="lock" label="Force locked fields onto pinned clones" value={options.forcePinned} onValueChange={onForcePinnedChange} />
        <SwitchRow
          icon="rocket-launch"
          label="Staged rollout"
          hint={`First ${STAGED_ROLLOUT_PERCENT}% — acknowledgement only in this build`}
          value={isStagedRollout}
          onValueChange={onStagedRolloutChange}
        />
      </View>

      <View style={[styles.pushSection, { borderTopColor: theme.colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
        <SectionLabel icon="fact-check">What this push will do</SectionLabel>
        {plan ? (
          <View style={styles.bucketRow}>
            {BUCKET_ORDER.map((bucket) => {
              const copy = PUSH_BUCKET_COPY[bucket];
              const tone = toneColors(theme, copy.tone);
              return (
                <View key={bucket} style={[styles.bucketChip, { backgroundColor: tone.bg, borderRadius: theme.radii.full }]}>
                  <Icon name={BUCKET_ICONS[bucket]} size={12} color={tone.fg} />
                  <Text style={{ color: tone.fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>
                    {copy.title}: {plan.counts[bucket]}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: 8 }}>No master agent selected.</Text>
        )}

        {options.forcePinned && (
          <View style={[styles.notice, { backgroundColor: theme.colors.statusErrorBg, borderRadius: theme.radii.md }]}>
            <Icon name="warning" size={14} color={theme.colors.statusErrorFg} />
            <Text style={{ color: theme.colors.statusErrorFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17, flex: 1 }}>
              Forcing pinned clones overrides the master's locked fields only — everything else the customer changed is left alone.
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.pushSection, { borderTopColor: theme.colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 18 }]}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button label="Preview push" icon="visibility" onPress={onPreview} disabled={!plan || plan.entries.length === 0} fullWidth />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={canUndo ? 'Undo last push' : 'Nothing to undo'}
              icon="undo"
              variant="outline"
              disabled={!canRollback || !canUndo}
              onPress={onUndo}
              fullWidth
            />
          </View>
        </View>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 10 }}>{undoLabel}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  headerBlock: { gap: 12, marginBottom: 4 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tabChip: { paddingHorizontal: 14, paddingVertical: 8 },
  pushHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 16 },
  writeBadge: { paddingHorizontal: 10, paddingVertical: 4 },
  pushSection: { paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIconWrap: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  hintText: { fontFamily: 'InstrumentSans_400Regular', fontSize: 11.5, lineHeight: 16, marginLeft: 36 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginLeft: 36 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 7 },
  pillDot: { width: 5, height: 5, borderRadius: 2.5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  bucketRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginLeft: 36, marginTop: 2 },
  bucketChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6 },
  notice: { flexDirection: 'row', gap: 8, padding: 10, marginTop: 12, marginLeft: 36, alignItems: 'flex-start' },
  pager: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 8 },
  sheetScrim: { flex: 1, justifyContent: 'flex-end' },
  sheetCard: { maxHeight: '80%', paddingTop: 10 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
});
