import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { TEAM_STAGES, stopFactRows, teamSummaryRows, type TubeLine, type TubeStation } from '../agentTeamsRules';
import { TagChip } from './TagChip';

export type TubeSelection = { kind: 'station'; station: TubeStation } | { kind: 'line'; line: TubeLine } | null;

interface TubeDetailSheetProps {
  selection: TubeSelection;
  linesById: ReadonlyMap<string, TubeLine>;
  stationsById: ReadonlyMap<string, TubeStation>;
  onClose: () => void;
  /** Follow a team from a stop's "Teams on this stop" list. */
  onFollow: (lineId: string) => void;
  /** Open the team's own detail screen. */
  onOpenTeam: (teamId: string, name: string) => void;
}

function Field({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.medium, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>{value}</Text>
    </View>
  );
}

/**
 * The tube map's side panel, as a bottom sheet — web's `TeamStopDetail`
 * (a tapped stop) and `TeamDetail` (a followed team) in one.
 */
export function TubeDetailSheet({ selection, linesById, stationsById, onClose, onFollow, onOpenTeam }: TubeDetailSheetProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  const body = (() => {
    if (!selection) return null;
    if (selection.kind === 'station') {
      const s = selection.station;
      const facts = stopFactRows(s);
      const teams = s.lineIds.map((id) => linesById.get(id)).filter((l): l is TubeLine => Boolean(l));
      return (
        <>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontFamily: theme.fontFamilies.body.medium }}>{s.noun}</Text>
          <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold }]}>{s.label}</Text>
          <View style={styles.tags}>
            {s.isInterchange && <TagChip label={`Shared by ${s.lineIds.length} teams`} tone="accent" />}
            {s.isTerminus && <TagChip label="Start or end" tone="info" />}
            {s.dashed && <TagChip label="Needs a look" tone="warning" />}
          </View>
          {typeof facts === 'string' ? (
            <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.sm, lineHeight: 19 }}>{facts}</Text>
          ) : (
            facts.map((f) => <Field key={f.label} label={f.label} value={f.value} />)
          )}
          <Text style={[styles.section, { color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.medium }]}>
            {teams.length === 1 ? 'Team on this stop' : 'Teams on this stop'}
          </Text>
          {teams.map((line) => (
            <TouchableOpacity key={line.id} onPress={() => onFollow(line.id)} style={[styles.teamRow, { borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, flex: 1 }} numberOfLines={1}>
                {line.name}
              </Text>
              <Icon name="chevron-right" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ))}
        </>
      );
    }

    const { line } = selection;
    const team = line.team;
    return (
      <>
        <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold }]}>{team.name}</Text>
        {team.purpose ? <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.sm, marginBottom: 8 }}>{team.purpose}</Text> : null}
        {teamSummaryRows(team).map((r) => (
          <Field key={r.label} label={r.label} value={r.value} />
        ))}
        <Text style={[styles.section, { color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.medium }]}>Its design</Text>
        {TEAM_STAGES.slice(1, 6).map((stage) => {
          const stops = line.stops.filter((s) => s.stage === stage.key).map((s) => stationsById.get(s.id)?.label ?? s.label);
          return (
            <Text key={stage.key} style={{ color: theme.colors.text, fontSize: theme.fontSizes.sm, marginBottom: 4 }}>
              <Text style={{ color: theme.colors.textMuted }}>{stage.label.replace(/^\d+ · /, '')}: </Text>
              {stops.length ? stops.join(', ') : 'none'}
            </Text>
          );
        })}
        <TouchableOpacity
          onPress={() => onOpenTeam(team.id, team.name)}
          style={[styles.openTeam, { backgroundColor: theme.colors.accent, borderRadius: theme.radii.lg }]}
          accessibilityRole="button"
        >
          <Text style={{ color: theme.colors.textOnAccent, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>Open team</Text>
        </TouchableOpacity>
      </>
    );
  })();

  return (
    <Modal visible={selection !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 16, borderTopLeftRadius: theme.radii.sheetTop, borderTopRightRadius: theme.radii.sheetTop },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          <View style={styles.header}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={22} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.body}>{body}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '80%', paddingTop: 8 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  body: { paddingHorizontal: 20, paddingBottom: 8, gap: 6 },
  title: { fontSize: 17, marginBottom: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  field: { paddingVertical: 5, gap: 2 },
  section: { fontSize: 11, marginTop: 12, marginBottom: 4 },
  teamRow: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  openTeam: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginTop: 14 },
});
