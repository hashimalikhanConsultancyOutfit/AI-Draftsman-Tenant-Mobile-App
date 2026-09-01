import { yupResolver } from '@hookform/resolvers/yup';
import type { SerializedError } from '@reduxjs/toolkit';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Icon, Loader, TextField, useToast, type IconName } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import type { ApiQueryError } from '@/store/baseQuery';
import { useAppTheme } from '@/theme/ThemeContext';

import type { KnowledgeBasesStackParamList } from '@/navigation/types';
import { filenameFromLink, formatBytes, uploadContentType, validateUploadFile } from './knowledgeBaseRules';
import {
  useAddKnowledgeBaseDocumentsMutation,
  useCreateKnowledgeBaseUploadIntentMutation,
  useGetKnowledgeBaseQuery,
} from './knowledgeBasesApi';
import { uploadLinksSchema, type UploadLinksFormValues } from './schemas/uploadLinksSchema';

type Nav = NativeStackNavigationProp<KnowledgeBasesStackParamList>;
type Rt = RouteProp<KnowledgeBasesStackParamList, 'KnowledgeBaseUpload'>;

type UploadMode = 'upload' | 'link';

interface PickedFile {
  id: string;
  name: string;
  uri: string;
  size: number;
  mimeType?: string;
}

type FileStatus = 'ready' | 'uploading' | 'done' | 'failed';

function Pill({ label, icon, selected, onPress }: { label: string; icon: IconName; selected: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.modePill,
        {
          borderRadius: theme.radii.lg,
          borderWidth: theme.borders.interactive,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          backgroundColor: selected ? theme.colors.accent + '14' : theme.colors.statusNeutralBg,
        },
      ]}
    >
      <Icon name={icon} size={16} color={selected ? theme.colors.accent : theme.colors.textMuted} />
      <Text style={{ color: selected ? theme.colors.accent : theme.colors.text, fontFamily: selected ? theme.fontFamilies.body.semibold : theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const makeId = (): string => `pick-${String(Date.now())}-${Math.random().toString(36).slice(2)}`;

export function KnowledgeBaseUploadScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const { data: base, isLoading, error } = useGetKnowledgeBaseQuery(params.id);
  const [presignUpload] = useCreateKnowledgeBaseUploadIntentMutation();
  const [addDocuments, { isLoading: isRegistering }] = useAddKnowledgeBaseDocumentsMutation();

  const [mode, setMode] = useState<UploadMode>('upload');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [statuses, setStatuses] = useState<Record<string, { status: FileStatus; error?: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UploadLinksFormValues>({
    resolver: yupResolver(uploadLinksSchema),
    defaultValues: { links: [{ url: '' }] },
  });
  const { fields: linkFields, append: appendLink, remove: removeLink } = useFieldArray({ control, name: 'links' });

  const handlePickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (result.canceled || !result.assets) return;
    const picked: PickedFile[] = result.assets.map((asset) => ({
      id: makeId(),
      name: asset.name,
      uri: asset.uri,
      size: asset.size ?? 0,
      mimeType: asset.mimeType,
    }));
    setFiles((prev) => [...prev, ...picked]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setStatuses((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleUploadFiles = async () => {
    if (files.length === 0 || !base) return;
    setIsSubmitting(true);
    let succeeded = 0;
    let failed = 0;

    for (const file of files) {
      const problem = validateUploadFile(file.name, file.size, file.mimeType);
      if (problem) {
        setStatuses((prev) => ({ ...prev, [file.id]: { status: 'failed', error: problem } }));
        failed += 1;
        continue;
      }

      setStatuses((prev) => ({ ...prev, [file.id]: { status: 'uploading' } }));
      const contentType = uploadContentType(file.name, file.mimeType);

      try {
        const credential = await presignUpload({ filename: file.name, contentType, sizeBytes: file.size }).unwrap();
        const fileResponse = await fetch(file.uri);
        const blob = await fileResponse.blob();
        const uploaded = await fetch(credential.uploadUrl, {
          method: 'PUT',
          headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': contentType, ...credential.requiredHeaders },
          body: blob,
        });
        if (!uploaded.ok) throw new Error(`Storage rejected ${file.name} (HTTP ${String(uploaded.status)}).`);

        await addDocuments({ id: base.id, documents: [{ filename: file.name, blobUrl: credential.blobUrl, source: 'UPLOAD', contentType }] }).unwrap();
        setStatuses((prev) => ({ ...prev, [file.id]: { status: 'done' } }));
        succeeded += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed.';
        setStatuses((prev) => ({ ...prev, [file.id]: { status: 'failed', error: message } }));
        failed += 1;
      }
    }

    setIsSubmitting(false);
    if (succeeded > 0) {
      toast.show(`${String(succeeded)} document${succeeded === 1 ? '' : 's'} uploaded. Re-indexing is queued — the base stays stale until it finishes.${failed > 0 ? ` ${String(failed)} failed.` : ''}`, {
        tone: failed > 0 ? 'warning' : 'success',
      });
      if (failed === 0) navigation.goBack();
    } else if (failed > 0) {
      toast.show('Could not upload any of those files.', { tone: 'error' });
    }
  };

  const onSubmitLinks = async (values: UploadLinksFormValues) => {
    if (!base) return;
    const cleaned = (values.links ?? []).map((l) => l.url.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      toast.show('Add at least one link.', { tone: 'warning' });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDocuments({
        id: base.id,
        documents: cleaned.map((link) => ({ filename: filenameFromLink(link), blobUrl: link, source: 'CRAWL' as const })),
      }).unwrap();
      toast.show(`${cleaned.length} link${cleaned.length === 1 ? '' : 's'} registered. Re-indexing is queued — the base stays stale until it finishes.`, { tone: 'success' });
      reset({ links: [{ url: '' }] });
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as ApiQueryError | SerializedError, 'Could not register those links.'), { tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !base) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Upload documents" mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (!isLoading && (!base || error)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Upload documents" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message="This knowledge base no longer exists." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={`Upload to ${base?.name ?? ''}`} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
          Upload files directly or register public links. Every document receives a short, copyable reference.
        </Text>

        <View style={styles.modeRow}>
          <Pill label="Upload files" icon="cloud-upload" selected={mode === 'upload'} onPress={() => setMode('upload')} />
          <Pill label="Add links" icon="link" selected={mode === 'link'} onPress={() => setMode('link')} />
        </View>

        {mode === 'upload' ? (
          <Card>
            <Button label="Choose files" icon="attach-file" variant="outline" onPress={() => void handlePickFiles()} />
            {files.length > 0 && (
              <View style={{ marginTop: 12, gap: 8 }}>
                {files.map((file) => {
                  const status = statuses[file.id]?.status ?? 'ready';
                  return (
                    <View key={file.id} style={[styles.fileRow, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
                      <Icon name="description" size={16} color={theme.colors.textMuted} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }} numberOfLines={1}>
                          {file.name}
                        </Text>
                        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>
                          {formatBytes(file.size)}
                          {status === 'failed' && statuses[file.id]?.error ? ` · ${statuses[file.id]?.error ?? ''}` : ''}
                        </Text>
                      </View>
                      {status === 'uploading' ? (
                        <ActivityIndicator size="small" color={theme.colors.accent} />
                      ) : status === 'done' ? (
                        <Icon name="check-circle" size={18} color={theme.colors.statusSuccessFg} />
                      ) : status === 'failed' ? (
                        <Icon name="error-outline" size={18} color={theme.colors.statusErrorFg} />
                      ) : (
                        <TouchableOpacity onPress={() => removeFile(file.id)} hitSlop={8}>
                          <Icon name="close" size={16} color={theme.colors.textMuted} />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 10 }}>
              PDF, text, CSV, JSON, images, Word or Excel — up to 15 MB each.
            </Text>
            <Button label="Upload" onPress={() => void handleUploadFiles()} loading={isSubmitting} disabled={files.length === 0} fullWidth style={{ marginTop: 14 }} />
          </Card>
        ) : (
          <Card>
            <View style={[styles.linkNotice, { backgroundColor: theme.colors.statusInfoBg, borderRadius: theme.radii.md }]}>
              <Icon name="info-outline" size={14} color={theme.colors.statusInfoFg} />
              <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.regular, fontSize: 11.5, flex: 1, lineHeight: 16 }}>
                Links must be anonymously reachable over public HTTP or HTTPS. Do not add sign-in pages, localhost addresses, or private network URLs.
              </Text>
            </View>
            {linkFields.map((field, index) => (
              <View key={field.id} style={styles.sourceRow}>
                <View style={{ flex: 1 }}>
                  <Controller
                    control={control}
                    name={`links.${index}.url`}
                    render={({ field: { value, onChange, onBlur } }) => (
                      <TextField
                        label={`Public link ${String(index + 1)}`}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="https://example.com/policy.pdf"
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        error={errors.links?.[index]?.url?.message}
                      />
                    )}
                  />
                </View>
                <TouchableOpacity onPress={() => removeLink(index)} hitSlop={8} style={[styles.removeBtn, { marginTop: 22 }]}>
                  <Icon name="close" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
            <Button label="Add another link" icon="add" variant="outline" size="sm" onPress={() => appendLink({ url: '' })} style={{ alignSelf: 'flex-start' }} />
            <Button label="Register links" onPress={handleSubmit(onSubmitLinks)} loading={isSubmitting || isRegistering} fullWidth style={{ marginTop: 14 }} />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, flex: 1, justifyContent: 'center' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
  linkNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, marginBottom: 12 },
  sourceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  removeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
});
