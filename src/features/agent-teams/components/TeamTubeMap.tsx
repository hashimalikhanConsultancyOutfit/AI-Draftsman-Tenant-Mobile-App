import { useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, Icon, Loader, TextField } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { useGetAgentTeamMapQuery } from '../agentTeamsApi';
import { TEAM_STAGES, TUBE_COPY, buildTubeModel, filterTubeLines, type TubeLine } from '../agentTeamsRules';
import { TagChip } from './TagChip';
import { TubeDetailSheet, type TubeSelection } from './TubeDetailSheet';

/** One colour per line, cycled — the tube map's line colours. */
const LINE_COLOURS = ['#C8622A', '#1E4DA8', '#2E9E5B', '#8A5A00', '#9B2042', '#1A3050', '#6D2B07', '#5B3FA8'];

interface TeamTubeMapProps {
  /** The screen's own header block (the Team list / Tube map toggle). */
  header: ReactNode;
  onOpenTeam: (teamId: string, name: string) => void;
}

/**
 * The Agents Teams tube map (design view) — web's `TeamTubeMap`, rebuilt
 * for a phone. Web draws every team as a horizontal line across seven
 * stage columns on a wide SVG canvas; a 390pt screen cannot hold that, so
 * here each team is a vertical line of its own, its stops grouped by the
 * same seven stages. What the canvas encoded is kept: a stop shared by
 * several teams is an interchange (a ringed dot and a "Shared by N" tag), a
 * stop that needs a look is drawn hollow and dashed, and tapping a stop or a
 * team opens the same details web shows in its side panel.
 */
export function TeamTubeMap({ header, onOpenTeam }: TeamTubeMapProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<TubeSelection>(null);

  const { data, isLoading, isFetching, isError, refetch } = useGetAgentTeamMapQuery(undefined, { refetchOnMountOrArgChange: true });

  const model = useMemo(() => (data ? buildTubeModel(data.teams ?? []) : null), [data]);
  const linesById = useMemo(() => new Map((model?.lines ?? []).map((l) => [l.id, l])), [model]);
  const lines = useMemo(() => filterTubeLines(model?.lines ?? [], search), [model, search]);
  const colourOf = (lineId: string) => LINE_COLOURS[Math.max(0, (model?.lines ?? []).findIndex((l) => l.id === lineId)) % LINE_COLOURS.length] ?? LINE_COLOURS[0]!;

  const renderLine = (line: TubeLine) => {
    const colour = colourOf(line.id);
    return (
      <View key={line.id} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}>
        <TouchableOpacity onPress={() => setSelection({ kind: 'line', line })} style={styles.lineHeader} accessibilityRole="button" accessibilityLabel={`Details for ${line.name}`}>
          <View style={[styles.lineSwatch, { backgroundColor: colour }]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={1}>
              {line.name}
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.xs }}>
              {line.team.members.length} member{line.team.members.length === 1 ? '' : 's'} · revision {line.team.revision}
            </Text>
          </View>
          <Icon name="info-outline" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>

        {TEAM_STAGES.slice(1).map((stage) => {
          const stops = line.stops.filter((s) => s.stage === stage.key);
          if (stops.length === 0) return null;
          return (
            <View key={stage.key}>
              <Text style={[styles.stageLabel, { color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold }]}>{stage.label.toUpperCase()}</Text>
              {stops.map((s) => {
                const station = model?.stations.get(s.id);
                const dashed = s.dashed;
                const interchange = station?.isInterchange ?? false;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => station && setSelection({ kind: 'station', station })}
                    style={styles.stopRow}
                    accessibilityRole="button"
                    accessibilityLabel={`${s.label}${dashed ? ', needs a look' : ''}`}
                  >
                    <View style={styles.rail}>
                      <View style={[styles.railLine, { backgroundColor: colour }]} />
                      <View
                        style={[
                          interchange ? styles.dotInterchange : styles.dot,
                          {
                            borderColor: colour,
                            backgroundColor: dashed ? theme.colors.surface : interchange ? theme.colors.surface : colour,
                            borderStyle: dashed ? 'dashed' : 'solid',
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.stopText}>
                      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }} numberOfLines={2}>
                        {s.label}
                      </Text>
                      {s.sublabel ? <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{s.sublabel}</Text> : null}
                    </View>
                    {interchange && station && <TagChip label={`Shared by ${station.lineIds.length}`} tone="accent" />}
                    {dashed && <TagChip label="Needs a look" tone="warning" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </View>
    );
  };

  let content: ReactNode;
  if (isLoading) {
    content = <Loader label="Loading the tube map…" />;
  } else if (isError) {
    content = <ErrorState title={TUBE_COPY.errorTitle} message={TUBE_COPY.errorMessage} retryLabel="Try again" onRetry={() => void refetch()} />;
  } else if ((model?.lines.length ?? 0) === 0) {
    content = <EmptyState icon="account-tree" title={TUBE_COPY.emptyTitle} description={TUBE_COPY.emptyDescription} />;
  } else {
    content = (
      <>
        <TextField placeholder={TUBE_COPY.searchPlaceholder} leftIcon="search" value={search} onChangeText={setSearch} autoCapitalize="none" autoCorrect={false} />
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.xs, lineHeight: 17 }}>
          {TUBE_COPY.stationHint} {TUBE_COPY.dashedMeaning}
        </Text>
        {lines.length === 0 ? <EmptyState icon="search-off" title="No matches" description={TUBE_COPY.noMatches} /> : lines.map(renderLine)}
      </>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} tintColor={theme.colors.accent} />}
      >
        {header}
        {content}
      </ScrollView>
      <TubeDetailSheet
        selection={selection}
        linesById={linesById}
        stationsById={model?.stations ?? new Map()}
        onClose={() => setSelection(null)}
        onFollow={(lineId) => {
          const line = linesById.get(lineId);
          setSelection(line ? { kind: 'line', line } : null);
        }}
        onOpenTeam={(id, name) => {
          setSelection(null);
          onOpenTeam(id, name);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  lineHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  lineSwatch: { width: 6, height: 32, borderRadius: 3 },
  stageLabel: { fontSize: 10, letterSpacing: 0.6, marginTop: 10, marginBottom: 2, marginLeft: 30 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  rail: { width: 22, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  railLine: { position: 'absolute', top: 0, bottom: 0, width: 4, borderRadius: 2 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
  dotInterchange: { width: 18, height: 18, borderRadius: 9, borderWidth: 4 },
  stopText: { flex: 1, minWidth: 0, paddingVertical: 6 },
});
