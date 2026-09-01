/**
 * CustomerImportScreen — bulk registration from a CSV. Ported from the
 * web app's `sections/CustomerImportDialog/CustomerImportDialog.tsx`
 * (confirmed against that source), as a stack screen rather than a
 * dialog — see `useCustomerImport.ts`'s doc comment for why that changes
 * nothing about the state machine itself.
 *
 * Eight phases, driven entirely by the server's view of the job:
 *   choose -> uploading -> validating -> review -> importing -> completed
 *                                     \-> invalid          \-> failed
 *
 * Up to and including `review`, NOTHING has been written — the copy says
 * so at every phase where it's true. The Apply button reads `job.canApply`
 * and nothing else; re-deriving that rule here would be a second
 * implementation of an all-or-nothing decision, and the way two such
 * implementations disagree is a partial import.
 */
import * as DocumentPicker from 'expo-document-picker';
import { useRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, Icon, useToast, type IconName } from '@/components/ui';
import { useAppTheme, type AppTheme } from '@/theme/ThemeContext';

import type { CustomersStackParamList } from '@/navigation/types';
import type { ImportJob } from './customerImport.types';
import {
  IMPORT_FILE_HINT,
  IMPORT_INSTRUCTIONS,
  IMPORT_STATUS_LABEL,
  buildDuplicateWarning,
  buildErrorCodeSummary,
  buildFailureMessage,
  buildImportProgressLabel,
  buildInvalidMessage,
  buildPartialImportMessage,
  buildReadyMessage,
  buildValidationProgressLabel,
  formatFileSize,
  formatImportMoment,
  isFileLevelRejection,
} from './customerImportRules';
import { useCustomerImport, type PickedImportFile } from './useCustomerImport';
import { ImportErrorList } from './components/ImportErrorList';

type Nav = NativeStackNavigationProp<CustomersStackParamList>;

type Tone = 'primary' | 'success' | 'danger' | 'warning' | 'info';

function toneColors(theme: AppTheme, tone: Tone): { bg: string; fg: string } {
  switch (tone) {
    case 'success':
      return { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg };
    case 'danger':
      return { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg };
    case 'warning':
      return { bg: theme.colors.statusWarningBg, fg: theme.colors.statusWarningFg };
    case 'info':
    case 'primary':
    default:
      return { bg: theme.colors.statusInfoBg, fg: theme.colors.statusInfoFg };
  }
}

const TONE_ICON: Record<Tone, IconName> = {
  primary: 'info-outline',
  info: 'info-outline',
  success: 'check-circle',
  danger: 'error-outline',
  warning: 'warning-amber',
};

function Banner({ tone, strongText, children }: { tone: Tone; strongText?: string; children: ReactNode }) {
  const { theme } = useAppTheme();
  const colors = toneColors(theme, tone);
  return (
    <View style={[styles.banner, { backgroundColor: colors.bg, borderRadius: theme.radii.md }]}>
      <Icon name={TONE_ICON[tone]} size={16} color={colors.fg} />
      <Text style={{ color: colors.fg, fontFamily: theme.fontFamilies.body.regular, fontSize: 12.5, lineHeight: 18, flex: 1 }}>
        {strongText ? <Text style={{ fontFamily: theme.fontFamilies.body.semibold }}>{`${strongText} `}</Text> : null}
        {children}
      </Text>
    </View>
  );
}

function Progress({ label, percent }: { label: string; percent: number | null }) {
  const { theme } = useAppTheme();
  /* An indeterminate bar (unknown total) still shows *something* moving
     rather than an empty track — 40% reads as "in progress", not "stuck". */
  const fillPct = Math.min(100, Math.max(0, percent ?? 40));
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.progressLabelRow}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: 12.5 }}>{label}</Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12.5 }}>{percent === null ? '' : `${percent}%`}</Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.full }]}>
        <View style={[styles.progressFill, { width: `${fillPct}%`, backgroundColor: theme.colors.accent, borderRadius: theme.radii.full }]} />
      </View>
    </View>
  );
}

function Hint({ children }: { children: ReactNode }) {
  const { theme } = useAppTheme();
  return <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11.5, lineHeight: 16 }}>{children}</Text>;
}

export function CustomerImportScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const scrollRef = useRef<ScrollView>(null);

  const {
    phase,
    file,
    fileError,
    handlePickFile,
    handleStart,
    uploadPercent,
    uploadStepLabel,
    isUploading,
    handleCancelUpload,
    job,
    isJobLoading,
    jobError,
    isApplying,
    handleApply,
    errorPage,
    errorPageNumber,
    errorPageSize,
    isErrorPageLoading,
    isShowingAllErrors,
    handleShowAllErrors,
    handleErrorPageChange,
    isReportLoading,
    handleDownloadReport,
    resumableJobs,
    handleResumeJob,
    handleStartOver,
  } = useCustomerImport();

  const handleBack = () => {
    if (isUploading) {
      toast.show('Cancel the upload first, or wait for it to finish.', { tone: 'warning' });
      return;
    }
    navigation.goBack();
  };

  const handlePick = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain', '*/*'] });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const picked: PickedImportFile = { uri: asset.uri, name: asset.name, size: asset.size ?? 0, mimeType: asset.mimeType };
    handlePickFile(picked);
  };

  const importedRows = (job as ImportJob | null)?.import.importedRows ?? 0;

  const renderChoose = (): ReactNode => (
    <>
      <Banner tone="primary">{IMPORT_INSTRUCTIONS}</Banner>

      <Card>
        <View style={styles.filePickRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: file ? theme.colors.text : theme.colors.textMuted, fontFamily: theme.fontFamilies.body.medium, fontSize: 13 }}>
              {file ? `${file.name} · ${formatFileSize(file.size)}` : 'No file chosen'}
            </Text>
          </View>
          <Button label={file ? 'Change file' : 'Choose file'} icon="upload-file" variant="outline" size="sm" onPress={() => void handlePick()} />
        </View>

        {fileError ? (
          <View style={{ marginTop: 10 }}>
            <Banner tone="danger">{fileError}</Banner>
          </View>
        ) : (
          <View style={{ marginTop: 10 }}>
            <Hint>{IMPORT_FILE_HINT}</Hint>
          </View>
        )}
      </Card>

      {resumableJobs.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Imports in progress</Text>
          <View style={{ gap: 8 }}>
            {resumableJobs.map((recent) => (
              <TouchableOpacity
                key={recent.jobId}
                onPress={() => handleResumeJob(recent.jobId)}
                style={[styles.resumeRow, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: 12.5 }}>{recent.originalFileName}</Text>
                  <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{IMPORT_STATUS_LABEL[recent.status]}</Text>
                </View>
                <Icon name="chevron-right" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <Button label="Upload and check" onPress={() => void handleStart()} disabled={!file || Boolean(fileError)} fullWidth />
    </>
  );

  const renderUploading = (): ReactNode => (
    <>
      <Progress label={uploadStepLabel} percent={uploadPercent} />
      <Hint>The file goes straight from this device to the server, which streams it into storage.</Hint>
      <Button label="Cancel upload" variant="outline" onPress={handleCancelUpload} fullWidth />
    </>
  );

  const renderValidating = (): ReactNode => (
    <>
      <Progress label={buildValidationProgressLabel(job?.validation.processedRows, job?.validation.totalRows ?? null)} percent={job?.validation.percent ?? null} />
      <Banner tone="primary">{`Checking ${job?.originalFileName ?? 'the file'}. Nothing has been written yet — you will see what the import would do, and confirm it, before a single customer is registered.`}</Banner>
      <Hint>This runs on the server. Leaving this screen does not stop it, and the import will be waiting here when you come back.</Hint>
    </>
  );

  const renderReview = (): ReactNode => (
    <>
      <Banner tone="success" strongText="Checked.">{buildReadyMessage(job?.validation.totalRows ?? null)}</Banner>

      {job?.duplicateOf ? <Banner tone="info" strongText="Seen before.">{buildDuplicateWarning(job.duplicateOf.completedAt, job.duplicateOf.importedRows)}</Banner> : null}

      {job ? <Hint>{`Waiting on you until ${formatImportMoment(job.expiresAt)}. After that the checked copy is cleared and the file has to be uploaded again.`}</Hint> : null}

      <View style={{ gap: 10 }}>
        <Button
          label={isApplying ? 'Starting…' : `Import ${(job?.validation.totalRows ?? 0).toLocaleString('en-GB')} customers`}
          onPress={() => void handleApply()}
          disabled={!job?.canApply || isApplying}
          loading={isApplying}
          fullWidth
        />
        <Button label="Choose another file" variant="outline" onPress={handleStartOver} disabled={isApplying} fullWidth />
      </View>
    </>
  );

  const renderInvalid = (): ReactNode => {
    if (!job) return null;

    if (isFileLevelRejection(job.failureCode)) {
      return (
        <>
          <Banner tone="danger" strongText="Nothing was imported.">{`${buildFailureMessage(job.failureCode, job.failureReason)} Correct it and upload the file again.`}</Banner>
          <Button label="Choose another file" onPress={handleStartOver} fullWidth />
        </>
      );
    }

    return (
      <>
        <Banner tone="danger" strongText="Nothing was imported.">{buildInvalidMessage(job.errorSummary.totalErrors, job.validation.totalRows)}</Banner>

        {Object.keys(job.errorSummary.byCode).length > 0 ? <Hint>{buildErrorCodeSummary(job.errorSummary.byCode)}</Hint> : null}

        <ImportErrorList
          summary={job.errorSummary}
          page={errorPage}
          pageNumber={errorPageNumber}
          pageSize={errorPageSize}
          isLoading={isErrorPageLoading}
          isShowingAll={isShowingAllErrors}
          onShowAll={handleShowAllErrors}
          onPageChange={handleErrorPageChange}
          isReportLoading={isReportLoading}
          onDownload={handleDownloadReport}
        />

        <Button label="Choose another file" onPress={handleStartOver} fullWidth />
      </>
    );
  };

  const renderImporting = (): ReactNode => (
    <>
      <Progress label={buildImportProgressLabel(job?.import.importedRows, job?.import.totalRows ?? null)} percent={job?.import.percent ?? null} />
      <Banner tone="primary">Registering customers. This runs on the server — leaving this screen does not stop it or undo it.</Banner>
    </>
  );

  const renderCompleted = (): ReactNode => (
    <>
      <Banner tone="success" strongText="Imported.">{`${importedRows.toLocaleString('en-GB')} customer${importedRows === 1 ? '' : 's'} registered from ${job?.originalFileName ?? 'the file'}. Every run they make from here is attributed to them.`}</Banner>
      <View style={{ gap: 10 }}>
        <Button label="Done" onPress={() => navigation.goBack()} fullWidth />
        <Button label="Import another file" variant="outline" onPress={handleStartOver} fullWidth />
      </View>
    </>
  );

  const renderFailed = (): ReactNode => (
    <>
      <Banner tone="danger" strongText="The import stopped.">{buildFailureMessage(job?.failureCode ?? null, job?.failureReason ?? null)}</Banner>
      {importedRows > 0 ? <Banner tone="info" strongText="Some rows did go in.">{buildPartialImportMessage(importedRows)}</Banner> : null}
      <Button label="Choose another file" onPress={handleStartOver} fullWidth />
    </>
  );

  const renderBody = (): ReactNode => {
    switch (phase) {
      case 'choose':
        return renderChoose();
      case 'uploading':
        return renderUploading();
      case 'validating':
        return renderValidating();
      case 'review':
        return renderReview();
      case 'invalid':
        return renderInvalid();
      case 'importing':
        return renderImporting();
      case 'completed':
        return renderCompleted();
      case 'failed':
      default:
        return renderFailed();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Import customers from CSV" mode="stack" onBack={handleBack} />
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        {jobError ? <Banner tone="danger">{`${jobError} The import itself is unaffected — come back to this screen to pick it up again.`}</Banner> : null}
        {isJobLoading ? <Hint>Loading the import…</Hint> : renderBody()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressTrack: { height: 6, overflow: 'hidden' },
  progressFill: { height: '100%' },
  filePickRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resumeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
});
