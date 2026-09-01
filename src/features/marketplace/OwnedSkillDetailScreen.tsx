import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppHeader } from '@/components/shell/AppHeader';
import { Card, EmptyState } from '@/components/ui';
import { useAppSelector } from '@/store/hooks';
import { selectClonedEntries } from '@/store/marketplaceClonesSlice';
import { useAppTheme } from '@/theme/ThemeContext';

import type { MarketplaceStackParamList } from '@/navigation/types';
import { CATALOGUE_JOIN_LIMIT, CLONED_BADGE_LABEL, OWN_BADGE_LABEL, SKILL_DETAIL_GAP, formatDate } from './marketplaceRules';
import { useGetSkillsQuery } from './marketplaceApi';

type Nav = NativeStackNavigationProp<MarketplaceStackParamList>;
type Rt = RouteProp<MarketplaceStackParamList, 'OwnedSkillDetail'>;

/**
 * One installed/authored skill from "My skills" — reconstructed the same
 * way `OwnedSkillsPanel` builds its rows: the session's clone record joined
 * against a page of the public catalogue for description/category only.
 * Ported from web's `SkillDetailModal`. Deliberately thin, and says so —
 * see `SKILL_DETAIL_GAP` — and carries no actions: there is no endpoint
 * behind an edit, delete, or run for a workspace skill.
 */
export function OwnedSkillDetailScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { catalogueId } = route.params;

  const clonedRecords = useAppSelector(selectClonedEntries('skill'));
  const record = clonedRecords[catalogueId];

  const { data: catalogue } = useGetSkillsQuery({ limit: CATALOGUE_JOIN_LIMIT }, { skip: !record });
  const joined = useMemo(() => (catalogue?.items ?? []).find((s) => s.id === catalogueId), [catalogue, catalogueId]);

  if (!record) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Skill" mode="stack" onBack={() => navigation.goBack()} />
        <View style={{ padding: 16 }}>
          <EmptyState
            icon="extension"
            title="This skill isn't in this session anymore"
            description="My skills only remembers what was added or installed since you opened the app — restarting the app clears this list, though the skill itself is unaffected. See it again under Marketplace."
          />
        </View>
      </View>
    );
  }

  const cloned = record.origin === 'installed';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={record.name} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
            <Text style={{ fontSize: 18 }}>🧩</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg }}>{record.name}</Text>
            <View style={[styles.chip, { backgroundColor: cloned ? theme.colors.statusInfoBg : theme.colors.statusSuccessBg, alignSelf: 'flex-start', marginTop: 6 }]}>
              <Text style={{ color: cloned ? theme.colors.statusInfoFg : theme.colors.statusSuccessFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>
                {cloned ? CLONED_BADGE_LABEL : OWN_BADGE_LABEL}
              </Text>
            </View>
          </View>
        </View>

        {joined?.description && (
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20, marginTop: 12 }}>
            {joined.description}
          </Text>
        )}

        <Card style={{ marginTop: 16 }}>
          {(
            [
              ['Category', joined?.category?.name ?? '—'],
              ['Origin', cloned ? 'Installed from the Skills Marketplace' : 'Authored in this workspace'],
              [cloned ? 'Installed' : 'Added', formatDate(record.savedAt)],
            ] as const
          ).map(([label, value], i) => (
            <View key={label} style={[styles.fieldRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }]}>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{label}</Text>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.xs }}>{value}</Text>
            </View>
          ))}
        </Card>

        <Card style={{ marginTop: 12, backgroundColor: theme.colors.statusInfoBg, borderWidth: 0 }}>
          <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 18 }}>
            <Text style={{ fontFamily: theme.fontFamilies.body.semibold }}>That is all there is: </Text>
            {SKILL_DETAIL_GAP}
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconCircle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
});
