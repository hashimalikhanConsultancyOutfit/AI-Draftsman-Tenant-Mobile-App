/**
 * Reply to the customer. Ported from web's reply composer
 * (`Support.data.ts`'s `buildReplyFields` + `useSupport.tsx`'s
 * `submitReply`, confirmed against that source 2026-09-04): body and
 * files, either being enough — a reply may be a document alone. No
 * state control here at all: an OPEN ticket is answered server-side,
 * and any other state is left exactly as it was, so an answer never
 * silently takes back a ticket the platform team are holding (see
 * `ReplyToSupportTicketRequest`'s doc comment on `setState`).
 */
import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Icon, Loader, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { SupportStackParamList } from '@/navigation/types';
import { useGetSupportTicketQuery, useReplyToSupportTicketMutation } from './supportApi';
import { replySchema, type ReplyFormValues } from './schemas/replySchema';
import {
  attachedClause,
  attachmentFullLabel,
  attachmentTooBigMessage,
  attachmentWrongTypeMessage,
  formatBytes,
  REPLY_ATTACHMENT_LIMIT,
  replyToast,
  TICKET_ATTACHMENT_MAX_BYTES,
  TICKET_ATTACHMENT_MIME_TYPES,
  TICKET_STATE_LABEL,
} from './supportRules';
import type { PickedFile } from './support.types';

type Nav = NativeStackNavigationProp<SupportStackParamList>;
type Rt = RouteProp<SupportStackParamList, 'ReplyTicket'>;

export function ReplyFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const { data: ticket, isLoading, error } = useGetSupportTicketQuery(params.id);
  const [replyToTicket, { isLoading: isReplying }] = useReplyToSupportTicketMutation();

  const [files, setFiles] = useState<PickedFile[]>([]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ReplyFormValues>({ resolver: yupResolver(replySchema), defaultValues: { body: '' } });

  const handlePickFiles = async () => {
    if (files.length >= REPLY_ATTACHMENT_LIMIT) {
      toast.show(attachmentFullLabel(REPLY_ATTACHMENT_LIMIT), { tone: 'warning' });
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: TICKET_ATTACHMENT_MIME_TYPES });
    if (result.canceled || !result.assets) return;

    const room = REPLY_ATTACHMENT_LIMIT - files.length;
    const picked: PickedFile[] = [];
    for (const asset of result.assets.slice(0, room)) {
      if ((asset.size ?? 0) > TICKET_ATTACHMENT_MAX_BYTES) {
        toast.show(attachmentTooBigMessage, { tone: 'warning' });
        continue;
      }
      picked.push({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream', sizeBytes: asset.size ?? 0 });
    }
    if (picked.length === 0 && result.assets.length > 0) toast.show(attachmentWrongTypeMessage, { tone: 'warning' });
    setFiles((prev) => [...prev, ...picked]);
  };

  const removeFile = (name: string) => setFiles((prev) => prev.filter((f) => f.name !== name));

  const onSubmit = async (values: ReplyFormValues) => {
    const body = values.body.trim();
    if (!body && files.length === 0) {
      toast.show('A reply needs a message or a file.', { tone: 'warning' });
      return;
    }
    try {
      const replied = await replyToTicket({ id: params.id, body: body || undefined, files: files.length > 0 ? files : undefined }).unwrap();
      toast.show(`${replyToast(replied.email.dispatched, TICKET_STATE_LABEL[replied.ticketState])}${attachedClause(replied.attachments.length, replied.email.dispatched)}`, { tone: 'success' });
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not save that reply.'), { tone: 'error' });
    }
  };

  if (isLoading && !ticket) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Reply to the customer" mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (!isLoading && (!ticket || error)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Reply to the customer" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message="This ticket no longer exists." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Reply to the customer" mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <Card style={styles.section}>
          <Controller
            control={control}
            name="body"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField label="Message" value={value} onChangeText={onChange} onBlur={onBlur} placeholder="What you are telling the customer" multiline numberOfLines={5} style={{ minHeight: 110, paddingTop: 10, textAlignVertical: 'top' }} error={errors.body?.message} />
            )}
          />
        </Card>

        <Card style={styles.section}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>Attachments (optional)</Text>
          {files.map((file) => (
            <View key={file.name} style={[styles.fileRow, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
              <Icon name="description" size={16} color={theme.colors.textMuted} />
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, flex: 1 }} numberOfLines={1}>
                {file.name}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{formatBytes(file.sizeBytes)}</Text>
              <TouchableOpacity onPress={() => removeFile(file.name)} hitSlop={8}>
                <Icon name="close" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
          <Button label="Choose files" icon="attach-file" variant="outline" size="sm" onPress={() => void handlePickFiles()} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
        </Card>

        <Button label="Send reply" onPress={handleSubmit(onSubmit)} loading={isReplying} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { gap: 12 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, padding: 10, marginTop: 8 },
});
