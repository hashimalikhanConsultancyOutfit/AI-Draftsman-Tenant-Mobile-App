/**
 * ReportsScreen — the scheduled-report registry. Ported from the web app's
 * `Reports.tsx` / `useReports.tsx` (confirmed against that source on
 * 2026-09-03): a growing, server-paginated list (same "Load more" pattern as
 * Lead criteria and Playground), each row a `ReportCard` with Logs / Run now
 * / Edit / Delete gated on `report.run` / `report.manage` / `report.delete`
 * respectively — `report.view` gates the whole screen.
 *
 * ── RUN NOW WATCHES ITS OWN RUN ──────────────────────────────────────────────
 * `POST /reports/:id/run` answers 202 the instant the run row exists; the
 * work — assembly, upload, delivery attempts — carries on behind it. Without
 * a poll the State chip would keep whatever it said before the press, which
 * reads as the press having done nothing. `handleRunNow` holds `runningId`
 * for the run's whole lifetime and re-reads `getReportRuns` every
 * `RUN_POLL_MS` (bypassing the cache — a poll is a read, not a subscription)
 * until the started run reaches a terminal status or the attempts run out,
 * then unconditionally refetches the list so the row's `last run` is current
 * either way. Exactly mirrors web's own `handleRunNow`.
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Loader, useToast } from '@/components/ui';
import { REPORT_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppDispatch } from '@/store/hooks';
import { useAppTheme } from '@/theme/ThemeContext';

import type { ReportsStackParamList } from '@/navigation/types';
import { ReportCard } from './components/ReportCard';
import { reportsApi, useDeleteReportMutation, useGetReportsQuery, useRunReportNowMutation } from './reportsApi';
import { EXPORT_BRANDING_NOTE, NO_PERMISSION_MESSAGE, NO_RUN_MESSAGE, RUN_POLL_MAX_ATTEMPTS, RUN_POLL_MS, buildReportDeleteWarning, isRunTerminal } from './reportsRules';
import type { Report } from './reports.types';

const REPORTS_PAGE_SIZE = 10;

type Nav = NativeStackNavigationProp<ReportsStackParamList>;

export function ReportsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const dispatch = useAppDispatch();

  const canView = usePermission(REPORT_PERMISSIONS.VIEW);
  const canManage = usePermission(REPORT_PERMISSIONS.MANAGE);
  const canRun = usePermission(REPORT_PERMISSIONS.RUN);
  const canDelete = usePermission(REPORT_PERMISSIONS.DELETE);

  const [page, setPage] = useState(1);
  const [loadedReports, setLoadedReports] = useState<Report[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useGetReportsQuery({ page, limit: REPORTS_PAGE_SIZE }, { skip: !canView });
  const [runReportNow] = useRunReportNowMutation();
  const [deleteReport] = useDeleteReportMutation();

  useEffect(() => {
    if (!data) return;
    setLoadedReports((prev) => {
      if (data.page <= 1) return data.items;
      const seen = new Set(prev.map((r) => r.id));
      return [...prev, ...data.items.filter((r) => !seen.has(r.id))];
    });
  }, [data]);

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, data?.totalPages ?? 1);

  const handleRefresh = useCallback(() => {
    setPage(1);
    void refetch();
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    if (isFetching || page >= pageCount) return;
    setPage((p) => p + 1);
  }, [isFetching, page, pageCount]);

  const handleCreate = useCallback(() => {
    if (!canManage) {
      toast.show(NO_PERMISSION_MESSAGE.create, { tone: 'warning' });
      return;
    }
    navigation.navigate('ReportForm', {});
  }, [canManage, navigation, toast]);

  const handleEdit = useCallback(
    (report: Report) => {
      if (!canManage) {
        toast.show(NO_PERMISSION_MESSAGE.edit, { tone: 'warning' });
        return;
      }
      navigation.navigate('ReportForm', { id: report.id });
    },
    [canManage, navigation, toast],
  );

  const handleOpenLogs = useCallback((report: Report) => navigation.navigate('ReportLogs', { id: report.id, name: report.name }), [navigation]);

  const handleDelete = useCallback(
    (report: Report) => {
      if (!canDelete) {
        toast.show(NO_PERMISSION_MESSAGE.delete, { tone: 'warning' });
        return;
      }
      Alert.alert('Delete report?', buildReportDeleteWarning(report.name), [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(report.id);
            try {
              await deleteReport(report.id).unwrap();
              toast.show(`${report.name} deleted.`, { tone: 'neutral' });
              if (loadedReports.length === 1 && page > 1) setPage(page - 1);
            } catch (err) {
              toast.show(getErrorMessage(err as never, 'Could not delete that report.'), { tone: 'error' });
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]);
    },
    [canDelete, deleteReport, loadedReports.length, page, toast],
  );

  const handleRunNow = useCallback(
    async (report: Report) => {
      if (!canRun) {
        toast.show(NO_RUN_MESSAGE, { tone: 'warning' });
        return;
      }
      setRunningId(report.id);
      try {
        const started = await runReportNow(report.id).unwrap();
        toast.show(started.replayed ? 'That run was already started — see Logs.' : 'Started. It will appear under Logs when it finishes.', { tone: 'success' });

        for (let attempt = 0; attempt < RUN_POLL_MAX_ATTEMPTS; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, RUN_POLL_MS));
          const runsPage = await dispatch(
            reportsApi.endpoints.getReportRuns.initiate({ id: report.id, page: 1, limit: 1 }, { subscribe: false, forceRefetch: true }),
          ).unwrap();
          const run = (runsPage.items ?? []).find((candidate) => candidate.id === started.runId);
          if (run && isRunTerminal(run.status)) {
            toast.show(
              run.status === 'FAILED' ? 'That run failed — open Logs for the reason.' : `Run finished (${run.status}). See Logs for what each channel did.`,
              { tone: run.status === 'FAILED' ? 'error' : 'success' },
            );
            break;
          }
        }
        await refetch();
      } catch (err) {
        toast.show(getErrorMessage(err as never, 'Could not run that report.'), { tone: 'error' });
      } finally {
        setRunningId(null);
      }
    },
    [canRun, dispatch, refetch, runReportNow, toast],
  );

  if (!canView) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Reports" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />
        <View style={{ padding: 16 }}>
          <EmptyState icon="lock" title="You cannot view reports" description={'Viewing scheduled reports needs the "View reports" permission. Ask an owner or an admin to grant it.'} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Reports" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />

      <FlatList
        data={loadedReports}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={handleRefresh} tintColor={theme.colors.accent} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
              Scheduled exports of agent activity, delivered on a cadence you set.
            </Text>

            <View style={[styles.banner, { backgroundColor: theme.colors.statusInfoBg, borderRadius: theme.radii.md }]}>
              <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.xs, lineHeight: 17 }}>{EXPORT_BRANDING_NOTE}</Text>
            </View>

            {canManage ? <Button label="New report" icon="add" onPress={handleCreate} fullWidth /> : null}

            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
              {!isLoading && !error ? `${total} report${total === 1 ? '' : 's'}` : 'Reports'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ReportCard
            report={item}
            canRun={canRun}
            canManage={canManage}
            canDelete={canDelete}
            isRunning={runningId === item.id}
            onOpenLogs={() => handleOpenLogs(item)}
            onRunNow={() => handleRunNow(item)}
            onEdit={() => handleEdit(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loader />
          ) : error ? (
            <ErrorState title="Could not load reports" message={getErrorMessage(error as never, 'Something went wrong.')} onRetry={refetch} />
          ) : (
            <EmptyState
              icon="assessment"
              title="No reports yet"
              description={canManage ? 'Schedule a report to get agent activity delivered without anyone having to ask for it.' : NO_PERMISSION_MESSAGE.create}
              actionLabel={canManage ? 'New report' : undefined}
              onAction={canManage ? handleCreate : undefined}
            />
          )
        }
        ListFooterComponent={
          !isLoading && !error && loadedReports.length > 0 && page < pageCount ? (
            <View style={styles.pager}>
              <Button label="Load more" variant="outline" loading={isFetching} onPress={handleLoadMore} fullWidth />
            </View>
          ) : null
        }
      />
      {deletingId ? <Loader /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  headerBlock: { gap: 12, marginBottom: 12 },
  banner: { padding: 12 },
  pager: { marginTop: 10 },
});
