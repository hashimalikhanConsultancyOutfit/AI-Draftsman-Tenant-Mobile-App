import { StyleSheet, Text, View } from 'react-native';

import { Button, Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { ResolutionAction, TeamInteraction } from '../teamRun.types';
import {
  INTERACTION_BODY,
  INTERACTION_COPY,
  INTERACTION_TITLE,
  RESOLUTION_FALLBACK_LABEL,
  declineCopyFor,
  referenceFor,
} from '../teamChatRules';

export interface InteractionDecision {
  interactionId: string;
  decision: 'APPROVED' | 'REJECTED';
  chosenAction?: ResolutionAction;
  referenceId?: string;
}

interface TeamInteractionCardProps {
  interaction: TeamInteraction;
  canApprove: boolean;
  isResolving: boolean;
  onDecide: (decision: InteractionDecision) => void;
}

/**
 * A run paused for a person — web's `InteractionBlock`. One button per
 * resolution the server offers, plus decline (whose words follow
 * `rejectionOutcome`: skip the step, or stop the run). Without
 * `agent_team.approve` the card explains who can answer instead.
 * `CREATE_AGENT` opens the agent builder on web; here it says so.
 */
export function TeamInteractionCard({ interaction, canApprove, isResolving, onDecide }: TeamInteractionCardProps) {
  const { theme } = useAppTheme();
  const decline = declineCopyFor(interaction.rejectionOutcome);
  const options = interaction.options ?? [];
  const resolvable = options.filter((o) => o.action !== 'CREATE_AGENT');
  const offersCreate = options.some((o) => o.action === 'CREATE_AGENT');

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.statusWarningBg, borderRadius: theme.radii.xl }]}>
      <View style={styles.head}>
        <Icon name="pan-tool" size={18} color={theme.colors.statusWarningFg} />
        <Text style={{ color: theme.colors.statusWarningFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm, flex: 1 }}>
          {INTERACTION_TITLE[interaction.type]}
        </Text>
        {interaction.riskLevel !== 'LOW' && (
          <Text style={{ color: interaction.riskLevel === 'HIGH' ? theme.colors.error : theme.colors.statusWarningFg, fontSize: 11, fontFamily: theme.fontFamilies.body.semibold }}>
            {interaction.riskLevel === 'HIGH' ? INTERACTION_COPY.riskHigh : INTERACTION_COPY.riskMedium}
          </Text>
        )}
      </View>
      <Text style={{ color: theme.colors.text, fontSize: 13, lineHeight: 18 }}>{INTERACTION_BODY[interaction.type]}</Text>
      {interaction.reason ? <Text style={{ color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 }}>{interaction.reason}</Text> : null}

      {canApprove ? (
        <>
          <View style={styles.actions}>
            {resolvable.map((option) => {
              const ref = referenceFor(option);
              return (
                <Button
                  key={`${option.action}:${ref ?? ''}`}
                  label={isResolving ? INTERACTION_COPY.working : option.label || RESOLUTION_FALLBACK_LABEL[option.action] || option.action}
                  size="sm"
                  disabled={isResolving}
                  onPress={() => onDecide({ interactionId: interaction.id, decision: 'APPROVED', chosenAction: option.action, ...(ref ? { referenceId: ref } : {}) })}
                />
              );
            })}
            <Button
              label={decline.label}
              size="sm"
              variant={decline.danger ? 'danger' : 'outline'}
              disabled={isResolving}
              onPress={() => onDecide({ interactionId: interaction.id, decision: 'REJECTED' })}
            />
          </View>
          {resolvable.length === 0 && (
            <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{offersCreate ? INTERACTION_COPY.createOnWeb : INTERACTION_COPY.noOptions}</Text>
          )}
          <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{decline.hint}</Text>
        </>
      ) : (
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{INTERACTION_COPY.noPermission}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 8, padding: 12, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
