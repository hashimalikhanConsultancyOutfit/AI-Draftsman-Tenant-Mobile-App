/**
 * Export usage, as a bottom sheet. Mobile's honest replacement for web's
 * export dialog — see `usageExport.ts`'s doc comment on why: web's
 * format/group/range/"include cost" form calls no real endpoint at all
 * (`useUsageSpend.tsx`'s `handleSubmitExport` only shows a toast), while
 * the one real route (`POST /usage/export`) is CSV, fixed grouping, one
 * period, synchronous. Rather than port a form whose fields do nothing,
 * this sheet calls the real thing for the current month and lets the
 * result be copied out — the file itself is not saved or shared, since
 * this app has no `expo-sharing`/`expo-file-system` dependency yet.
 */
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Loader, useToast } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { EXPORT_DESCRIPTION, currentPeriod, formatPeriodLabel } from '../usageSpendRules';
import { exportUsageCsv, UsageExportError } from '../usageExport';

interface ExportSheetProps {
  visible: boolean;
  onClose: () => void;
}

const PREVIEW_LINES = 12;

export function ExportSheet({ visible, onClose }: ExportSheetProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [csv, setCsv] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const period = currentPeriod();

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const text = await exportUsageCsv(period);
      setCsv(text);
    } catch (err) {
      setError(err instanceof UsageExportError ? err.message : 'Could not export usage.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!csv) return;
    try {
      await Clipboard.setStringAsync(csv);
      toast.show('Copied — paste it into a spreadsheet.', { tone: 'success' });
    } catch {
      toast.show('Could not copy that. Try again.', { tone: 'warning' });
    }
  };

  const handleClose = () => {
    setCsv(null);
    setError(null);
    onClose();
  };

  const rowCount = csv ? Math.max(0, csv.trim().split('\n').length - 1) : 0;
  const preview = csv ? csv.split('\n').slice(0, PREVIEW_LINES).join('\n') : '';
  const truncated = csv ? csv.split('\n').length > PREVIEW_LINES : false;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={handleClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheet, { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 16, borderTopLeftRadius: theme.radii.sheetTop, borderTopRightRadius: theme.radii.sheetTop }]}
        >
          <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg, paddingHorizontal: 20, marginBottom: 6 }}>Export usage</Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12, paddingHorizontal: 20, marginBottom: 14, lineHeight: 17 }}>
            {EXPORT_DESCRIPTION} Covers {formatPeriodLabel(period)}.
          </Text>

          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            {!csv && !isLoading ? <Button label="Generate CSV" icon="file-download" onPress={() => void handleGenerate()} fullWidth /> : null}
            {isLoading ? <Loader /> : null}
            {error ? <Text style={{ color: theme.colors.error, fontSize: 12 }}>{error}</Text> : null}

            {csv ? (
              <>
                <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{rowCount} row{rowCount === 1 ? '' : 's'}{truncated ? ` — showing the first ${PREVIEW_LINES} lines` : ''}</Text>
                <ScrollView horizontal style={[styles.previewBox, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
                  <Text selectable style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: 11 }}>
                    {preview}
                  </Text>
                </ScrollView>
                <Button label="Copy full CSV" icon="content-copy" onPress={() => void handleCopy()} fullWidth />
              </>
            ) : null}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { paddingTop: 10, maxHeight: '85%' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 6 },
  previewBox: { borderWidth: StyleSheet.hairlineWidth, padding: 10, maxHeight: 160 },
});
