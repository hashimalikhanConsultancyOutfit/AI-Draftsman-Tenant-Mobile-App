/**
 * AgentRosterCard — one card in the Playground's agent roster.
 *
 * Ported from the web app's `AgentRoster.tsx` card: name + state badge on
 * top, model underneath, a two-line prompt preview, a metadata strip
 * (version, price when `billing.view` allows it, knowledge base), and an
 * "Edit prompt" action gated on `agent.build`. Tapping the card selects the
 * agent, exactly as on web.
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/ui';
import type { Agent } from '@/features/company-agents/companyAgents.types';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatMoney } from '@/utils/format';

interface AgentRosterCardProps {
  agent: Agent;
  selected: boolean;
  canViewPricing: boolean;
  canBuild: boolean;
  onSelect: () => void;
  onEditPrompt: () => void;
}

export function AgentRosterCard({ agent, selected, canViewPricing, canBuild, onSelect, onEditPrompt }: AgentRosterCardProps) {
  const { theme } = useAppTheme();

  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.xl,
          borderWidth: selected ? 2 : theme.borders.hairline,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
        },
      ]}
    >
      <View style={styles.head}>
        <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={1}>
          {agent.name}
        </Text>
        <View
          style={[
            styles.stateChip,
            { backgroundColor: agent.state === 'deployed' ? theme.colors.statusSuccessBg : theme.colors.statusNeutralBg, borderRadius: theme.radii.full },
          ]}
        >
          <Text
            style={{
              fontFamily: theme.fontFamilies.body.semibold,
              fontSize: theme.fontSizes.xs,
              color: agent.state === 'deployed' ? theme.colors.statusSuccessFg : theme.colors.textMuted,
              textTransform: 'capitalize',
            }}
          >
            {agent.state}
          </Text>
        </View>
      </View>

      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }} numberOfLines={1}>
        {agent.model}
      </Text>

      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: 8 }} numberOfLines={2}>
        {agent.prompt || 'No prompt set for this agent.'}
      </Text>

      <View style={[styles.metaRow, { borderTopColor: theme.colors.border }]}>
        <View style={styles.metaItems}>
          <Meta label="Version" value={`v${agent.ver}`} />
          {canViewPricing ? <Meta label="Price" value={formatMoney(agent.price)} /> : null}
          <Meta label="KB" value={agent.kb} />
        </View>

        {canBuild ? (
          <Button label="Edit prompt" size="sm" variant="outline" icon="edit" onPress={onEditPrompt} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.metaItem}>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{label}</Text>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, marginBottom: 10, width: '100%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stateChip: { paddingHorizontal: 8, paddingVertical: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  metaItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, flex: 1, minWidth: 0 },
  metaItem: { gap: 2 },
});
