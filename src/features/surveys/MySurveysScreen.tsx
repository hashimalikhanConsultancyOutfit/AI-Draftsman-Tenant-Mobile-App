import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DrawerActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Loader, StatusTabs } from '@/components/ui';
import type { MySurveysStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme/ThemeContext';

import { useGetMySurveysQuery } from './mySurveysApi';
import type { MySurveyAssignment } from './surveys.types';
import { MY_SURVEYS_COPY } from './mySurveysRules';
import { appendUnique } from './surveysRules';
import { MySurveyCard } from './components/MySurveyCard';
import { MySurveyTubeMap } from './components/MySurveyTubeMap';

type Nav = NativeStackNavigationProp<MySurveysStackParamList>;
type ViewMode = 'list' | 'map';

const VIEW_TABS = [
  { value: 'list', label: MY_SURVEYS_COPY.listView },
  { value: 'map', label: MY_SURVEYS_COPY.mapView },
];

/**
 * My Surveys — web's `/my-surveys`: every survey the workspace has asked
 * YOU to fill in, newest first, cursor-paged behind "Load more"; the Tube
 * map takes the list's place. Ungated like web (any signed-in user can be
 * a respondent; the server scopes the reads to the caller).
 */
export function MySurveysScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [view, setView] = useState<ViewMode>('list');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<MySurveyAssignment[]>([]);

  const { data, isLoading, isFetching, error, refetch } = useGetMySurveysQuery({ cursor }, { skip: view !== 'list' });

  useEffect(() => {
    if (!data) return;
    setRows((prev) => {
      if (!cursor) return data.items;
      /* A later page appends; rows already held are refreshed in place
         (a submitted survey changes status). */
      const byId = new Map(data.items.map((r) => [r.id, r]));
      return appendUnique(prev.map((r) => byId.get(r.id) ?? r), data.items);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  /* Back from filling one in: start from the top so its new status shows. */
  const hasFocused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasFocused.current) {
        hasFocused.current = true;
        return;
      }
      setCursor(undefined);
    }, []),
  );

  const restart = () => {
    setCursor(undefined);
    void refetch();
  };
  const loadMore = () => {
    if (!isFetching && data?.hasMore && data.nextCursor) setCursor(data.nextCursor);
  };

  const openMenu = () => navigation.dispatch(DrawerActions.openDrawer());
  const openSettings = () => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never);
  const open = (a: MySurveyAssignment) => navigation.navigate('MySurveyFill', { assignmentId: a.id, title: a.survey.title });

  const topBlock = (
    <View style={styles.headerBlock}>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{MY_SURVEYS_COPY.description}</Text>
      <StatusTabs tabs={VIEW_TABS} value={view} onChange={(v) => setView(v as ViewMode)} />
    </View>
  );

  if (view === 'map') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={MY_SURVEYS_COPY.title} mode="tab" onMenuPress={openMenu} onAvatarPress={openSettings} />
        <MySurveyTubeMap header={topBlock} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={MY_SURVEYS_COPY.title} mode="tab" onMenuPress={openMenu} onAvatarPress={openSettings} />
      <FlatList
        data={error ? [] : rows}
        keyExtractor={(a) => a.id}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading && !cursor && rows.length > 0} onRefresh={restart} tintColor={theme.colors.accent} />}
        ListHeaderComponent={topBlock}
        renderItem={({ item }) => <MySurveyCard assignment={item} onOpen={() => open(item)} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          isLoading ? (
            <Loader label="Loading your surveys…" />
          ) : error ? (
            <ErrorState title={MY_SURVEYS_COPY.errorTitle} message={MY_SURVEYS_COPY.errorBody} onRetry={restart} />
          ) : (
            <EmptyState icon="assignment" title={MY_SURVEYS_COPY.emptyTitle} description={MY_SURVEYS_COPY.emptyBody} />
          )
        }
        ListFooterComponent={
          !error && rows.length > 0 && data?.hasMore ? (
            <View style={styles.pager}>
              <Button label={MY_SURVEYS_COPY.loadMore} variant="outline" loading={isFetching} onPress={loadMore} fullWidth />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  headerBlock: { gap: 12, marginBottom: 12 },
  pager: { paddingVertical: 16, paddingHorizontal: 8 },
});
