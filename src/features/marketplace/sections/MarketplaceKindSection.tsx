import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '@/components/ui';
import { MARKETPLACE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { useAppTheme } from '@/theme/ThemeContext';

import { NO_MARKETPLACE_VIEW_DESCRIPTION, NO_MARKETPLACE_VIEW_TITLE } from '../marketplaceRules';
import type { MarketplaceResource } from '../marketplace.types';
import { MarketplaceBrowsePanel } from './MarketplaceBrowsePanel';
import { OwnedAgentsPanel } from './OwnedAgentsPanel';
import { OwnedSkillsPanel } from './OwnedSkillsPanel';

interface MarketplaceKindSectionProps {
  resource: MarketplaceResource;
  onOpenEntry: (id: string) => void;
  onOpenOwnedSkill: (catalogueId: string) => void;
  onAddSkill: () => void;
}

const VIEW_LABEL: Record<MarketplaceResource, { owned: string }> = {
  skill: { owned: 'My skills' },
  agent: { owned: 'My agents' },
};

/**
 * Each of the Skills/Agents top-level tabs renders this — a 2-segment
 * toggle between the workspace's own tier ("My skills"/"My agents",
 * the opening view) and the platform-wide published catalogue
 * ("Marketplace"). Resets to "owned" on remount, matching web.
 */
export function MarketplaceKindSection({ resource, onOpenEntry, onOpenOwnedSkill, onAddSkill }: MarketplaceKindSectionProps) {
  const { theme } = useAppTheme();
  const canViewMarketplace = usePermission(MARKETPLACE_PERMISSIONS.VIEW);
  const [view, setView] = useState<'owned' | 'catalogue'>('owned');

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.segmentRow, { paddingHorizontal: 16, paddingTop: 12 }]}>
        {(['owned', 'catalogue'] as const).map((v) => {
          const active = view === v;
          return (
            <TouchableOpacity
              key={v}
              onPress={() => setView(v)}
              style={[styles.segment, { borderRadius: theme.radii.full, backgroundColor: active ? theme.colors.accent : theme.colors.statusNeutralBg }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={{ color: active ? theme.colors.textOnAccent : theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>
                {v === 'owned' ? VIEW_LABEL[resource].owned : 'Marketplace'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {view === 'owned' ? (
        resource === 'skill' ? (
          <OwnedSkillsPanel onOpenSkill={onOpenOwnedSkill} onAddSkill={onAddSkill} onBrowseCatalogue={() => setView('catalogue')} />
        ) : (
          <OwnedAgentsPanel onBrowseCatalogue={() => setView('catalogue')} />
        )
      ) : canViewMarketplace ? (
        <MarketplaceBrowsePanel resource={resource} onOpenEntry={onOpenEntry} />
      ) : (
        <View style={{ padding: 16 }}>
          <EmptyState icon="lock" title={NO_MARKETPLACE_VIEW_TITLE} description={NO_MARKETPLACE_VIEW_DESCRIPTION} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  segment: { paddingHorizontal: 14, paddingVertical: 8 },
});
