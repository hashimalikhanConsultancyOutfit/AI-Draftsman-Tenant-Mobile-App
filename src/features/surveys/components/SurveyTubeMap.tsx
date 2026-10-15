import { useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, Icon, Loader, TextField } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { useGetSurveyMapQuery } from '../surveysApi';
import type { SmSurveyWire } from '../surveys.types';
import { SURVEY_STAGES, TUBE_COPY, filterSurveyLines, surveyStops } from '../surveysRules';

const LINE_COLOURS = ['#C8622A', '#1E4DA8', '#2E9E5B', '#8A5A00', '#9B2042', '#1A3050', '#6D2B07', '#5B3FA8'];

interface SurveyTubeMapProps {
  header: ReactNode;
  onOpenSurvey: (id: string, title: string) => void;
}

/**
 * The Surveys tube map — web's `SurveyTubeMap` (`GET /surveys/map`) drawn
 * for a phone, the same way the Agents Teams map is: each survey is a
 * vertical line, its stops grouped under web's seven stages (Survey → Form
 * → Audience → Delivery → Responses → Review → Result). A stop that is not
 * there yet or needs a look is drawn hollow and dashed, as on web. Tapping
 * a line opens that survey.
 */
export function SurveyTubeMap({ header, onOpenSurvey }: SurveyTubeMapProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const { data, isLoading, isFetching, isError, refetch } = useGetSurveyMapQuery(undefined, { refetchOnMountOrArgChange: true });

  const all = data?.surveys ?? [];
  const lines = useMemo(() => filterSurveyLines(all, search), [all, search]);

  const renderLine = (s: SmSurveyWire, index: number) => {
    const colour = LINE_COLOURS[index % LINE_COLOURS.length]!;
    const stops = surveyStops(s);
    return (
      <TouchableOpacity
        key={s.id}
        activeOpacity={0.8}
        onPress={() => onOpenSurvey(s.id, s.title)}
        style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}
        accessibilityRole="button"
        accessibilityLabel={`${TUBE_COPY.openSurvey}: ${s.title}`}
      >
        <View style={styles.lineHeader}>
          <View style={[styles.swatch, { backgroundColor: colour }]} />
          <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={2}>
            {s.title}
          </Text>
          <Icon name="chevron-right" size={22} color={theme.colors.textMuted} />
        </View>
        {SURVEY_STAGES.map((stage) => {
          const here = stops.filter((st) => st.stage === stage.key);
          if (here.length === 0) return null;
          return (
            <View key={stage.key} style={styles.stage}>
              <Text style={[styles.stageLabel, { color: theme.colors.textMuted }]}>{stage.label.toUpperCase()}</Text>
              {here.map((st) => (
                <View key={st.id} style={styles.stopRow}>
                  <View style={[styles.rail, { backgroundColor: colour }]} />
                  <View
                    style={[
                      styles.dot,
                      st.dashed
                        ? { backgroundColor: theme.colors.surface, borderColor: colour, borderStyle: 'dashed' }
                        : { backgroundColor: colour, borderColor: colour },
                    ]}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: 13 }} numberOfLines={2}>
                      {st.label}
                    </Text>
                    {st.sublabel ? (
                      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12 }} numberOfLines={1}>
                        {st.sublabel}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
    >
      {header}
      {!isError && all.length > 0 ? (
        <TextField placeholder={TUBE_COPY.search} leftIcon="search" value={search} onChangeText={setSearch} autoCapitalize="none" autoCorrect={false} />
      ) : null}
      {isLoading ? (
        <Loader label="Loading the tube map…" />
      ) : isError ? (
        <ErrorState title={TUBE_COPY.errorTitle} message={TUBE_COPY.errorBody} onRetry={refetch} />
      ) : all.length === 0 ? (
        <EmptyState icon="poll" title={TUBE_COPY.emptyTitle} description={TUBE_COPY.emptyBody} />
      ) : lines.length === 0 ? (
        <EmptyState icon="search-off" title={TUBE_COPY.noMatch} />
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
