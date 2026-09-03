import { useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Loader, Switch, TextField, useToast } from '@/components/ui';
import { useDebouncedValue } from '@/features/marketplace/useDebouncedValue';
import { LEAD_CRITERIA_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { LeadCriteriaStackParamList } from '@/navigation/types';
import { LeadCriteriaCard } from './components/LeadCriteriaCard';
import { useDeleteLeadCriteriaSetMutation, useGetLeadCriteriaSetsQuery } from './leadCriteriaApi';
import { LEAD_CRITERIA_PAGE_SIZE, NO_PERMISSION_MESSAGE, SEARCH_DEBOUNCE_MS, buildDeleteWarning, buildLeadCriteriaRows } from './leadCriteriaRules';
import type { LeadCriteriaListItem } from './leadCriteria.types';

type Nav = NativeStackNavigationProp<LeadCriteriaStackParamList>;

export function LeadCriteriaScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const canView = usePermission(LEAD_CRITERIA_PERMISSIONS.VIEW);
  const canEdit = usePermission(LEAD_CRITERIA_PERMISSIONS.MANAGE);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const isFiltered = Boolean(debouncedSearch);
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [loadedRows, setLoadedRows] = useState<LeadCriteriaListItem[]>([]);

  useEffect(() => setPage(1), [debouncedSearch, showArchived]);

  const { data, isLoading, isFetching, error, refetch } = useGetLeadCriteriaSetsQuery(
    { page, limit: LEAD_CRITERIA_PAGE_SIZE, ...(debouncedSearch ? { search: debouncedSearch } : {}), ...(showArchived ? { status: 'ARCHIVED' as const } : {}) },
    { skip: !canView },
  );

  const [deleteSet, { isLoading: isDeleting }] = useDeleteLeadCriteriaSetMutation();

  useEffect(() => {
    if (!data) return;
    setLoadedRows((prev) => {
      if (data.page <= 1) return data.items;
      const seen = new Set(prev.map((s) => s.id));
      return [...prev, ...data.items.filter((s) => !seen.has(s.id))];
    });
  }, [data]);

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, data?.totalPages ?? 1);
  const rows = buildLeadCriteriaRows(loadedRows);

  const handleRefresh = () => {
    setPage(1);
    void refetch();
  };

  const handleLoadMore = () => {
    if (isFetching || page >= pageCount) return;
    setPage((p) => p + 1);
  };

  const handleCreate = () => {
    if (!canEdit) {
      toast.show(NO_PERMISSION_MESSAGE, { tone: 'warning' });
      return;
    }
    navigation.navigate('LeadCriteriaForm', {});
  };

  const handleDelete = (row: (typeof rows)[number]) => {
    if (!canEdit) {
      toast.show(NO_PERMISSION_MESSAGE, { tone: 'warning' });
      return;
    }
    Alert.alert('Delete this set?', buildDeleteWarning(row.name, row.ruleCount), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSet(row.id).unwrap();
            toast.show(`“${row.name}” deleted.`, { tone: 'neutral' });
            if (rows.length === 1 && page > 1) setPage(page - 1);
          } catch (err) {
            toast.show(getErrorMessage(err as never, 'Could not delete that lead-criteria set.'), { tone: 'error' });
          }
        },
      },
    ]);
  };

  if (!canView) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Lead criteria" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />
        <View style={{ padding: 16 }}>
          <EmptyState icon="lock" title="You cannot view lead criteria" description="Viewing this registry needs the &quot;View lead criteria&quot; permission. Ask an owner or an admin to grant it." />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Lead criteria" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={handleRefresh} tintColor={theme.colors.accent} />}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
              A named, reusable definition of what a good lead looks like — firmographics, contact targeting, keywords and the weighted rules explaining why a match would score the way it would.
            </Text>

            {canEdit && <Button label="New set" icon="add" onPress={handleCreate} fullWidth />}

            <TextField placeholder="Search sets…" leftIcon="search" value={search} onChangeText={setSearch} autoCapitalize="none" />

            <View style={styles.archiveRow}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>Show archived</Text>
              <Switch value={showArchived} onValueChange={setShowArchived} />
            </View>

            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
              {!isLoading && !error ? `${total} set${total === 1 ? '' : 's'}` : 'Sets'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <LeadCriteriaCard
            row={item}
            canEdit={canEdit}
            onEdit={() => navigation.navigate('LeadCriteriaForm', { id: item.id })}
            onManageRules={() => navigation.navigate('LeadCriteriaRules', { id: item.id })}
            onDelete={() => handleDelete(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          isLoading ? (
            <Loader />
          ) : error ? (
            <ErrorState title="Could not load lead criteria" message={getErrorMessage(error as never, 'Something went wrong.')} onRetry={refetch} />
          ) : isFiltered ? (
            <EmptyState icon="search-off" title="No matches" description="Try a different search term." />
          ) : (
            <EmptyState icon="rule" title="No lead-criteria sets yet" description="Create one to define what a good lead looks like for this workspace." actionLabel={canEdit ? 'New set' : undefined} onAction={canEdit ? handleCreate : undefined} />
          )
        }
        ListFooterComponent={
          !isLoading && !error && rows.length > 0 && page < pageCount ? (
            <View style={styles.pager}>
              <Button label="Load more" variant="outline" loading={isFetching} onPress={handleLoadMore} fullWidth />
            </View>
          ) : null
        }
      />
      {isDeleting && <Loader />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  headerBlock: { gap: 12, marginBottom: 4 },
  archiveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pager: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 8 },
});
