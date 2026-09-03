import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { EmptyState, ErrorState, Loader, TextField } from '@/components/ui';
import { useDebouncedValue } from '@/features/marketplace/useDebouncedValue';
import { CHAT_PERMISSIONS, USAGE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';
import type { ChatConversationStackParamList } from '@/navigation/types';

import type { ChatThread } from './chat.types';
import {
  NO_ACCESS_BODY,
  NO_ACCESS_TITLE,
  SEARCH_DEBOUNCE_MS,
  SEARCH_EMPTY_BODY,
  SEARCH_EMPTY_TITLE,
  SEARCH_PLACEHOLDER,
  THREADS_ERROR_TITLE,
} from './chatRules';
import { useGetChatThreadsQuery } from './chatApi';
import { ThreadCard } from './components/ThreadCard';

type Nav = NativeStackNavigationProp<ChatConversationStackParamList>;

/**
 * A dedicated search screen rather than an inline field on ThreadList
 * (C-03) — the web renders this as a dialog over the same 280px column;
 * a phone gives it the whole screen instead, matching D-1's reasoning.
 *
 * The server matches the TITLE ONLY (docs/chat-module-spec.md §1), so the
 * empty state says that explicitly rather than implying a broader miss.
 */
export function ChatThreadSearchScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const canView = usePermission(CHAT_PERMISSIONS.VIEW);
  const canViewCost = usePermission(USAGE_PERMISSIONS.VIEW);

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);

  const searchQuery = useGetChatThreadsQuery(
    { search: debouncedQuery },
    { skip: !canView || debouncedQuery.length === 0 },
  );

  const openThread = (thread: ChatThread) => {
    navigation.navigate('ChatConversation', { conversationId: thread.id, title: thread.title });
  };

  if (!canView) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Search threads" mode="stack" onBack={() => navigation.goBack()} />
        <EmptyState icon="lock-outline" title={NO_ACCESS_TITLE} description={NO_ACCESS_BODY} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Search threads" mode="stack" onBack={() => navigation.goBack()} />
      <View style={styles.searchBar}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={SEARCH_PLACEHOLDER}
          leftIcon="search"
          autoFocus
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>

      {debouncedQuery.length === 0 ? (
        <EmptyState icon="search" title="Search your threads" description="Matches the thread name only." />
      ) : searchQuery.isFetching && !searchQuery.data ? (
        <Loader fullScreen />
      ) : searchQuery.error ? (
        <ErrorState
          title={THREADS_ERROR_TITLE}
          message={getErrorMessage(searchQuery.error)}
          onRetry={searchQuery.refetch}
        />
      ) : (
        <FlatList
          data={searchQuery.data?.items ?? []}
          keyExtractor={(t) => t.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          renderItem={({ item }) => (
            <ThreadCard
              thread={item}
              onPress={() => openThread(item)}
              onLongPress={() => undefined}
              canViewCost={canViewCost}
              selectable={false}
              selected={false}
              onToggleSelect={() => undefined}
            />
          )}
          ListEmptyComponent={<EmptyState icon="search-off" title={SEARCH_EMPTY_TITLE} description={SEARCH_EMPTY_BODY} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: { paddingHorizontal: 16, paddingTop: 8 },
  list: { padding: 16, gap: 10 },
});
