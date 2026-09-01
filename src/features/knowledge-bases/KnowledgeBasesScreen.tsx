import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Icon, Loader } from '@/components/ui';
import { KNOWLEDGE_BASE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { KnowledgeBasesStackParamList } from '@/navigation/types';
import { KnowledgeBaseCard } from './components/KnowledgeBaseCard';
import { KB_PAGE_SIZE, useGetKnowledgeBasesQuery } from './knowledgeBasesApi';
import { useState } from 'react';

type Nav = NativeStackNavigationProp<KnowledgeBasesStackParamList>;

export function KnowledgeBasesScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const canManage = usePermission(KNOWLEDGE_BASE_PERMISSIONS.MANAGE);

  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, error, refetch } = useGetKnowledgeBasesQuery({ page, limit: KB_PAGE_SIZE });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, data?.totalPages ?? 1);

  const header = (
    <View style={styles.headerBlock}>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
        The documents your agents answer from, and who is allowed to read each set. Scope is a security boundary: a
        customer-scoped base is reachable only by that customer's clones.
      </Text>

      {canManage && (
        <Button label="New knowledge base" icon="add" onPress={() => navigation.navigate('KnowledgeBaseEdit', {})} style={{ marginTop: 4 }} />
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title="Knowledge bases"
        mode="tab"
        onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)}
      />

      {isLoading ? (
        <Loader fullScreen label="Loading knowledge bases…" />
      ) : error ? (
        <ErrorState message={getErrorMessage(error, 'Your knowledge bases did not come back. Try again in a moment.')} onRetry={refetch} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(kb) => kb.id}
          contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
          ListHeaderComponent={header}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={theme.colors.accent} />}
          renderItem={({ item }) => (
            <KnowledgeBaseCard base={item} onPress={() => navigation.navigate('KnowledgeBaseDetail', { id: item.id })} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <EmptyState
              icon="menu-book"
              title="No knowledge bases yet"
              description={canManage ? 'Create one to give your agents documents to answer from.' : 'Nobody has created a knowledge base in this workspace yet. Ask an owner or an admin.'}
              actionLabel={canManage ? 'New knowledge base' : undefined}
              onAction={canManage ? () => navigation.navigate('KnowledgeBaseEdit', {}) : undefined}
            />
          }
          ListFooterComponent={
            pageCount > 1 ? (
              <View style={styles.pager}>
                <TouchableOpacity disabled={page <= 1} onPress={() => setPage((p) => p - 1)} style={[styles.pagerBtn, { opacity: page <= 1 ? 0.4 : 1 }]}>
                  <Icon name="chevron-left" size={20} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
                  Page {page} of {pageCount} · {total} bases
                </Text>
                <TouchableOpacity disabled={page >= pageCount} onPress={() => setPage((p) => p + 1)} style={[styles.pagerBtn, { opacity: page >= pageCount ? 0.4 : 1 }]}>
                  <Icon name="chevron-right" size={20} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  headerBlock: { gap: 12, marginBottom: 4 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 16 },
  pagerBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
