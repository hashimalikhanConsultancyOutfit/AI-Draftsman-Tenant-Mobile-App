/**
 * Export the breakdown currently on screen, as a bottom sheet. Unlike
 * Usage & Spend's export (a real but separate backend route returning a
 * file), this CSV is built entirely client-side from data already on
 * screen — web's own `handleExport` does the same, client-side, from the
 * same `byModel`/`byAgent`/`byCustomer` array this screen already holds.
 * So there's no request and no loading state: the sheet opens already
 * showing the CSV, and — same reasoning as Usage & Spend's `ExportSheet`
 * (this app has no `expo-sharing`/`expo-file-system` dependency) — the
 * only way out is "Copy full CSV" via the clipboard.
 */
import { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, useToast } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { buildBreakdownCsv, EXPORT_DESCRIPTION, GROUP_BY_TABS, NOTHING_TO_EXPORT_MESSAGE } from '../analyticsRules';
import type { AnalyticsGroupBy, UsageBreakdownSlice } from '../analytics.types';

interface AnalyticsExportSheetProps {
  visible: boolean;
  onClose: () => void;
  groupBy: AnalyticsGroupBy;
  rows: UsageBreakdownSlice[];
}

const PREVIEW_LINES = 12;

export function AnalyticsExportSheet({ visible, onClose, groupBy, rows }: AnalyticsExportSheetProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const csv = useMemo(() => (rows.length > 0 ? buildBreakdownCsv(rows) : null), [rows]);
  const groupByLabel = GROUP_BY_TABS.find((t) => t.value === groupBy)?.label ?? groupBy;

  const handleCopy = async () => {
    if (!csv) return;
    try {
      await Clipboard.setStringAsync(csv);
      toast.show('Copied — paste it into a spreadsheet.', { tone: 'success' });
    } catch {
      toast.show('Could not copy that. Try again.', { tone: 'warning' });
    }
  };

  const lines = csv ? csv.split('\n') : [];
  const rowCount = Math.max(0, lines.length - 1);
  const preview = lines.slice(0, PREVIEW_LINES).join('\n');
  const truncated = lines.length > PREVIEW_LINES;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheet, { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 16, borderTopLeftRadius: theme.radii.sheetTop, borderTopRightRadius: theme.radii.sheetTop }]}
        >
          <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg, paddingHorizontal: 20, marginBottom: 6 }}>Export {groupByLabel.toLowerCase()} breakdown</Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12, paddingHorizontal: 20, marginBottom: 14, lineHeight: 17 }}>{EXPORT_DESCRIPTION}</Text>

          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            {!csv ? (
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{NOTHING_TO_EXPORT_MESSAGE}</Text>
            ) : (
              <>
                <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                  {rowCount} row{rowCount === 1 ? '' : 's'}
                  {truncated ? ` — showing the first ${PREVIEW_LINES} lines` : ''}
                </Text>
                <ScrollView horizontal style={[styles.previewBox, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
                  <Text selectable style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: 11 }}>
                    {preview}
                  </Text>
                </ScrollView>
                <Button label="Copy full CSV" icon="content-copy" onPress={() => void handleCopy()} fullWidth />
              </>
            )}
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
