import type { SerializedError } from '@reduxjs/toolkit';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Icon, Loader, useToast, type IconName } from '@/components/ui';
import { KNOWLEDGE_BASE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import type { ApiQueryError } from '@/store/baseQuery';
import { useAppTheme } from '@/theme/ThemeContext';

import type { KnowledgeBasesStackParamList } from '@/navigation/types';
import {
  buildDocumentDeleteWarning,
  buildPurgeReceipt,
  buildPurgeWarning,
  buildReachSummary,
  documentStatusCopy,
  DOCUMENT_ICON,
  FRESHNESS_LABEL,
  FRESHNESS_TONE,
  NO_DELETE_MESSAGE,
  NO_REINDEX_MESSAGE,
  NO_UPLOAD_MESSAGE,
  SOURCE_LABEL,
  uploadContentType,
  validateUploadFile,
} from './knowledgeBaseRules';
import {
  useCreateKnowledgeBaseUploadIntentMutation,
  useDeleteKnowledgeBaseDocumentMutation,
  useDeleteKnowledgeBaseMutation,
  useGetKnowledgeBaseDocumentsQuery,
  useGetKnowledgeBaseQuery,
  useReindexKnowledgeBaseMutation,
  useUpdateKnowledgeBaseDocumentMutation,
} from './knowledgeBasesApi';
import type { KnowledgeBaseDocument } from './knowledgeBases.types';

type Nav = NativeStackNavigationProp<KnowledgeBasesStackParamList>;
type Rt = RouteProp<KnowledgeBasesStackParamList, 'KnowledgeBaseDetail'>;

function toneColors(theme: ReturnType<typeof useAppTheme>['theme'], tone: 'success' | 'warning' | 'error' | 'info' | 'neutral') {
  if (tone === 'success') return { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg };
  if (tone === 'warning') return { bg: theme.colors.statusWarningBg, fg: theme.colors.statusWarningFg };
  if (tone === 'error') return { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg };
  if (tone === 'info') return { bg: theme.colors.statusInfoBg, fg: theme.colors.statusInfoFg };
  return { bg: theme.colors.statusNeutralBg, fg: theme.colors.statusNeutralFg };
}

function SectionLabel({ icon, children }: { icon: IconName; children: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.sectionLabelRow}>
      <View style={[styles.sectionIconWrap, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
        <Icon name={icon} size={14} color={theme.colors.accent} />
      </View>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{children}</Text>
    </View>
  );
}

function DocumentRow({
  document,
  canDelete,
  canUpload,
  isReplacing,
  isDeleting,
  onReplace,
  onDelete,
}: {
  document: KnowledgeBaseDocument;
  canDelete: boolean;
  canUpload: boolean;
  isReplacing: boolean;
  isDeleting: boolean;
  onReplace: () => void;
  onDelete: () => void;
}) {
  const { theme } = useAppTheme();
  const toast = useToast();
  const status = documentStatusCopy(document.indexStatus);
  const tone = toneColors(theme, status.tone);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(document.hash);
    toast.show(`Reference ${document.hash.slice(0, 12)}… copied.`, { tone: 'success' });
  };

  return (
    <View style={[styles.docRow, { borderColor: theme.colors.border }]}>
      <View style={[styles.docIconWrap, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
        <Icon name={DOCUMENT_ICON[document.source]} size={16} color={theme.colors.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }} numberOfLines={1}>
          {document.filename}
        </Text>
        <View style={styles.docMetaRow}>
          <View style={[styles.miniChip, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.full }]}>
            <Text style={[styles.miniChipText, { color: theme.colors.statusNeutralFg }]}>{SOURCE_LABEL[document.source]}</Text>
          </View>
          <View style={[styles.miniChip, { backgroundColor: tone.bg, borderRadius: theme.radii.full }]}>
            <Text style={[styles.miniChipText, { color: tone.fg }]}>{status.label}</Text>
          </View>
        </View>
        <Pressable onPress={() => void handleCopy()} hitSlop={6} style={styles.refRow}>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.mono.regular, fontSize: 11 }}>{document.hash.slice(0, 12)}…</Text>
          <Icon name="content-copy" size={11} color={theme.colors.textMuted} />
        </Pressable>
      </View>
      <View style={styles.docActions}>
        {canUpload && (
          <TouchableOpacity onPress={onReplace} disabled={isReplacing} hitSlop={8} style={styles.docActionBtn}>
            {isReplacing ? <ActivityIndicator size="small" color={theme.colors.accent} /> : <Icon name="swap-horiz" size={17} color={theme.colors.textMuted} />}
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => void Linking.openURL(document.blobUrl)} hitSlop={8} style={styles.docActionBtn}>
          <Icon name="open-in-new" size={17} color={theme.colors.textMuted} />
        </TouchableOpacity>
        {canDelete && (
          <TouchableOpacity onPress={onDelete} disabled={isDeleting} hitSlop={8} style={styles.docActionBtn}>
            <Icon name="delete-outline" size={17} color={theme.colors.statusErrorFg} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export function KnowledgeBaseDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const canManage = usePermission(KNOWLEDGE_BASE_PERMISSIONS.MANAGE);
  const canUpload = usePermission(KNOWLEDGE_BASE_PERMISSIONS.UPLOAD);
  const canReindex = usePermission(KNOWLEDGE_BASE_PERMISSIONS.REINDEX);
  const canDelete = usePermission(KNOWLEDGE_BASE_PERMISSIONS.DELETE);

  const { data: base, isLoading, error, refetch } = useGetKnowledgeBaseQuery(params.id);
  const [documentPage, setDocumentPage] = useState(1);
  const { data: documentPageResult, isLoading: isLoadingDocuments } = useGetKnowledgeBaseDocumentsQuery({ id: params.id, page: documentPage, limit: 10 });

  const [reindexKnowledgeBase, { isLoading: isReindexing }] = useReindexKnowledgeBaseMutation();
  const [deleteKnowledgeBase, { isLoading: isDeleting }] = useDeleteKnowledgeBaseMutation();
  const [deleteDocument, { isLoading: isDeletingDocument }] = useDeleteKnowledgeBaseDocumentMutation();
  const [presignUpload] = useCreateKnowledgeBaseUploadIntentMutation();
  const [replaceDocument] = useUpdateKnowledgeBaseDocumentMutation();
  const [replacingDocumentId, setReplacingDocumentId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Knowledge base" mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (error || !base) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Knowledge base" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message={error ? 'Could not load this knowledge base.' : 'This knowledge base no longer exists.'} onRetry={error ? refetch : undefined} />
      </View>
    );
  }

  const freshTone = toneColors(theme, FRESHNESS_TONE[base.fresh]);
  const documents = documentPageResult?.items ?? [];
  const documentTotal = documentPageResult?.total ?? 0;
  const documentTotalPages = Math.max(1, documentPageResult?.totalPages ?? 1);

  const handleReindex = async () => {
    if (!canReindex) {
      toast.show(NO_REINDEX_MESSAGE, { tone: 'warning' });
      return;
    }
    try {
      const result = await reindexKnowledgeBase(base.id).unwrap();
      toast.show(
        result.fresh === 'empty' ? `${result.name} has no documents to index — it stays empty.` : `${result.name} re-indexed — ${result.docs} documents are current again.`,
        { tone: result.fresh === 'empty' ? 'neutral' : 'success' },
      );
    } catch (err) {
      toast.show(getErrorMessage(err as ApiQueryError | SerializedError, 'Could not reindex that knowledge base.'), { tone: 'error' });
    }
  };

  const handleDelete = () => {
    if (!canDelete) {
      toast.show(NO_DELETE_MESSAGE, { tone: 'warning' });
      return;
    }
    Alert.alert('Delete knowledge base?', buildPurgeWarning(base.name, base.docs), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Purge all four surfaces',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteKnowledgeBase(base.id).unwrap();
            toast.show(buildPurgeReceipt(base.name, base.docs), { tone: 'success' });
            navigation.goBack();
          } catch (err) {
            toast.show(getErrorMessage(err as ApiQueryError | SerializedError, 'Could not delete that knowledge base.'), { tone: 'error' });
          }
        },
      },
    ]);
  };

  const handleDeleteDocument = (document: KnowledgeBaseDocument) => {
    if (!canDelete) {
      toast.show(NO_DELETE_MESSAGE, { tone: 'warning' });
      return;
    }
    Alert.alert('Delete document?', buildDocumentDeleteWarning(document), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const result = await deleteDocument({ id: base.id, documentId: document.id }).unwrap();
            toast.show(result.blobDeleted ? `${document.filename} and its stored blob were deleted.` : `${document.filename} was removed from the knowledge base.`, { tone: 'success' });
            if (documents.length === 1 && documentPage > 1) setDocumentPage(documentPage - 1);
          } catch (err) {
            toast.show(getErrorMessage(err as ApiQueryError | SerializedError, 'Could not delete that document.'), { tone: 'error' });
          }
        },
      },
    ]);
  };

  const handleReplaceDocument = async (document: KnowledgeBaseDocument) => {
    if (!canUpload) {
      toast.show(NO_UPLOAD_MESSAGE, { tone: 'warning' });
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const file = result.assets[0];

    const problem = validateUploadFile(file.name, file.size ?? 0, file.mimeType);
    if (problem) {
      toast.show(`${file.name}: ${problem}`, { tone: 'warning' });
      return;
    }

    setReplacingDocumentId(document.id);
    try {
      const contentType = uploadContentType(file.name, file.mimeType);
      const credential = await presignUpload({ filename: file.name, contentType, sizeBytes: file.size ?? 0 }).unwrap();
      const fileResponse = await fetch(file.uri);
      const blob = await fileResponse.blob();
      const uploaded = await fetch(credential.uploadUrl, {
        method: 'PUT',
        headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': contentType, ...credential.requiredHeaders },
        body: blob,
      });
      if (!uploaded.ok) throw new Error(`Storage rejected ${file.name} (HTTP ${String(uploaded.status)}).`);

      await replaceDocument({ id: base.id, documentId: document.id, filename: file.name, blobUrl: credential.blobUrl, contentType, contentReplaced: true }).unwrap();
      toast.show(`${file.name} replaced ${document.filename}. Re-indexing is queued — the base stays stale until it finishes.`, { tone: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : getErrorMessage(err as ApiQueryError | SerializedError, `Could not replace ${document.filename}.`);
      toast.show(message, { tone: 'error' });
    } finally {
      setReplacingDocumentId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={base.name} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <Card>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.bold, fontSize: theme.fontSizes.xl }}>{base.name}</Text>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: 2 }}>
                {base.scope === 'Internal' ? 'Internal · workspace-wide' : `${base.scope} · ${base.scopeId || 'unassigned'}`}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: freshTone.bg, borderRadius: theme.radii.full }]}>
              <Text style={[styles.badgeText, { color: freshTone.fg }]}>{FRESHNESS_LABEL[base.fresh]}</Text>
            </View>
          </View>

          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17, marginTop: 12 }}>
            {buildReachSummary(base.scope, base.scopeId)}
          </Text>

          <View style={styles.actions}>
            {canManage && <Button label="Edit" icon="edit" variant="outline" size="sm" onPress={() => navigation.navigate('KnowledgeBaseEdit', { id: base.id })} />}
            {canUpload && <Button label="Add documents" icon="cloud-upload" variant="outline" size="sm" onPress={() => navigation.navigate('KnowledgeBaseUpload', { id: base.id })} />}
            {canReindex && <Button label="Reindex" icon="autorenew" variant="outline" size="sm" loading={isReindexing} onPress={() => void handleReindex()} />}
            {canDelete && <Button label="Delete" icon="delete-outline" variant="outline" size="sm" loading={isDeleting} onPress={handleDelete} />}
          </View>
        </Card>

        <Card>
          <SectionLabel icon="link">{`Source URLs (${String(base.sourceUrls.length)})`}</SectionLabel>
          {base.sourceUrls.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginLeft: 36 }}>
              No sources yet — add documents to give this base something to index.
            </Text>
          ) : (
            <View style={{ marginLeft: 36, gap: 6 }}>
              {base.sourceUrls.map((source) => (
                <Text key={source.id} style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }} numberOfLines={1}>
                  {source.url}
                </Text>
              ))}
            </View>
          )}
        </Card>

        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>{`DOCUMENTS (${String(documentTotal)})`}</Text>
        {isLoadingDocuments ? (
          <Loader />
        ) : documents.length === 0 ? (
          <Card>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, textAlign: 'center' }}>
              No documents yet. Use Add documents to upload files or register public links.
            </Text>
          </Card>
        ) : (
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {documents.map((document, index) => (
              <View key={document.id} style={index < documents.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border } : undefined}>
                <DocumentRow
                  document={document}
                  canDelete={canDelete}
                  canUpload={canUpload}
                  isReplacing={replacingDocumentId === document.id}
                  isDeleting={isDeletingDocument}
                  onReplace={() => void handleReplaceDocument(document)}
                  onDelete={() => handleDeleteDocument(document)}
                />
              </View>
            ))}
          </Card>
        )}

        {documentTotalPages > 1 && (
          <View style={styles.pager}>
            <TouchableOpacity disabled={documentPage <= 1} onPress={() => setDocumentPage((p) => p - 1)} style={[styles.pagerBtn, { opacity: documentPage <= 1 ? 0.4 : 1 }]}>
              <Icon name="chevron-left" size={20} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
              Page {documentPage} of {documentTotalPages}
            </Text>
            <TouchableOpacity disabled={documentPage >= documentTotalPages} onPress={() => setDocumentPage((p) => p + 1)} style={[styles.pagerBtn, { opacity: documentPage >= documentTotalPages ? 0.4 : 1 }]}>
              <Icon name="chevron-right" size={20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 11 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  sectionTitle: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 12, letterSpacing: 0.6, marginLeft: 2 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectionIconWrap: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  docRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 10 },
  docIconWrap: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  docMetaRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  miniChip: { paddingHorizontal: 8, paddingVertical: 2 },
  miniChipText: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 10 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  docActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  docActionBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 4 },
  pagerBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
