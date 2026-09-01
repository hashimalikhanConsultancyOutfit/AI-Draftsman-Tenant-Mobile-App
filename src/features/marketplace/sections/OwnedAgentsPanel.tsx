import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button, EmptyState, Loader } from '@/components/ui';
import { AgentCard } from '@/features/company-agents/components/AgentCard';
import { useGetAgentsQuery } from '@/features/company-agents/companyAgentsApi';
import { AGENT_PERMISSIONS, MARKETPLACE_PERMISSIONS } from '@/permissions/slugs';
import { useEveryPermission, usePermission } from '@/permissions/usePermission';
import { useAppTheme } from '@/theme/ThemeContext';

import type { MarketplaceStackParamList } from '@/navigation/types';

interface OwnedAgentsPanelProps {
  onBrowseCatalogue: () => void;
}

type Nav = NativeStackNavigationProp<MarketplaceStackParamList>;

/**
 * "My agents" — a 100%-shared surface with the standalone Company Agents
 * tab (same `GET /agents`, same `AgentCard`). Web's `OwnedAgentsPanel`
 * never leaves the Connectors route for viewing, adding, editing or
 * cloning out an agent — it reuses Company Agents' own dialogs in place.
 * Mirrored here by mounting the same `AgentDetailScreen`/`AgentFormScreen`/
 * `CloneOutScreen` inside THIS stack rather than tab-switching (see
 * MarketplaceStackParamList's doc comment) — those screens' own Edit/Clone
 * out buttons resolve against this stack too, since it registers the same
 * route names they navigate to.
 */
export function OwnedAgentsPanel({ onBrowseCatalogue }: OwnedAgentsPanelProps) {
  const { theme } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const { data: agents, isLoading } = useGetAgentsQuery();
  const canBuild = usePermission(AGENT_PERMISSIONS.BUILD);
  const canInstall = useEveryPermission([MARKETPLACE_PERMISSIONS.INSTALL, AGENT_PERMISSIONS.BUILD]);

  const list = agents ?? [];
  const builtHere = list.filter((a) => !a.clonedFromMarketplaceId).length;
  const installed = list.filter((a) => a.clonedFromMarketplaceId).length;

  const openAgent = (id: string) => {
    navigation.navigate('AgentDetail', { id });
  };
  const openAddAgent = () => {
    navigation.navigate('AgentForm', {});
  };

  return (
    <FlatList
      data={list}
      keyExtractor={(a) => a.id}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          {list.length > 0 && (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
              {builtHere} built here · {installed} installed from the marketplace
            </Text>
          )}
          <Button label="Add agent" icon="add" variant="outline" disabled={!canBuild} onPress={openAddAgent} fullWidth />
        </View>
      }
      renderItem={({ item }) => <AgentCard agent={item} isEvaluating={false} onPress={() => openAgent(item.id)} />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListEmptyComponent={
        isLoading ? (
          <Loader />
        ) : (
          <EmptyState
            icon="smart-toy"
            title="No agents yet"
            description={canBuild ? "Build one here, or install a published agent from the marketplace." : 'Building an agent needs the "Build agents" permission.'}
            actionLabel={canInstall ? 'Browse marketplace' : undefined}
            onAction={canInstall ? onBrowseCatalogue : undefined}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
});
