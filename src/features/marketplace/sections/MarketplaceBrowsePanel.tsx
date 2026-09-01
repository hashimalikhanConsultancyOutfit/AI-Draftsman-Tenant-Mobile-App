import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Button, EmptyState, ErrorState, Loader, TextField } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { MarketplaceEntryCard } from '../components/MarketplaceEntryCard';
import { CATALOGUE_LEAD, MARKETPLACE_COPY, MARKETPLACE_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '../marketplaceRules';
import { useGetMarketplaceAgentsQuery, useGetSkillsQuery } from '../marketplaceApi';
import { useDebouncedValue } from '../useDebouncedValue';
import { useMarketplaceClone } from '../useMarketplaceClone';
import type { MarketplaceEntry, MarketplaceResource } from '../marketplace.types';

interface MarketplaceBrowsePanelProps {
  resource: MarketplaceResource;
  onOpenEntry: (id: string) => void;
}

/** The published-catalogue browse grid — one component for both Skills and
 * Agents, parameterised by `resource`. Search + a growing "Load more" list
 * (12/page), each card openable for full detail and clone-able in place. */
export function MarketplaceBrowsePanel({ resource, onOpenEntry }: MarketplaceBrowsePanelProps) {
  const { theme } = useAppTheme();
  const copy = MARKETPLACE_COPY[resource];
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<MarketplaceEntry[]>([]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const params = { page, limit: MARKETPLACE_PAGE_SIZE, search: debouncedSearch || undefined };
  const skillsQuery = useGetSkillsQuery(params, { skip: resource !== 'skill' });
  const agentsQuery = useGetMarketplaceAgentsQuery(params, { skip: resource !== 'agent' });
  const { data, isLoading, isFetching, error, refetch } = resource === 'skill' ? skillsQuery : agentsQuery;

  const { canClone, cloneEntry, pending, cloned, vanished, installedIds } = useMarketplaceClone(resource);

  useEffect(() => {
    if (!data) return;
    setRows((prev) => {
      if (data.page <= 1) return data.items;
      const seen = new Set(prev.map((e) => e.id));
      return [...prev, ...data.items.filter((e) => !seen.has(e.id))];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the response object itself
  }, [data]);

  const visibleRows = rows.filter((e) => !vanished[e.id]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, data?.totalPages ?? 1);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={visibleRows}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.container}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
              {CATALOGUE_LEAD[resource]}
            </Text>
            <TextField placeholder={copy.searchPlaceholder} leftIcon="search" value={search} onChangeText={setSearch} autoCapitalize="none" />
            {!isLoading && (
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
                {total} {total === 1 ? copy.noun : copy.nounPlural}
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <MarketplaceEntryCard
            entry={item}
            resource={resource}
            saved={cloned[item.id]}
            installed={Boolean(installedIds[item.id])}
            pending={Boolean(pending[item.id])}
            canClone={canClone}
            onPress={() => onOpenEntry(item.id)}
            onClone={() => cloneEntry(item.id, item.name)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          isLoading ? (
            <Loader />
          ) : error ? (
            <ErrorState title={copy.errorTitle} message={copy.errorDescription} onRetry={refetch} />
          ) : debouncedSearch ? (
            <EmptyState icon="search-off" title={copy.noMatchTitle} description={copy.noMatchDescription} actionLabel="Clear search" onAction={() => setSearch('')} />
          ) : (
            <EmptyState icon={resource === 'agent' ? 'smart-toy' : 'extension'} title={copy.emptyTitle} description={copy.emptyDescription} />
          )
        }
        ListFooterComponent={
          !isLoading && visibleRows.length > 0 && page < totalPages ? (
            <View style={styles.footer}>
              <Button label="Load more" variant="outline" loading={isFetching} onPress={() => setPage((p) => p + 1)} fullWidth />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  footer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 8 },
});
