import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { buildEvaluationBadge, formatAgentVersion, isClonedAgent } from '../agentRules';
import type { Agent } from '../companyAgents.types';

interface AgentCardProps {
  agent: Agent;
  isEvaluating: boolean;
  onPress: () => void;
}

/** "Master definition" for a hand-built agent; names the source for an
 * installed one, generically when its listing has since been retired —
 * ported from the web app's `resolveSubtitle`. */
function subtitleFor(agent: Agent, cloned: boolean): string {
  if (!cloned) return 'Master definition';
  return agent.clonedFromMarketplace ? `From marketplace · ${agent.clonedFromMarketplace.name}` : 'Installed from marketplace';
}

/** First few words of the prompt, so the grid can be scanned by what an agent
 * DOES and not only by what it is called — matches web's tiny 3-word preview. */
function previewPrompt(prompt: string): string {
  const words = prompt.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  return words.length <= 6 ? words.join(' ') : `${words.slice(0, 6).join(' ')}…`;
}

const LIFECYCLE_LABEL: Record<Agent['state'], string> = {
  deployed: 'Deployed',
  draft: 'Draft',
  error: 'Error',
};

export function AgentCard({ agent, isEvaluating, onPress }: AgentCardProps) {
  const { theme } = useAppTheme();
  const badge = buildEvaluationBadge(agent.score);
  const cloned = isClonedAgent(agent);
  const preview = previewPrompt(agent.prompt);

  const badgeTone =
    badge.tone === 'success'
      ? { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg }
      : { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg };

  const lifecycleColor =
    agent.state === 'deployed' ? theme.colors.success : agent.state === 'error' ? theme.colors.error : theme.colors.textMuted;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${agent.name}`}
    >
      <View style={styles.top}>
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: cloned ? theme.colors.statusInfoBg : theme.colors.statusNeutralBg,
              borderRadius: theme.radii.md,
            },
          ]}
        >
          <Icon name={cloned ? 'storefront' : 'smart-toy'} size={20} color={cloned ? theme.colors.statusInfoFg : theme.colors.accent} />
        </View>

        <View style={styles.identity}>
          <Text
            style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}
            numberOfLines={2}
          >
            {agent.name}
          </Text>
          <Text
            style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }}
            numberOfLines={1}
          >
            {subtitleFor(agent, cloned)}
          </Text>
        </View>

        <Icon name="chevron-right" size={22} color={theme.colors.textMuted} />
      </View>

      {preview ? (
        <Text
          style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: 10 }}
          numberOfLines={1}
        >
          {preview}
        </Text>
      ) : null}

      <View
        style={[
          styles.metrics,
          { backgroundColor: theme.colors.statusNeutralBg, borderColor: theme.colors.border, borderRadius: theme.radii.md },
        ]}
      >
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>VERSION</Text>
          <Text style={[styles.metricValue, { color: theme.colors.text }]} numberOfLines={1}>
            {formatAgentVersion(agent)}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>LIFECYCLE</Text>
          <View style={styles.lifecycleRow}>
            <View style={[styles.dot, { backgroundColor: lifecycleColor }]} />
            <Text style={[styles.metricValue, { color: theme.colors.text }]} numberOfLines={1}>
              {LIFECYCLE_LABEL[agent.state]}
            </Text>
          </View>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>CLONES</Text>
          <Text style={[styles.metricValue, { color: theme.colors.text }]} numberOfLines={1}>
            {agent.clones}
          </Text>
        </View>
      </View>

      <View style={styles.tagsRow}>
        <View style={styles.tagsLead}>
          <View style={[styles.chip, styles.chipOutline, { borderColor: theme.colors.accent, borderRadius: theme.radii.full }]}>
            <Text style={[styles.chipText, { color: theme.colors.accent }]}>{cloned ? 'Cloned agent' : 'My agent'}</Text>
          </View>
          {agent.isSupportAgent && (
            <View style={[styles.chip, styles.chipOutline, { borderColor: theme.colors.secondary, borderRadius: theme.radii.full }]}>
              <Text style={[styles.chipText, { color: theme.colors.secondary }]}>Support</Text>
            </View>
          )}
        </View>

        {isEvaluating ? (
          <View style={[styles.chip, { backgroundColor: theme.colors.statusInfoBg, borderRadius: theme.radii.full }]}>
            <Text style={[styles.chipText, { color: theme.colors.statusInfoFg }]}>Evaluating…</Text>
          </View>
        ) : (
          <View style={[styles.chip, { backgroundColor: badgeTone.bg, borderRadius: theme.radii.full }]}>
            <Text style={[styles.chipText, { color: badgeTone.fg }]}>{badge.label}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 16, width: '100%' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1, minWidth: 0 },
  metrics: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, padding: 10, marginTop: 12, gap: 8 },
  metric: { flex: 1, gap: 3 },
  metricLabel: { fontFamily: 'InstrumentSans_700Bold', fontSize: 10, letterSpacing: 0.4 },
  metricValue: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 13, textTransform: 'capitalize' },
  lifecycleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  tagsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 },
  tagsLead: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  chip: { paddingHorizontal: 10, paddingVertical: 4 },
  chipOutline: { borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 11 },
});
