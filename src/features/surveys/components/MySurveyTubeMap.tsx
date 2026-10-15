import { useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, Loader, TextField } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { useGetMySurveyMapQuery } from '../mySurveysApi';
import type { MsSurveyWire } from '../surveys.types';
import { MY_SURVEY_STAGES, MY_TUBE_COPY, filterMyLines, mySurveyStops } from '../mySurveysRules';

const LINE_COLOURS = ['#C8622A', '#1E4DA8', '#2E9E5B', '#8A5A00', '#9B2042', '#1A3050', '#6D2B07', '#5B3FA8'];

/**
 * My Surveys' tube map — web's `MySurveyTubeMap` (`GET /my/surveys/map`):
 * one line per survey you were asked, through Survey → Opened → State →
 * Due → Tally, drawn vertically for a phone like the other maps in this
 * app. Read-only, as on web (the map carries no assignment to open).
 */
export function MySurveyTubeMap({ header }: { header: ReactNode }) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const { data, isLoading, isFetching, isError, refetch } = useGetMySurveyMapQuery(undefined, { refetchOnMountOrArgChange: true });
  const all = data?.surveys ?? [];
  const lines = useMemo(() => filterMyLines(all, search), [all, search]);

  const renderLine = (s: MsSurveyWire, index: number) => {
    const colour = LINE_COLOURS[index % LINE_COLOURS.length]!;
    const stops = mySurveyStops(s);
    return (
      <View key={s.surveyId} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}>
        <View style={styles.lineHeader}>
          <View style={[styles.swatch, { backgroundColor: colour }]} />
          <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={2}>
            {s.title}
          </Text>
        </View>
        {MY_SURVEY_STAGES.map((stage) => {
          const here = stops.filter((st) => st.stage === stage.key);
          if (here.length === 0) return null;
          return (
            <View key={stage.key} style={styles.stage}>
              <Text style={[styles.stageLabel, { color: theme.colors.textMuted }]}>{stage.label.toUpperCase()}</Text>
              {here.map((st) => (
                <View key={st.id} style={styles.stopRow}>
                  <View style={[styles.rail, { backgroundColor: colour }]} />
                  <View style={[styles.dot, st.dashed ? { backgroundColor: theme.colors.surface, borderColor: colour, borderStyle: 'dashed' } : { backgroundColor: colour, borderColor: colour }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: 13 }} numberOfLines={2}>
                      {st.label}
                    </Text>
                    {st.sublabel ? <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{st.sublabel}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
    >
      {header}
      {!isError && all.length > 0 ? <TextField placeholder={MY_TUBE_COPY.search} leftIcon="search" value={search} onChangeText={setSearch} autoCapitalize="none" autoCorrect={false} /> : null}
      {isLoading ? (
        <Loader label="Loading the tube map…" />
      ) : isError ? (
        <ErrorState title={MY_TUBE_COPY.errorTitle} message={MY_TUBE_COPY.errorBody} onRetry={refetch} />
      ) : all.length === 0 ? (
        <EmptyState icon="assignment" title={MY_TUBE_COPY.emptyTitle} description={MY_TUBE_COPY.emptyBody} />
      ) : lines.length === 0 ? (
        <EmptyState icon="search-off" title={MY_TUBE_COPY.noMatch} />
      ) : (
        lines.map((s) => renderLine(s, all.indexOf(s)))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 8 },
  lineHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  stage: { gap: 6, marginTop: 4 },
  stageLabel: { fontFamily: 'InstrumentSans_700Bold', fontSize: 10, letterSpacing: 0.4 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 2 },
  rail: { position: 'absolute', left: 7, top: -6, bottom: -6, width: 3, opacity: 0.35 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
});
