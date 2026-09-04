/**
 * One message in the thread. Ported from web's `TicketDrawer.tsx`
 * (confirmed against that source 2026-09-04): kind chip, author, body
 * clamped to a few lines with a See more/less toggle, and a footer line
 * that names either the AUDIENCE (an internal note never leaves the
 * workspace) or the DELIVERY (a reply was or was not emailed) — never
 * both, and never inferred from the wrong one of the two, which is
 * exactly the bug web's own long comment on `MESSAGE_FOOTER` documents
 * fixing.
 */
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { SupportAttachment, SupportMessage } from '../support.types';
import { formatBytes, MESSAGE_FOOTER, MESSAGE_KIND_LABEL, MESSAGE_KIND_TONE, messageEmailedLabel } from '../supportRules';
import { StatusChip } from './StatusChip';

const CLAMP_LINES = 6;

interface MessageBubbleProps {
  message: SupportMessage;
  onOpenAttachment: (attachment: SupportAttachment) => void;
}

export function MessageBubble({ message, onOpenAttachment }: MessageBubbleProps) {
  const { theme } = useAppTheme();
  const [expanded, setExpanded] = useState(false);

  const footer =
    message.kind === 'INTERNAL_NOTE'
      ? MESSAGE_FOOTER.internal
      : message.kind === 'TENANT_REPLY'
        ? message.emailDispatchedAt
          ? messageEmailedLabel(message.emailDispatchedAt)
          : MESSAGE_FOOTER.notEmailed
        : new Date(message.createdAt).toLocaleString();

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg, borderWidth: theme.borders.hairline, borderColor: theme.colors.border }]}>
      <View style={styles.headerRow}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm, flexShrink: 1 }} numberOfLines={1}>
          {message.authorLabel}
        </Text>
        <StatusChip label={MESSAGE_KIND_LABEL[message.kind]} tone={MESSAGE_KIND_TONE[message.kind]} />
      </View>

      {message.body ? (
        <>
          <Text
            style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20, marginTop: 6 }}
            numberOfLines={expanded ? undefined : CLAMP_LINES}
          >
            {message.body}
          </Text>
          <TouchableOpacity onPress={() => setExpanded((v) => !v)}>
            <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12, marginTop: 4 }}>{expanded ? 'See less' : 'See more'}</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {message.attachments.length > 0 ? (
        <View style={{ marginTop: 8, gap: 6 }}>
          {message.attachments.map((attachment) => (
            <TouchableOpacity key={attachment.id} onPress={() => onOpenAttachment(attachment)} style={[styles.attachmentRow, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
              <Icon name="attach-file" size={14} color={theme.colors.textMuted} />
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: 12, flex: 1 }} numberOfLines={1}>
                {attachment.fileName}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{formatBytes(attachment.sizeBytes)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 8 }}>{footer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 8 },
});
