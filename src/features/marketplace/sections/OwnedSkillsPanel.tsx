import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, useToast } from '@/components/ui';
import { MARKETPLACE_PERMISSIONS } from '@/permissions/slugs';
import { useEveryPermission, usePermission } from '@/permissions/usePermission';
import { useAppSelector } from '@/store/hooks';
import { selectClonedEntries } from '@/store/marketplaceClonesSlice';
import { useAppTheme } from '@/theme/ThemeContext';

import { SkillCard } from '../components/SkillCard';
import { CATALOGUE_JOIN_LIMIT, NO_AUTHOR_TOOLTIP, SESSION_SCOPE_NOTE, emptyOwnedSkillsDescription } from '../marketplaceRules';
import { useGetSkillsQuery } from '../marketplaceApi';
import type { SkillRow } from '../marketplace.types';

interface OwnedSkillsPanelProps {
  onOpenSkill: (catalogueId: string) => void;
  onAddSkill: () => void;
  onBrowseCatalogue: () => void;
}

/** The workspace's own skill library — reconstructed entirely client-side
 * from the session-scoped clone record (no `GET /tenant-skills` exists),
 * joined against one page of the public catalogue for description/category
 * only. See marketplaceRules.SESSION_SCOPE_NOTE for why the banner is
 * unconditional. */
export function OwnedSkillsPanel({ onOpenSkill, onAddSkill, onBrowseCatalogue }: OwnedSkillsPanelProps) {
  const { theme } = useAppTheme();
  const toast = useToast();
  const clonedRecords = useAppSelector(selectClonedEntries('skill'));
  const hasInstalls = Object.keys(clonedRecords).length > 0;
  const canInstall = usePermission(MARKETPLACE_PERMISSIONS.INSTALL);
  const canAuthor = useEveryPermission([MARKETPLACE_PERMISSIONS.MANAGE, MARKETPLACE_PERMISSIONS.INSTALL]);

  const { data: catalogue, isFetching } = useGetSkillsQuery({ limit: CATALOGUE_JOIN_LIMIT }, { skip: !hasInstalls });

  const rows: SkillRow[] = useMemo(() => {
    const byId = new Map((catalogue?.items ?? []).map((s) => [s.id, s]));
    return Object.entries(clonedRecords)
      .map(([catalogueId, record]) => {
        const joined = byId.get(catalogueId);
        const row: SkillRow = {
          catalogueId,
          cloneId: record.cloneId,
          name: record.name,
          savedAt: record.savedAt,
          description: joined?.description ?? null,
          categoryName: joined?.category?.name ?? null,
          origin: record.origin,
        };
        return row;
      })
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  }, [clonedRecords, catalogue]);

  const handleAddSkill = () => {
    if (!canAuthor) {
      toast.show(NO_AUTHOR_TOOLTIP, { tone: 'warning' });
      return;
    }
    onAddSkill();
  };

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.catalogueId}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <Card style={{ backgroundColor: theme.colors.statusInfoBg, borderWidth: 0 }}>
            <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 18 }}>
              <Text style={{ fontFamily: theme.fontFamilies.body.semibold }}>This session only: </Text>
              {SESSION_SCOPE_NOTE}
            </Text>
          </Card>
          <Button label="Add skill" icon="add" variant="outline" onPress={handleAddSkill} loading={isFetching && hasInstalls} fullWidth />
          {rows.length > 0 && (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
              {rows.length} skill{rows.length === 1 ? '' : 's'}
            </Text>
          )}
        </View>
      }
      renderItem={({ item }) => <SkillCard skill={item} onPress={() => onOpenSkill(item.catalogueId)} />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListEmptyComponent={
        <EmptyState
          icon="extension"
          title="No skills yet"
          description={emptyOwnedSkillsDescription(canInstall)}
          actionLabel={canInstall ? 'Browse marketplace' : undefined}
          onAction={canInstall ? onBrowseCatalogue : undefined}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
});
