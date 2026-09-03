import type { SerializedError } from '@reduxjs/toolkit';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';

import { AppHeader } from '@/components/shell/AppHeader';
import { Card, EmptyState, ErrorState, Icon, Loader, useToast } from '@/components/ui';
import { useGetAllKnowledgeBasesQuery } from '@/features/knowledge-bases/knowledgeBasesApi';
import { CHAT_PERMISSIONS, USAGE_PERMISSIONS } from '@/permissions/slugs';
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

  const threadQuery = useGetChatThreadQuery(params.conversationId, { skip: !canView });
  const modelsQuery = useGetChatModelsQuery(params.conversationId, { skip: !canView });
  const balanceQuery = useGetChatBalanceQuery(params.conversationId, { skip: !canView || !canViewCost });
  const kbQuery = useGetAllKnowledgeBasesQuery(undefined, { skip: !canView });
  const [setModel, { isLoading: isSettingModel }] = useSetChatThreadModelMutation();

  const thread = threadQuery.data;
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
          <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 6 }}>
            {thread.purpose === 'SUPPORT' ? 'Support conversation' : 'General conversation'} · {thread.messageCount} messages
          </Text>
        </Card>

        <SectionLabel text="MODEL" />
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
  modelOption: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, padding: 10 },
});
