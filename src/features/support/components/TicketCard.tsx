/**
 * One ticket, as a card — the mobile shape for web's inbox table row
 * (`Support.tsx`, confirmed against that source 2026-09-04). Columns
 * re-flow into stacked lines: reference + state, subject (with an
 * unread dot, a priority flag and a paperclip count folded in, exactly
 * what the web table crowds into one cell), customer/owner, and SLA +
 * raised-time on the last line.
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { SupportTicket } from '../support.types';
import { PRIORITY_FLAG_TONE, PRIORITY_LABEL, SLA_LABEL, SLA_TONE, TICKET_STATE_LABEL, TICKET_STATE_TONE } from '../supportRules';
import { StatusChip } from './StatusChip';

interface TicketCardProps {
  ticket: SupportTicket;
  onPress: () => void;
}

export function TicketCard({ ticket, onPress }: TicketCardProps) {
  const { theme } = useAppTheme();
  const priorityTone = PRIORITY_FLAG_TONE[ticket.priority];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.xl,
          borderWidth: theme.borders.hairline,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.medium, fontSize: 11 }}>{ticket.reference}</Text>
        <StatusChip label={TICKET_STATE_LABEL[ticket.state]} tone={TICKET_STATE_TONE[ticket.state]} />
      </View>

      <View style={styles.subjectRow}>
        {ticket.unread ? <View style={[styles.unreadDot, { backgroundColor: theme.colors.accent }]} /> : null}
        <Text
          style={{ color: theme.colors.text, fontFamily: ticket.unread ? theme.fontFamilies.body.semibold : theme.fontFamilies.body.medium, fontSize: theme.fontSizes.md, flex: 1 }}
          numberOfLines={2}
        >
          {ticket.subject}
        </Text>
      </View>

      <View style={styles.metaRow}>
        {priorityTone ? <StatusChip label={PRIORITY_LABEL[ticket.priority]} tone={priorityTone} /> : null}
        {ticket.attachments.length > 0 ? (
          <View style={styles.inlineIcon}>
            <Icon name="attach-file" size={13} color={theme.colors.textMuted} />
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{ticket.attachments.length}</Text>
          </View>
        ) : null}
        {ticket.escalated ? <StatusChip label="With AiDraftsman" tone="info" /> : null}
      </View>

      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12 }} numberOfLines={1}>
        {ticket.customer ? ticket.customer.name : 'Internal'} · {ticket.owner.label}
      </Text>

      <View style={styles.footerRow}>
        <StatusChip label={SLA_LABEL[ticket.sla.state]} tone={SLA_TONE[ticket.sla.state]} />
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{ticket.raisedLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subjectRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  inlineIcon: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
});
