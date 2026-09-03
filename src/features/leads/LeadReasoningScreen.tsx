import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Card, EmptyState, ErrorState, Loader } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { LeadsStackParamList } from '@/navigation/types';
import { useGetLeadsQuery } from './leadsApi';
import { SCORING_CALLOUT, buildReasoningRows, leadScoreTone } from './leadsRules';
import type { StatusTone } from './leads.types';

type Nav = NativeStackNavigationProp<LeadsStackParamList>;

function toneColors(theme: ReturnType<typeof useAppTheme>['theme'], tone: StatusTone) {
  if (tone === 'success') return { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg };
  if (tone === 'danger') return { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg };
  if (tone === 'warning') return { bg: theme.colors.statusWarningBg, fg: theme.colors.statusWarningFg };
  return { bg: theme.colors.statusNeutralBg, fg: theme.colors.textMuted };
}

/** "Scoring agent reasoning" — the audit table, ported from web's
 * `ReasoningTable`. A separate pushed screen on mobile rather than a
 * section stacked below the board (there is no room to show both a full
 * stage list and a reasoning table on one screen), reached from the
 * Leads screen's own header action. */
export function LeadReasoningScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const { data: leads, isLoading, error, refetch } = useGetLeadsQuery();
  const rows = buildReasoningRows(leads ?? []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Scoring reasoning" mode="stack" onBack={() => navigation.goBack()} />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20, marginBottom: 4 }}>
            {SCORING_CALLOUT}
          </Text>
        }
        renderItem={({ item }) => {
          const tone = toneColors(theme, leadScoreTone(item.score));
          return (
            <Card style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md, flex: 1 }} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={[styles.chip, { backgroundColor: tone.bg, borderRadius: theme.radii.full }]}>
                  <Text style={{ color: tone.fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12 }}>{item.score}</Text>
                </View>
              </View>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 2 }}>
                {item.src} · {item.stage}
              </Text>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20, marginTop: 8 }}>{item.why}</Text>
            </Card>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          isLoading ? (
            <Loader />
          ) : error ? (
            <ErrorState title="Could not load reasoning" message={getErrorMessage(error as never, 'Something went wrong.')} onRetry={refetch} />
          ) : (
            <EmptyState icon="fact-check" title="No scored leads yet" description="Reasoning appears here once the scoring agent has assessed a lead." />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  row: { gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 3 },
});
