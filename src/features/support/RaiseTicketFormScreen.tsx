/**
 * Raise ticket. Ported from web's raise dialog (`Support.data.ts`'s
 * `buildRaiseFields` + `useSupport.tsx`'s `submitRaise`, confirmed
 * against that source 2026-09-04): customer (required — see
 * `raiseTicketSchema.ts`'s doc comment on why "Internal" was removed),
 * subject, detail, attachments, assign to, priority, and an "Escalate to
 * AiDraftsman" switch that creates and escalates in one request.
 *
 * The customer and member pickers are bounded fetches (limit 100),
 * matching Roles/Team's own "a workspace this size fits in one page"
 * reasoning — a workspace with more than 100 customers will not see the
 * rest in this picker yet; `PickerField`'s built-in search narrows what
 * IS loaded. Worth revisiting if a tenant that size raises it.
 */
import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, Icon, PickerField, Switch, TextField, useToast } from '@/components/ui';
import { useGetCustomersQuery } from '@/features/customers/customersApi';
import { useGetTeamQuery } from '@/features/team/teamApi';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { SupportStackParamList } from '@/navigation/types';
import { useCreateSupportTicketMutation } from './supportApi';
import {
  attachmentFullLabel,
  attachmentTooBigMessage,
  attachmentWrongTypeMessage,
  formatBytes,
  PRIORITY_OPTIONS,
  RAISE_ATTACHMENT_LIMIT,
  raiseSuccessToast,
  TICKET_ATTACHMENT_MAX_BYTES,
  TICKET_ATTACHMENT_MIME_TYPES,
  UNASSIGNED_LABEL,
  UNASSIGNED_VALUE,
} from './supportRules';
import { raiseTicketSchema, type RaiseTicketFormValues } from './schemas/raiseTicketSchema';
import type { PickedFile } from './support.types';

type Nav = NativeStackNavigationProp<SupportStackParamList>;

export function RaiseTicketFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const { data: customerPage } = useGetCustomersQuery({ limit: 100 });
  const { data: team } = useGetTeamQuery();
  const [createTicket, { isLoading: isSubmitting }] = useCreateSupportTicketMutation();

  const [files, setFiles] = useState<PickedFile[]>([]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RaiseTicketFormValues>({
    resolver: yupResolver(raiseTicketSchema),
    defaultValues: { customerId: '', subject: '', body: '', assigneeId: UNASSIGNED_VALUE, priority: 'NORMAL', escalate: false },
  });

  const customerOptions = (customerPage?.items ?? []).map((c) => ({ label: c.name, value: c.id }));
  const memberOptions = [
    { label: UNASSIGNED_LABEL, value: UNASSIGNED_VALUE },
    ...(team ?? []).map((m) => ({ label: m.acceptedAt ? m.name || m.email : `${m.name || m.email} (invited)`, value: m.id })),
  ];

  const handlePickFiles = async () => {
    if (files.length >= RAISE_ATTACHMENT_LIMIT) {
      toast.show(attachmentFullLabel(RAISE_ATTACHMENT_LIMIT), { tone: 'warning' });
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: TICKET_ATTACHMENT_MIME_TYPES });
    if (result.canceled || !result.assets) return;

    const room = RAISE_ATTACHMENT_LIMIT - files.length;
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

  const onSubmit = async (values: RaiseTicketFormValues) => {
    try {
      const created = await createTicket({
        customerId: values.customerId,
        subject: values.subject,
        body: values.body || undefined,
        priority: values.priority as RaiseTicketFormValues['priority'] as never,
        assigneeId: values.assigneeId && values.assigneeId !== UNASSIGNED_VALUE ? values.assigneeId : undefined,
        escalate: values.escalate,
        files,
      }).unwrap();
      toast.show(raiseSuccessToast(created.reference, values.escalate), { tone: 'success' });
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not raise that ticket.'), { tone: 'error' });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Raise ticket" mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <Card style={styles.section}>
          <Controller
            control={control}
            name="customerId"
            render={({ field: { value, onChange } }) => (
              <PickerField label="On behalf of" placeholder="Select customer" value={value} options={customerOptions} onChange={onChange} searchable error={errors.customerId?.message} />
            )}
          />
          <Controller
            control={control}
            name="subject"
            render={({ field: { value, onChange, onBlur } }) => <TextField label="Subject" value={value} onChangeText={onChange} onBlur={onBlur} placeholder="What the ticket is about" error={errors.subject?.message} />}
          />
          <Controller
            control={control}
            name="body"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField label="Detail (optional)" value={value} onChangeText={onChange} onBlur={onBlur} placeholder="What has happened, and anything already tried" multiline numberOfLines={3} style={{ minHeight: 80, paddingTop: 10, textAlignVertical: 'top' }} />
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
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 6 }}>PDF, CSV, Excel or PNG, up to 10 MB each — up to {RAISE_ATTACHMENT_LIMIT} files.</Text>
        </Card>

        <Card style={styles.section}>
          <Controller
            control={control}
            name="assigneeId"
            render={({ field: { value, onChange } }) => <PickerField label="Assign to (optional)" value={value} options={memberOptions} onChange={onChange} />}
          />
          <Controller
            control={control}
            name="priority"
            render={({ field: { value, onChange } }) => (
              <PickerField
                label="Priority"
                value={value}
                options={PRIORITY_OPTIONS}
                onChange={onChange}
                hint="Chooses the SLA target this ticket is measured against, if you have set one per priority."
              />
            )}
          />
        </Card>

        <Card style={styles.section}>
          <View style={styles.switchRow}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, flex: 1 }}>Escalate to AiDraftsman</Text>
            <Controller control={control} name="escalate" render={({ field: { value, onChange } }) => <Switch value={value} onValueChange={onChange} accessibilityLabel="Escalate to AiDraftsman" />} />
          </View>
        </Card>

        <Button label="Raise ticket" onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { gap: 12 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, padding: 10, marginTop: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
