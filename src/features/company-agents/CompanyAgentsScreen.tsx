import { useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Loader } from '@/components/ui';
import { AGENT_PERMISSIONS, MARKETPLACE_PERMISSIONS } from '@/permissions/slugs';
import { useEveryPermission, usePermission } from '@/permissions/usePermission';
import { ApiError, NetworkError } from '@/services/httpClient';
import { useAppTheme } from '@/theme/ThemeContext';

import type { CompanyAgentsStackParamList } from '@/navigation/types';
import { AgentCard } from './components/AgentCard';
import { useGetAgentsQuery } from './companyAgentsApi';
import type { Agent } from './companyAgents.types';
import { isClonedAgent } from './agentRules';
import { StatTile } from '@/features/dashboard/components/StatTile';

type Nav = NativeStackNavigationProp<CompanyAgentsStackParamList>;

export function CompanyAgentsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const canBuild = usePermission(AGENT_PERMISSIONS.BUILD);
  const canInstallFromMarketplace = useEveryPermission([
    MARKETPLACE_PERMISSIONS.INSTALL,
    AGENT_PERMISSIONS.BUILD,
  ]);

  const { data, isLoading, isFetching, error, refetch } = useGetAgentsQuery();
  const agents = data ?? [];

  const stats = useMemo(() => {
    const owned = agents.filter((a) => !isClonedAgent(a)).length;
    const cloned = agents.length - owned;
    const deployed = agents.filter((a) => a.state === 'deployed').length;
    const clones = agents.reduce((sum, a) => sum + a.clones, 0);
    return { owned, cloned, deployed, clones };
  }, [agents]);

  const goToMarketplace = () => navigation.getParent()?.navigate('MarketplaceTab' as never);

  const header = (
    <View style={styles.headerBlock}>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
        Every agent this workspace runs, built here or installed from the marketplace.
      </Text>

      <View style={styles.statsGrid}>
        <StatTile label="My agents" value={String(stats.owned)} icon="smart-toy" />
        <StatTile label="Cloned agents" value={String(stats.cloned)} icon="content-copy" />
        <StatTile label="Deployed" value={String(stats.deployed)} icon="published-with-changes" />
        <StatTile label="Clones live" value={String(stats.clones)} icon="groups" />
      </View>

      {canBuild && (
        <Button
          label="New agent"
          icon="add"
          onPress={() => navigation.navigate('AgentForm', {})}
          style={{ marginTop: 4 }}
        />
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title="Company agents"
        mode="tab"
        onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        onAvatarPress={() => navigation.getParent()?.navigate('SettingsTab' as never)}
      />

      {isLoading ? (
        <Loader fullScreen label="Loading your agents…" />
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : agents.length === 0 ? (
        <View style={{ flex: 1 }}>
          {header}
          <EmptyState
            icon="smart-toy"
            title="No agents yet"
            description={
              canBuild
                ? 'Build your first agent, or install one from the marketplace to get started.'
                : 'Nobody has built an agent in this workspace yet. Ask an owner or an admin.'
            }
            actionLabel={canBuild ? 'Create agent' : canInstallFromMarketplace ? 'Browse marketplace' : undefined}
            onAction={canBuild ? () => navigation.navigate('AgentForm', {}) : canInstallFromMarketplace ? goToMarketplace : undefined}
          />
        </View>
      ) : (
        <FlatList
          data={agents}
          keyExtractor={(a) => a.id}
          contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
          ListHeaderComponent={header}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={theme.colors.accent} />}
          renderItem={({ item }: { item: Agent }) => (
            <AgentCard
              agent={item}
              isEvaluating={false}
              onPress={() => navigation.navigate('AgentDetail', { id: item.id })}
            />
          )}
        />
      )}
    </View>
  );
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'status' in error) {
    const e = error as { status: number | string; messages?: string[] };
    if (e.messages?.[0]) return e.messages[0];
    if (e.status === 'NETWORK_ERROR') return new NetworkError().message;
  }
  if (error instanceof ApiError) return error.messages[0] ?? error.message;
  if (error instanceof NetworkError) return error.message;
  return 'Your agents did not come back. Nothing has changed — try again in a moment.';
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  headerBlock: { gap: 12, marginBottom: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
