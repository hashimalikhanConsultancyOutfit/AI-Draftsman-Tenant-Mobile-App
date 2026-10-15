import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DrawerActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Loader, PickerField, StatusTabs } from '@/components/ui';
import type { SurveysStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme/ThemeContext';

import { useGetSurveysQuery } from './surveysApi';
import type { Survey, SurveyStatus } from './surveys.types';
import { STATUS_FILTERS, SURVEYS_COPY, appendUnique } from './surveysRules';
import { SurveyCard } from './components/SurveyCard';
import { SurveyTubeMap } from './components/SurveyTubeMap';

type Nav = NativeStackNavigationProp<SurveysStackParamList>;
type ViewMode = 'list' | 'map';

const VIEW_TABS = [
  { value: 'list', label: SURVEYS_COPY.listView },
  { value: 'map', label: SURVEYS_COPY.mapView },
];

/**
 * Surveys — the list, ported from web's `Surveys` page: a status filter,
 * cursor pagination behind "Load more" (the same pattern as every other
 * growing list in this app), and the Tube map taking the list's place
 * rather than opening over it.
 */
export function SurveysScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const [view, setView] = useState<ViewMode>('list');
  const [status, setStatus] = useState<'' | SurveyStatus>('');
  /* The cursor of the page being read; `undefined` is the first page, which
     always REPLACES the rows held, so a refresh or a new filter restarts. */
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<Survey[]>([]);

  const { data, isLoading, isFetching, error, refetch } = useGetSurveysQuery(
    { status: status || undefined, cursor },
    { skip: view !== 'list' },
  );

  useEffect(() => {
    if (!data) return;
    setRows((prev) => (cursor ? appendUnique(prev, data.items) : data.items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const restart = useCallback(() => {
    setCursor(undefined);
    void refetch();
  }, [refetch]);

  /* Back from New survey or a survey's page: start again from page one so a
     new survey (which lands on top) and an edited status both show. */
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

  const changeStatus = (next: string) => {
    setStatus(next as '' | SurveyStatus);
    setCursor(undefined);
    setRows([]);
  };

  const loadMore = () => {
    if (isFetching || !data?.hasMore || !data.nextCursor) return;
    setCursor(data.nextCursor);
  };

  const openMenu = () => navigation.dispatch(DrawerActions.openDrawer());
  const openSettings = () => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never);
  const newSurvey = () => navigation.navigate('SurveyWizard');
  const openSurvey = (id: string, title?: string) => navigation.navigate('SurveyDetail', { id, title });

  const topBlock = (
    <View style={styles.headerBlock}>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{SURVEYS_COPY.description}</Text>
      <StatusTabs tabs={VIEW_TABS} value={view} onChange={(v) => setView(v as ViewMode)} />
    </View>
  );

  if (view === 'map') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={SURVEYS_COPY.title} mode="tab" onMenuPress={openMenu} onAvatarPress={openSettings} />
        <SurveyTubeMap header={topBlock} onOpenSurvey={openSurvey} />
      </View>
    );
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      {topBlock}
      <Button label={SURVEYS_COPY.newSurvey} icon="add" onPress={newSurvey} fullWidth />
      <PickerField label="Status" value={status} options={STATUS_FILTERS} onChange={changeStatus} />
    </View>
  );

  const showingFirstLoad = isLoading || (isFetching && rows.length === 0 && !cursor);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={SURVEYS_COPY.title} mode="tab" onMenuPress={openMenu} onAvatarPress={openSettings} />
      <FlatList
        data={error ? [] : rows}
        keyExtractor={(s) => s.id}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading && !cursor && rows.length > 0} onRefresh={restart} tintColor={theme.colors.accent} />}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => <SurveyCard survey={item} onOpen={() => openSurvey(item.id, item.title)} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          showingFirstLoad ? (
            <Loader label="Loading surveys…" />
          ) : error ? (
            <ErrorState title={SURVEYS_COPY.errorTitle} message={SURVEYS_COPY.errorBody} onRetry={restart} />
          ) : (
            <EmptyState icon="poll" title={SURVEYS_COPY.emptyTitle} description={SURVEYS_COPY.emptyBody} actionLabel={SURVEYS_COPY.newSurvey} onAction={newSurvey} />
          )
        }
        ListFooterComponent={
          !error && rows.length > 0 && data?.hasMore ? (
            <View style={styles.pager}>
              <Button label={SURVEYS_COPY.loadMore} variant="outline" loading={isFetching} onPress={loadMore} fullWidth />
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
  pager: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 8 },
});
