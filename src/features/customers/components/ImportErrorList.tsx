/**
 * ImportErrorList — what is wrong with the file, in three widths. Ported
 * from the web app's `sections/CustomerImportDialog/ImportErrorList.tsx`
 * (confirmed against that source).
 *
 * The polling response already carries the first ten problems, which is
 * what most corrections need. Past that there are two more ways to look:
 * `GET /{jobId}/errors`, paginated, for reading in place; and
 * `GET /{jobId}/errors/download`, the full CSV, for opening beside the
 * spreadsheet being fixed — the only one that includes errors past the
 * 1,000-row collection cap.
 */
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { ImportErrorPage, ImportErrorSummary, ImportRowError } from '../customerImport.types';
import { importErrorRowLabel } from '../customerImportRules';

export interface ImportErrorListProps {
  /** From the polling response: the exact totals and the first ten problems. */
  summary: ImportErrorSummary;
  page: ImportErrorPage | null;
  pageNumber: number;
  pageSize: number;
  isLoading: boolean;
  isShowingAll: boolean;
  onShowAll: () => void;
  onPageChange: (page: number) => void;
  isReportLoading: boolean;
  onDownload: () => void;
}

function errorKey(error: ImportRowError, index: number): string {
  return `${String(error.row)}-${error.field}-${error.code}-${String(index)}`;
}

export function ImportErrorList({ summary, page, pageNumber, pageSize, isLoading, isShowingAll, onShowAll, onPageChange, isReportLoading, onDownload }: ImportErrorListProps) {
  const { theme } = useAppTheme();
  const items = isShowingAll ? (page?.items ?? []) : summary.firstErrors;

  /* `meta.total` is what was STORED; `summary.totalErrors` is what
     happened — they differ exactly when the collection cap was hit, and
     the pager walks the stored set, which is all there is to page through. */
  const storedTotal = page?.meta.total ?? summary.firstErrors.length;
  const lastPage = Math.max(1, Math.ceil(storedTotal / pageSize));
  const firstOnPage = (pageNumber - 1) * pageSize + 1;
  const lastOnPage = Math.min(pageNumber * pageSize, storedTotal);

  return (
    <View style={{ gap: 10 }}>
      <View style={[styles.list, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
        {items.length === 0 && isLoading ? (
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, padding: 12 }}>Loading…</Text>
        ) : (
          items.map((error, index) => (
            <View key={errorKey(error, index)} style={[styles.row, { borderColor: theme.colors.border }]}>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11, width: 56 }}>{importErrorRowLabel(error.row)}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: 12 }}>{error.field}</Text>
                <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11.5, lineHeight: 15 }}>{error.message}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.footer}>
        {isShowingAll ? (
          <>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11.5, flex: 1 }}>
              {storedTotal === 0
                ? 'No stored problems'
                : `Showing ${firstOnPage.toLocaleString('en-GB')}–${lastOnPage.toLocaleString('en-GB')} of ${storedTotal.toLocaleString('en-GB')}`}
              {summary.truncated ? ` — ${summary.totalErrors.toLocaleString('en-GB')} problems were found in total, and the rest are in the full report.` : ''}
            </Text>
            <View style={styles.pagerRow}>
              <Button label="Previous" size="sm" variant="ghost" onPress={() => onPageChange(pageNumber - 1)} disabled={isLoading || pageNumber <= 1} />
              <Button label="Next" size="sm" variant="ghost" onPress={() => onPageChange(pageNumber + 1)} disabled={isLoading || pageNumber >= lastPage} />
            </View>
          </>
        ) : (
          <>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11.5, flex: 1 }}>
              {`Showing the first ${String(summary.firstErrors.length)} of ${summary.totalErrors.toLocaleString('en-GB')}`}
            </Text>
            {summary.totalErrors > summary.firstErrors.length ? <Button label="Show all" size="sm" variant="ghost" onPress={onShowAll} /> : null}
          </>
        )}
      </View>

      {/* The only view that includes problems past the collection cap. */}
      <Button
        label={isReportLoading ? 'Preparing…' : 'Download full report'}
        icon="download"
        variant="outline"
        size="sm"
        onPress={() => void onDownload()}
        disabled={isReportLoading}
        style={{ alignSelf: 'flex-start' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 8, padding: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  pagerRow: { flexDirection: 'row', gap: 6 },
});
