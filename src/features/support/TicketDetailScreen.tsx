/**
 * Ticket detail. Ported from web's `TicketDrawer.tsx` (confirmed against
 * that source 2026-09-04), pushed as a full screen rather than an
 * overlay drawer — this app's established convention for "opens the
 * one thing a list row represents" (Customer detail, Role edit, etc.).
 *
 * Realtime here is polling only, same as web: 20s on the ticket detail
 * and the draft, via RTK Query's `pollingInterval`. "Mark viewed" fires
 * once on mount, fire-and-forget — it is `support.view`-gated server-side
 * and idempotent, so nothing here waits on it or reports its outcome.
 */
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, ErrorState, Icon, Loader, useToast } from '@/components/ui';
import { SUPPORT_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { SupportStackParamList } from '@/navigation/types';
import { CollapsibleSection } from './components/CollapsibleSection';
import { DraftBanner } from './components/DraftBanner';
import { EscalateSheet } from './components/EscalateSheet';
import { MessageBubble } from './components/MessageBubble';
import { StatusChip } from './components/StatusChip';
import {
  useCancelSupportDraftMutation,
  useDeleteSupportTicketMutation,
  useEscalateSupportTicketMutation,
  useGetSupportAttachmentUrlMutation,
  useGetSupportDraftQuery,
  useGetSupportTicketQuery,
  useMarkSupportTicketViewedMutation,
  useRemoveSupportAttachmentMutation,
  useUpdateSupportTicketMutation,
  useUploadSupportAttachmentMutation,
} from './supportApi';
import {
  attachmentFullLabel,
  attachmentTooBigMessage,
  attachmentWrongTypeMessage,
  canBringBack,
  DELETE_CONFIRM_BODY,
  escalationToast,
  formatBytes,
  isDraftVisible,
  LINK_FAILED_MESSAGE,
  PRIORITY_LABEL,
  RETURN_CONFIRM_BODY,
  returnToast,
  SLA_LABEL,
  TICKET_ATTACHMENT_LIMIT,
  TICKET_ATTACHMENT_MAX_BYTES,
  TICKET_ATTACHMENT_MIME_TYPES,
  TICKET_STATE_LABEL,
  TICKET_STATE_TONE,
} from './supportRules';
import type { SupportAttachment } from './support.types';

type Nav = NativeStackNavigationProp<SupportStackParamList>;
type Rt = RouteProp<SupportStackParamList, 'TicketDetail'>;

const DETAIL_POLL_MS = 20_000;

export function TicketDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const canReply = usePermission(SUPPORT_PERMISSIONS.REPLY);
  const canUpdate = usePermission(SUPPORT_PERMISSIONS.UPDATE);
  const canEscalate = usePermission(SUPPORT_PERMISSIONS.ESCALATE);
  const canDelete = usePermission(SUPPORT_PERMISSIONS.DELETE);

  const { data: ticket, isLoading, isFetching, error, refetch } = useGetSupportTicketQuery(params.id, { pollingInterval: DETAIL_POLL_MS });
  const { data: draft } = useGetSupportDraftQuery(params.id, { pollingInterval: DETAIL_POLL_MS, skip: !ticket || Boolean(ticket.deletedAt) });

  const [markViewed] = useMarkSupportTicketViewedMutation();
  const [cancelDraft, { isLoading: isCancellingDraft }] = useCancelSupportDraftMutation();
  const [updateTicket, { isLoading: isReturning }] = useUpdateSupportTicketMutation();
  const [escalateTicket, { isLoading: isEscalating }] = useEscalateSupportTicketMutation();
  const [deleteTicket, { isLoading: isDeleting }] = useDeleteSupportTicketMutation();
  const [uploadAttachment, { isLoading: isUploading }] = useUploadSupportAttachmentMutation();
  const [removeAttachment] = useRemoveSupportAttachmentMutation();
  const [getAttachmentUrl] = useGetSupportAttachmentUrlMutation();

  const [escalateOpen, setEscalateOpen] = useState(false);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);
  const [removingAttachmentId, setRemovingAttachmentId] = useState<string | null>(null);

  const viewedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ticket || viewedRef.current === ticket.id) return;
    viewedRef.current = ticket.id;
    markViewed(ticket.id).catch(() => undefined);
  }, [ticket, markViewed]);

  const handleOpenAttachment = async (attachment: SupportAttachment) => {
    setOpeningAttachmentId(attachment.id);
    try {
      const link = await getAttachmentUrl({ ticketId: params.id, attachmentId: attachment.id }).unwrap();
      await Linking.openURL(link.url);
    } catch {
      toast.show(LINK_FAILED_MESSAGE, { tone: 'error' });
    } finally {
      setOpeningAttachmentId(null);
    }
  };

  const handleAddAttachment = async () => {
    if (!ticket) return;
    if (ticket.attachments.length >= TICKET_ATTACHMENT_LIMIT) {
      toast.show(attachmentFullLabel(TICKET_ATTACHMENT_LIMIT), { tone: 'warning' });
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: TICKET_ATTACHMENT_MIME_TYPES });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if ((asset.size ?? 0) > TICKET_ATTACHMENT_MAX_BYTES) {
      toast.show(attachmentTooBigMessage, { tone: 'warning' });
      return;
    }
    try {
      await uploadAttachment({ ticketId: ticket.id, file: { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream', sizeBytes: asset.size ?? 0 } }).unwrap();
      toast.show(`"${asset.name}" attached.`, { tone: 'success' });
    } catch (err) {
      toast.show(getErrorMessage(err as never, attachmentWrongTypeMessage), { tone: 'error' });
    }
  };

  const handleRemoveAttachment = (attachment: SupportAttachment) => {
    if (!ticket) return;
    Alert.alert('Remove this file?', `"${attachment.fileName}" will no longer be on this ticket.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemovingAttachmentId(attachment.id);
          try {
            await removeAttachment({ ticketId: ticket.id, attachmentId: attachment.id }).unwrap();
            toast.show('File removed from this ticket.', { tone: 'neutral' });
          } catch (err) {
            toast.show(getErrorMessage(err as never, 'Could not remove that file.'), { tone: 'error' });
          } finally {
            setRemovingAttachmentId(null);
          }
        },
      },
    ]);
  };

  const handleConfirmEscalate = async (reason: string) => {
    if (!ticket) return;
    try {
      await escalateTicket({ id: ticket.id, reason: reason || undefined }).unwrap();
      toast.show(escalationToast(ticket.subject, ticket.customer?.name), { tone: 'success' });
      setEscalateOpen(false);
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not escalate that ticket.'), { tone: 'error' });
    }
  };

  const handleBringBack = () => {
    if (!ticket) return;
    Alert.alert('Bring this ticket back?', RETURN_CONFIRM_BODY, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Bring it back',
        onPress: async () => {
          try {
            await updateTicket({ id: ticket.id, state: 'OPEN', expectedUpdatedAt: ticket.updatedAt }).unwrap();
            toast.show(returnToast(ticket.subject), { tone: 'success' });
          } catch (err) {
            toast.show(getErrorMessage(err as never, 'Could not bring that ticket back.'), { tone: 'error' });
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    if (!ticket) return;
    Alert.alert('Delete this ticket?', DELETE_CONFIRM_BODY, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTicket(ticket.id).unwrap();
            toast.show(`Ticket "${ticket.subject}" deleted.`, { tone: 'neutral' });
            navigation.goBack();
          } catch (err) {
            toast.show(getErrorMessage(err as never, 'Could not delete that ticket.'), { tone: 'error' });
          }
        },
      },
    ]);
  };

  const handleCancelDraft = async () => {
    if (!ticket || !draft) return;
    try {
      await cancelDraft({ ticketId: ticket.id, draftId: draft.id }).unwrap();
      toast.show('Stopped. Nothing was sent to the customer.', { tone: 'neutral' });
    } catch {
      toast.show('Could not stop that reply — it is still due to send.', { tone: 'error' });
    }
  };

  if (isLoading && !ticket) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Ticket" mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (!isLoading && (!ticket || error)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Ticket" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState title="Could not load this ticket" message="Nothing has been lost — try again." onRetry={refetch} />
      </View>
    );
  }

  if (!ticket) return null;

  const diagnostics = [ticket.agentId, ticket.runId, ticket.threadId, ticket.errorCode].some(Boolean);
  const canManageAttachments = canUpdate && ticket.can.update && !ticket.deletedAt;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={ticket.reference} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.subjectRow}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg, flex: 1 }}>{ticket.subject}</Text>
          <StatusChip label={TICKET_STATE_LABEL[ticket.state]} tone={TICKET_STATE_TONE[ticket.state]} />
        </View>

        {ticket.deletedAt ? (
          <View style={[styles.banner, { backgroundColor: theme.colors.statusErrorBg, borderRadius: theme.radii.lg }]}>
            <Text style={{ color: theme.colors.statusErrorFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12 }}>Deleted {new Date(ticket.deletedAt).toLocaleString()}.</Text>
            <Text style={{ color: theme.colors.statusErrorFg, fontFamily: theme.fontFamilies.body.regular, fontSize: 12, marginTop: 2 }}>This ticket no longer appears in the inbox. Anything already sent to the customer stays sent.</Text>
          </View>
        ) : null}

        {draft && isDraftVisible(draft, ticket.deletedAt) ? <DraftBanner draft={draft} isBusy={isCancellingDraft} onStop={() => void handleCancelDraft()} /> : null}

        <View style={styles.actionRow}>
          {canReply && ticket.can.reply ? <Button label="Reply" size="sm" icon="reply" onPress={() => navigation.navigate('ReplyTicket', { id: ticket.id })} /> : null}
          {canUpdate && ticket.can.update ? <Button label="Add note" size="sm" variant="outline" icon="note-add" onPress={() => navigation.navigate('NoteTicket', { id: ticket.id })} /> : null}
          {canUpdate && ticket.can.update ? <Button label="Edit" size="sm" variant="outline" icon="edit" onPress={() => navigation.navigate('EditTicket', { id: ticket.id })} /> : null}
          {canEscalate && ticket.can.escalate && ticket.state !== 'WITH_PLATFORM' ? <Button label="Escalate" size="sm" variant="outline" icon="arrow-upward" onPress={() => setEscalateOpen(true)} /> : null}
          {canBringBack(ticket) ? <Button label="Bring back" size="sm" variant="outline" icon="undo" loading={isReturning} onPress={handleBringBack} /> : null}
          {canDelete && ticket.can.delete ? <Button label="Delete" size="sm" variant="danger" icon="delete" loading={isDeleting} onPress={handleDelete} /> : null}
        </View>

        <CollapsibleSection title="Details">
          <DetailRow label="Reference" value={ticket.reference} />
          <DetailRow label="Customer" value={ticket.customer ? ticket.customer.name : 'Internal'} />
          <DetailRow label="Owner" value={ticket.owner.label} />
          <DetailRow label="Priority" value={PRIORITY_LABEL[ticket.priority]} />
          <DetailRow label="Raised" value={ticket.raisedLabel} />
          {ticket.escalation ? <DetailRow label="Escalated" value={ticket.escalation.requestedLabel} /> : null}
          {ticket.escalation?.reason ? <DetailRow label="Escalation reason" value={ticket.escalation.reason} /> : null}
          {diagnostics ? (
            <>
              {ticket.agentId ? <DetailRow label="Agent" value={ticket.agentId} /> : null}
              {ticket.runId ? <DetailRow label="Run" value={ticket.runId} /> : null}
              {ticket.threadId ? <DetailRow label="Thread" value={ticket.threadId} /> : null}
              {ticket.errorCode ? <DetailRow label="Error code" value={ticket.errorCode} /> : null}
            </>
          ) : null}
        </CollapsibleSection>

        <CollapsibleSection title="Service level">
          <DetailRow label="Status" value={SLA_LABEL[ticket.sla.state]} />
          <DetailRow label="First-response due" value={new Date(ticket.sla.effectiveDueAt).toLocaleString()} />
          {ticket.nextResponseDueAt ? <DetailRow label="Next reply due" value={new Date(ticket.nextResponseDueAt).toLocaleString()} /> : null}
        </CollapsibleSection>

        {ticket.escalation?.sent ? (
          <CollapsibleSection title="Sent to the platform team">
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginBottom: 6 }}>
              Exactly what crossed the boundary. Never your customer's name, email or documents unless attached deliberately.
            </Text>
            <Text selectable style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: 11 }}>
              {JSON.stringify(ticket.escalation.sent, null, 2)}
            </Text>
          </CollapsibleSection>
        ) : null}

        <CollapsibleSection title="Attachments" badge={ticket.attachments.length > 0 ? String(ticket.attachments.length) : undefined}>
          {ticket.attachments.length === 0 ? <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>No files on this ticket.</Text> : null}
          {ticket.attachments.map((attachment) => (
            <View key={attachment.id} style={[styles.attachmentRow, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
              <TouchableOpacity onPress={() => void handleOpenAttachment(attachment)} style={styles.attachmentInfo} disabled={openingAttachmentId === attachment.id}>
                <Icon name="attach-file" size={14} color={theme.colors.textMuted} />
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: 12, flex: 1 }} numberOfLines={1}>
                  {attachment.fileName}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{attachment.sizeLabel || formatBytes(attachment.sizeBytes)}</Text>
              </TouchableOpacity>
              {canManageAttachments ? (
                <TouchableOpacity onPress={() => handleRemoveAttachment(attachment)} hitSlop={8} disabled={removingAttachmentId === attachment.id}>
                  <Icon name="close" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          {canManageAttachments ? <Button label="Add attachment" size="sm" variant="outline" icon="attach-file" loading={isUploading} onPress={() => void handleAddAttachment()} style={{ alignSelf: 'flex-start', marginTop: 4 }} /> : null}
        </CollapsibleSection>

        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm, marginTop: 4 }}>
          Thread {isFetching ? '· updating…' : ''}
        </Text>
        {ticket.messages.map((message) => (
          <MessageBubble key={message.id} message={message} onOpenAttachment={handleOpenAttachment} />
        ))}
      </ScrollView>

      <EscalateSheet visible={escalateOpen} isSubmitting={isEscalating} onConfirm={handleConfirmEscalate} onClose={() => setEscalateOpen(false)} />
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12, flex: 1 }}>{label}</Text>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: 12, flexShrink: 1, textAlign: 'right' }} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  subjectRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  banner: { padding: 12 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 8 },
  attachmentInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
});
