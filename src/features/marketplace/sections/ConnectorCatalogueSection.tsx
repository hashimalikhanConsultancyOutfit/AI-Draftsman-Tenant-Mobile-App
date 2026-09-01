import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { skipToken } from '@reduxjs/toolkit/query';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, EmptyState, ErrorState, Icon, Loader, TextField } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { ConnectedCard } from '../components/ConnectedCard';
import { ConnectorCard } from '../components/ConnectorCard';
import {
  AMR_REQUIRED_MESSAGE,
  AUTH_FILTER_OPTIONS,
  CONNECTOR_ALL_TAKE,
  CONNECTOR_CATEGORIES,
  CONNECTOR_PAGE_SIZE,
  CONNECTOR_SECTION_LIMIT,
  SEARCH_DEBOUNCE_MS,
  STATUS_OPTIONS,
  installsBySlug,
} from '../marketplaceRules';
import { useGetConnectorInstallsQuery, useGetConnectorsQuery } from '../marketplaceApi';
import { useDebouncedValue } from '../useDebouncedValue';
import type { AuthFilter, CatalogueView, Connector, StatusFilter } from '../marketplace.types';

interface ConnectorCatalogueSectionProps {
  onOpenConnector: (slug: string) => void;
}

function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.pill,
        { borderRadius: theme.radii.full, backgroundColor: selected ? theme.colors.accent : theme.colors.statusNeutralBg },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={{ color: selected ? theme.colors.textOnAccent : theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>{label}</Text>
    </TouchableOpacity>
  );
}

function PillScroller<T extends string>({ options, value, onChange }: { options: Array<{ label: string; value: T }>; value: T; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
      {options.map((opt) => (
        <Pill key={opt.value} label={opt.label} selected={opt.value === value} onPress={() => onChange(opt.value)} />
      ))}
    </ScrollView>
  );
}

const CATEGORY_OPTIONS: Array<{ label: string; value: string }> = [{ label: 'All categories', value: '' }, ...CONNECTOR_CATEGORIES.map((c) => ({ label: c, value: c }))];

/**
 * The connector catalogue tab — Discover (grouped by category) / All (flat,
 * load-more) / Connected (this tenant's own installs) sub-views, plus a
 * search+filter toolbar. Ported from web's `ConnectorCatalogue.tsx`. The
 * connect/disconnect actions and the OAuth flow live in
 * ConnectorDetailScreen, reached by tapping a card.
 */
export function ConnectorCatalogueSection({ onOpenConnector }: ConnectorCatalogueSectionProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [view, setView] = useState<CatalogueView>('discover');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [authFilter, setAuthFilter] = useState<AuthFilter>('all');
  const [page, setPage] = useState(1);
  const [allRows, setAllRows] = useState<Connector[]>([]);

  // The three filter rows used to sit permanently in the toolbar — three
  // horizontal pill scrollers stacked under the search field made the
  // screen read as crowded before a single card was visible. They now live
  // behind a filter icon and a bottom sheet with its own Cancel/Apply, so
  // adjusting a filter is a deliberate, committed action rather than
  // something that reflows the list on every tap. Draft state is separate
  // from the applied filters so Cancel (or dismissing the sheet) discards
  // whatever was changed since it opened.
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState(category);
  const [draftStatus, setDraftStatus] = useState<StatusFilter>(status);
  const [draftAuthFilter, setDraftAuthFilter] = useState<AuthFilter>(authFilter);
  const activeFilterCount = (category ? 1 : 0) + (status !== 'all' ? 1 : 0) + (authFilter !== 'all' ? 1 : 0);

  const openFilters = () => {
    setDraftCategory(category);
    setDraftStatus(status);
    setDraftAuthFilter(authFilter);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setCategory(draftCategory);
    setStatus(draftStatus);
    setAuthFilter(draftAuthFilter);
    if (draftCategory) setView('all'); // a category choice is a flat drill-in — see handleCategoryChange
    setFilterOpen(false);
  };

  const grouped = view === 'discover' && !debouncedSearch && category === '';

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, category, status, authFilter, view]);

  const handleCategoryChange = (next: string) => {
    setCategory(next);
    if (next) setView('all'); // a category choice is a flat drill-in
  };

  const discoverQuery = useGetConnectorsQuery(grouped ? { take: CONNECTOR_ALL_TAKE, status: status === 'all' ? undefined : status } : skipToken);
  const flatQuery = useGetConnectorsQuery(
    !grouped && view === 'all'
      ? { skip: (page - 1) * CONNECTOR_PAGE_SIZE, take: CONNECTOR_PAGE_SIZE, status: status === 'all' ? undefined : status, category: category || undefined, search: debouncedSearch || undefined }
      : skipToken,
  );
  const installsResult = useGetConnectorInstallsQuery();
  const { data: installs, isLoading: isInstallsLoading, error: installsError, refetch: refetchInstalls } = installsResult;
  const installsNeedVerification = installsError && 'status' in installsError && installsError.status === 403;

  // Refetch installs whenever this screen regains focus — the mobile
  // equivalent of web's "the SPA reloaded, so the cache is cold on
  // return": here the app never tore down, so a new install made in the
  // system browser (see handleConnect) needs an explicit nudge to show up.
  useFocusEffect(
    useCallback(() => {
      void refetchInstalls();
    }, [refetchInstalls]),
  );

  useEffect(() => {
    const page1Data = flatQuery.data;
    if (!page1Data) return;
    setAllRows((prev) => {
      if ((page1Data.skip ?? 0) <= 0) return page1Data.data;
      const seen = new Set(prev.map((c) => c.id));
      return [...prev, ...page1Data.data.filter((c) => !seen.has(c.id))];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the response object
  }, [flatQuery.data]);

  const bySlug = useMemo(() => installsBySlug(installs ?? []), [installs]);

  const applyAuthFilter = useCallback((rows: Connector[]) => (authFilter === 'all' ? rows : rows.filter((c) => c.authType === authFilter)), [authFilter]);

  const discoverRows = applyAuthFilter(discoverQuery.data?.data ?? []);
  const discoverTotal = discoverQuery.data?.total ?? 0;
  const discoverTruncated = discoverTotal > CONNECTOR_ALL_TAKE;

  const sections = useMemo(() => {
    const byCategory = new Map<string, Connector[]>();
    for (const connector of discoverRows) {
      const key = connector.category[0] ?? 'Uncategorized';
      const list = byCategory.get(key) ?? [];
      list.push(connector);
      byCategory.set(key, list);
    }
    return [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cat, connectors]) => ({ title: cat, total: connectors.length, data: connectors.slice(0, CONNECTOR_SECTION_LIMIT) }));
  }, [discoverRows]);

  const flatRows = applyAuthFilter(allRows);
  const flatTotal = flatQuery.data?.total ?? 0;
  const flatTotalPages = Math.max(1, Math.ceil(flatTotal / CONNECTOR_PAGE_SIZE));

  const connectedAll = Object.values(bySlug);
  const connectedRows = applyAuthFilter(
    connectedAll
      .filter((i) => !debouncedSearch || i.connectorName.toLowerCase().includes(debouncedSearch.toLowerCase()) || i.connectorSlug.toLowerCase().includes(debouncedSearch.toLowerCase()))
      .map((i): Connector => ({ id: i.id, slug: i.connectorSlug, name: i.connectorName, category: [], description: null, logo: i.connectorLogo, status: 'active', authType: null, scope: { read: [], write: [] }, meta: null })),
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.toolbar}>
        <View style={styles.tabRow}>
          {(
            [
              { value: 'discover' as const, label: 'Discover' },
              { value: 'all' as const, label: 'All' },
              { value: 'connected' as const, label: `Connected${connectedAll.length ? ` (${connectedAll.length})` : ''}` },
            ]
          ).map((t) => {
            const active = view === t.value;
            return (
              <TouchableOpacity
                key={t.value}
                onPress={() => setView(t.value)}
                style={[styles.tabChip, { borderRadius: theme.radii.full, backgroundColor: active ? theme.colors.accent : theme.colors.statusNeutralBg }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={{ color: active ? theme.colors.textOnAccent : theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <TextField placeholder={view === 'connected' ? 'Search connections' : 'Search connectors'} leftIcon="search" value={search} onChangeText={setSearch} autoCapitalize="none" />
          </View>
          {view !== 'connected' && (
            <TouchableOpacity
              onPress={openFilters}
              style={[
                styles.filterBtn,
                {
                  borderRadius: theme.radii.md,
                  borderColor: activeFilterCount > 0 ? theme.colors.accent : theme.colors.border,
                  backgroundColor: activeFilterCount > 0 ? theme.colors.accent + '1A' : theme.colors.surface,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Filters"
            >
              <Icon name="tune" size={20} color={activeFilterCount > 0 ? theme.colors.accent : theme.colors.text} />
              {activeFilterCount > 0 && (
                <View style={[styles.filterBadge, { backgroundColor: theme.colors.accent }]}>
                  <Text style={{ color: theme.colors.textOnAccent, fontFamily: theme.fontFamilies.body.bold, fontSize: 10 }}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {view === 'connected' ? (
        installsNeedVerification ? (
          <View style={{ padding: 16 }}>
            <EmptyState icon="lock" title="Connections unavailable" description={AMR_REQUIRED_MESSAGE} />
          </View>
        ) : isInstallsLoading ? (
          <Loader />
        ) : connectedAll.length === 0 ? (
          <View style={{ padding: 16 }}>
            <EmptyState icon="cable" title="Nothing connected yet" description="Connect a service and it will appear here with the account it was authorised as and the access it was granted." actionLabel="Browse connectors" onAction={() => setView('discover')} />
          </View>
        ) : connectedRows.length === 0 ? (
          <View style={{ padding: 16 }}>
            <EmptyState icon="search-off" title="No connections match" description="No connected service matches that name. Clear the search to see all of them." actionLabel="Clear search" onAction={() => setSearch('')} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.container}>
            {connectedRows.map((c) => {
              const install = bySlug[c.slug];
              if (!install) return null;
              return (
                <View key={install.id} style={{ marginBottom: 10 }}>
                  <ConnectedCard install={install} onPress={() => onOpenConnector(c.slug)} />
                </View>
              );
            })}
          </ScrollView>
        )
      ) : grouped ? (
        discoverQuery.isLoading ? (
          <Loader />
        ) : discoverQuery.error ? (
          <ErrorState title="Couldn't load connectors" message="The connectors service didn't respond. Check that the gateway is running, then try again." onRetry={discoverQuery.refetch} />
        ) : sections.length === 0 ? (
          <View style={{ padding: 16 }}>
            <EmptyState icon="search-off" title="No connectors match" description="Try a different status or auth type." />
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.container}
            ListHeaderComponent={
              discoverTruncated ? (
                <Card style={{ backgroundColor: theme.colors.statusInfoBg, borderWidth: 0, marginBottom: 10 }}>
                  <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 18 }}>
                    <Text style={{ fontFamily: theme.fontFamilies.body.semibold }}>Partial view: </Text>
                    these sections cover the first {discoverRows.length} of {discoverTotal} connectors. Use All, or a category filter, to reach the rest.
                  </Text>
                  <View style={{ marginTop: 8 }}>
                    <Button label="Browse all" size="sm" variant="outline" onPress={() => setView('all')} />
                  </View>
                </Card>
              ) : null
            }
            renderSectionHeader={({ section }) => (
              <View style={[styles.sectionHeader, { backgroundColor: theme.colors.background }]}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>
                  {section.title} <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular }}>({section.total})</Text>
                </Text>
                {section.total > section.data.length && (
                  <TouchableOpacity onPress={() => handleCategoryChange(section.title)}>
                    <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>View all ({section.total})</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            renderItem={({ item }) => (
              <View style={{ marginBottom: 10 }}>
                <ConnectorCard connector={item} install={bySlug[item.slug]} onPress={() => onOpenConnector(item.slug)} />
              </View>
            )}
          />
        )
      ) : flatQuery.isLoading ? (
        <Loader />
      ) : flatQuery.error ? (
        <ErrorState title="Couldn't load connectors" message="The connectors service didn't respond. Check that the gateway is running, then try again." onRetry={flatQuery.refetch} />
      ) : flatRows.length === 0 ? (
        <View style={{ padding: 16 }}>
          <EmptyState icon="search-off" title="No connectors match" description="Try a different search term, category, status, or auth type." />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginBottom: 6 }}>
            {flatTotal} connectors match
          </Text>
          {flatRows.map((c) => (
            <View key={c.id} style={{ marginBottom: 10 }}>
              <ConnectorCard connector={c} install={bySlug[c.slug]} onPress={() => onOpenConnector(c.slug)} />
            </View>
          ))}
          {page < flatTotalPages && (
            <View style={{ paddingVertical: 16 }}>
              <Button label="Load more" variant="outline" loading={flatQuery.isFetching} onPress={() => setPage((p) => p + 1)} fullWidth />
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={filterOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setFilterOpen(false)}>
        <TouchableOpacity style={[styles.sheetScrim, { backgroundColor: theme.colors.scrim }]} activeOpacity={1} onPress={() => setFilterOpen(false)}>
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.sheetCard,
              { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 16, borderTopLeftRadius: theme.radii.sheetTop, borderTopRightRadius: theme.radii.sheetTop },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: theme.colors.border }]} />
            <ScrollView contentContainerStyle={styles.sheetBody}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg, marginBottom: 16 }}>Filters</Text>

              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm, marginBottom: 8 }}>Category</Text>
              <PillScroller options={CATEGORY_OPTIONS} value={draftCategory} onChange={setDraftCategory} />

              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm, marginTop: 18, marginBottom: 8 }}>Status</Text>
              <PillScroller options={STATUS_OPTIONS} value={draftStatus} onChange={setDraftStatus} />

              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm, marginTop: 18, marginBottom: 8 }}>Authentication</Text>
              <PillScroller options={AUTH_FILTER_OPTIONS} value={draftAuthFilter} onChange={setDraftAuthFilter} />
            </ScrollView>

            <View style={styles.sheetFooter}>
              <View style={{ flex: 1 }}>
                <Button label="Cancel" variant="outline" onPress={() => setFilterOpen(false)} fullWidth />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Apply" onPress={applyFilters} fullWidth />
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { padding: 16, gap: 10 },
  container: { paddingHorizontal: 16, paddingBottom: 24 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabChip: { paddingHorizontal: 14, paddingVertical: 8 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  filterBtn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  filterBadge: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  pillRow: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  pill: { paddingHorizontal: 13, paddingVertical: 7 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  sheetScrim: { flex: 1, justifyContent: 'flex-end' },
  sheetCard: { maxHeight: '80%', paddingTop: 10 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  sheetBody: { paddingHorizontal: 20, paddingBottom: 4 },
  sheetFooter: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 16 },
});
