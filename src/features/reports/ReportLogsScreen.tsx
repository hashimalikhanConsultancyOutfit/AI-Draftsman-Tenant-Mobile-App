/**
 * ReportLogsScreen — the run history behind a report's "Logs" button.
 * Ported from web's `ReportLogsDialog.tsx` (confirmed against that source on
 * 2026-09-03) as its own pushed screen, same convention as Leads'
 * `LeadReasoningScreen`: there is no room to show a report's card and its
 * full run history on one screen.
 *
 * Reading this screen needs only `report.view` (already checked before
 * `ReportsScreen` ever renders the "Logs" button that opens it); Download
 * is its own separate grant, `report.download`, since it is the one action
 * here that hands a FILE off the platform.
 */

import { useEffect, useState } from 'react';
import { FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, EmptyState, ErrorState, Loader, useToast } from '@/components/ui';
import { REPORT_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { ReportsStackParamList } from '@/navigation/types';
import { useGetReportRunDownloadUrlMutation, useGetReportRunsQuery } from './reportsApi';
import { DELIVERY_LABEL, FILE_EXPIRED_MESSAGE, NO_DOWNLOAD_MESSAGE, STATUS_LABEL, TRIGGER_LABEL, channelsOf, formatDuration, formatRunWhen } from './reportsRules';
import type { ReportRun, ReportRunDeliveryChannel } from './reports.types';

const RUNS_PAGE_SIZE = 20;

type Nav = NativeStackNavigationProp<ReportsStackParamList>;
type Rt = RouteProp<ReportsStackParamList, 'ReportLogs'>;

const STATUS_TONE: Record<ReportRun['status'], 'success' | 'error' | 'warning'> = {
  OK: 'success',
  FAILED: 'error',
  /* Amber, not green — a partial run produced a file, but something about it
   * did not work. Amber also for RUNNING: still going long after it started
   * is worth a second look, without claiming it has already failed. */
  PARTIAL: 'warning',
  RUNNING: 'warning',
};

const deliveryToneColor = (theme: ReturnType<typeof useAppTheme>['theme'], state: ReportRunDeliveryChannel['state']) => {
  if (state === 'DELIVERED') return theme.colors.success;
  if (state === 'FAILED') return theme.colors.error;
  return theme.colors.textMuted;
};

export function ReportLogsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const canDownload = usePermission(REPORT_PERMISSIONS.DOWNLOAD);

  const [page, setPage] = useState(1);
  const [runs, setRuns] = useState<ReportRun[]>([]);
  const [downloadingRunId, setDownloadingRunId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setRuns([]);
  }, [params.id]);

  const { data, isLoading, isFetching, error, refetch } = useGetReportRunsQuery({ id: params.id, page, limit: RUNS_PAGE_SIZE });
  const [getDownloadUrl] = useGetReportRunDownloadUrlMutation();

  useEffect(() => {
    if (!data) return;
    setRuns((prev) => {
      if (data.page <= 1) return data.items;
      const seen = new Set(prev.map((r) => r.id));
      return [...prev, ...data.items.filter((r) => !seen.has(r.id))];
    });
  }, [data]);

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, data?.totalPages ?? 1);

  const handleLoadMore = () => {
    if (isFetching || page >= pageCount) return;
    setPage((p) => p + 1);
  };

  const handleDownload = async (runId: string) => {
    if (!canDownload) {
      toast.show(NO_DOWNLOAD_MESSAGE, { tone: 'warning' });
      return;
    }
    setDownloadingRunId(runId);
    try {
      const { url } = await getDownloadUrl({ reportId: params.id, runId }).unwrap();
      await Linking.openURL(url);
    } catch (err) {
      // A 404 here means the run's artifact is gone — never produced, or its
      // 7-day retention window has passed — not a request-shaped problem, so
      // it gets this specific line instead of the backend's raw message
      // (matching web's `useReports.tsx`, which does the same rewording).
      const status = err && typeof err === 'object' && 'status' in err ? (err as { status: unknown }).status : undefined;
      toast.show(status === 404 ? FILE_EXPIRED_MESSAGE : getErrorMessage(err as never, 'Could not download that file.'), { tone: 'error' });
    } finally {
      setDownloadingRunId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={params.name ? `Run history · ${params.name}` : 'Run history'} mode="stack" onBack={() => navigation.goBack()} />
      <FlatList
        data={runs}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={
          !isLoading && !error ? (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm, marginBottom: 2 }}>{`${total} run${total === 1 ? '' : 's'}`}</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const tone = STATUS_TONE[item.status];
          const toneColors =
            tone === 'success'
              ? { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg }
              : tone === 'error'
                ? { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg }
                : { bg: theme.colors.statusWarningBg, fg: theme.colors.statusWarningFg };
          const canDownloadThis = item.status === 'OK' || item.status === 'PARTIAL';
          const channels = channelsOf(item);

          return (
            <Card style={styles.row}>
              <View style={styles.rowTop}>
                <View style={[styles.chip, { backgroundColor: toneColors.bg, borderRadius: theme.radii.full }]}>
                  <Text style={{ color: toneColors.fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12 }}>{STATUS_LABEL[item.status]}</Text>
                </View>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{formatRunWhen(item.startedAt)}</Text>
              </View>

              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 4 }}>
                {TRIGGER_LABEL[item.trigger]} · {formatDuration(item.durationMs)}
                {item.rowCount !== null ? ` · ${item.rowCount} rows` : ''}
                {item.truncated ? ' · incomplete' : ''}
              </Text>

              {item.periodFrom && item.periodTo ? (
                <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 4 }}>
                  Covering {formatRunWhen(item.periodFrom)} to {formatRunWhen(item.periodTo)}
                </Text>
              ) : null}

              {item.message ? <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: 6 }}>{item.message}</Text> : null}
              {item.error ? <Text style={{ color: theme.colors.error, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: 6 }}>{item.error}</Text> : null}

              {channels.map((channel) => (
                <Text key={channel.channel} style={{ color: deliveryToneColor(theme, channel.state), fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 4 }}>
                  {channel.channel} — {DELIVERY_LABEL[channel.state]}
                  {channel.target ? ` to ${channel.target}` : ''}
                  {channel.attempts > 1 ? ` after ${channel.attempts} attempts` : ''}
                  {channel.waitingOn ? `: ${channel.waitingOn}` : ''}
                </Text>
              ))}

              {canDownloadThis ? (
                <View style={styles.downloadRow}>
                  <Button label="Download" size="sm" variant="outline" icon="download" loading={downloadingRunId === item.id} onPress={() => handleDownload(item.id)} />
                </View>
              ) : null}
            </Card>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          isLoading ? (
            <Loader />
          ) : error ? (
            <ErrorState title="Could not load the run history" message={getErrorMessage(error as never, 'Something went wrong.')} onRetry={refetch} />
          ) : (
            <EmptyState
              icon="history"
              title="No runs yet"
              description="Nothing has run this report — not on its schedule and not by hand. A scheduled report appears here the first time its cadence comes round."
            />
          )
        }
        ListFooterComponent={
          !isLoading && !error && runs.length > 0 && page < pageCount ? (
            <View style={styles.pager}>
              <Button label="Load more" variant="outline" loading={isFetching} onPress={handleLoadMore} fullWidth />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  row: { gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 3 },
  downloadRow: { flexDirection: 'row', marginTop: 10 },
  pager: { marginTop: 10 },
});
