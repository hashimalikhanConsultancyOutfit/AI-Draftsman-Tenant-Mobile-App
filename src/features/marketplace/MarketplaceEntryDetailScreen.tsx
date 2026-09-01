import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { skipToken } from '@reduxjs/toolkit/query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, EmptyState, ErrorState, Loader } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { MarketplaceStackParamList } from '@/navigation/types';
import { ConnectorLogo } from './components/ConnectorLogo';
import { CLONE_COPY, ENTRY_DETAIL_COPY, formatDate, installTotal } from './marketplaceRules';
import { useGetMarketplaceAgentQuery, useGetSkillQuery } from './marketplaceApi';
import { useMarketplaceClone } from './useMarketplaceClone';

type Nav = NativeStackNavigationProp<MarketplaceStackParamList>;
type Rt = RouteProp<MarketplaceStackParamList, 'MarketplaceEntryDetail'>;

/**
 * A single published skill or agent — the same detail the card has no room
 * for, chiefly the full system prompt. Ported from web's `EntryDetailModal`
 * as a push screen; one component serves both resources, parameterised by
 * `route.params.resource`, exactly as the web dialog is by `kind`.
 */
export function MarketplaceEntryDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { resource, id } = route.params;
  const copy = ENTRY_DETAIL_COPY[resource];
  const cloneCopy = CLONE_COPY[resource];

  const skillQuery = useGetSkillQuery(resource === 'skill' ? id : skipToken);
  const agentQuery = useGetMarketplaceAgentQuery(resource === 'agent' ? id : skipToken);
  const { data, isLoading, error, refetch } = resource === 'skill' ? skillQuery : agentQuery;

  const { canClone, cloneEntry, pending, cloned, installedIds } = useMarketplaceClone(resource);
  const saved = cloned[id];
  const isPending = Boolean(pending[id]);
  const done = Boolean(saved) || Boolean(installedIds[id]);

  const notFound = Boolean(error) && error && 'status' in error && error.status === 404;
  const installs = data ? installTotal(data) : null;
  const promptMeta = data?.prompt ? `${data.prompt.split('\n').length} lines · ${data.prompt.length.toLocaleString()} characters` : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={data?.name ?? copy.eyebrow} mode="stack" onBack={() => navigation.goBack()} />

      {isLoading ? (
        <Loader />
      ) : notFound ? (
        <ErrorState title={copy.notFoundTitle} message={copy.notFoundDescription} />
      ) : error || !data ? (
        <ErrorState title={copy.errorTitle} message={copy.errorDescription} onRetry={refetch} />
      ) : (
        <>
          <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 100 }]}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11, letterSpacing: 0.5 }}>
              {copy.eyebrow.toUpperCase()}
            </Text>

            <View style={styles.header}>
              <ConnectorLogo name={data.name} logo={null} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg }}>{data.name}</Text>
                {data.category && (
                  <View style={[styles.chip, { backgroundColor: theme.colors.statusInfoBg, alignSelf: 'flex-start', marginTop: 6 }]}>
                    <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>{data.category.name}</Text>
                  </View>
                )}
              </View>
            </View>

            {data.description && (
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20, marginTop: 12 }}>
                {data.description}
              </Text>
            )}

            <Card style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
              <View>
                <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>PUBLISHED</Text>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, marginTop: 2 }}>{formatDate(data.createdAt)}</Text>
              </View>
              <View>
                <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>UPDATED</Text>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, marginTop: 2 }}>{formatDate(data.updatedAt)}</Text>
              </View>
              {installs !== null && (
                <View>
                  <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>{copy.installsLabel.toUpperCase()}</Text>
                  <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, marginTop: 2 }}>{installs.toLocaleString()}</Text>
                </View>
              )}
            </Card>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 8 }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>System prompt</Text>
              {promptMeta && (
                <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{promptMeta}</Text>
              )}
            </View>

            {data.prompt ? (
              <View style={[styles.promptBlock, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: 12, lineHeight: 18 }}>{data.prompt}</Text>
              </View>
            ) : (
              <EmptyState icon="notes" title={copy.noPrompt} />
            )}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
            <Button
              label={done ? cloneCopy.saved : cloneCopy.installLabel}
              icon={done ? 'check' : 'add'}
              disabled={done}
              loading={isPending}
              onPress={() => (done ? undefined : cloneEntry(id, data.name))}
              fullWidth
              variant={done ? 'outline' : 'primary'}
            />
            {!canClone && !done && (
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 6, textAlign: 'center' }}>
                {cloneCopy.noPermission}
              </Text>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  promptBlock: { padding: 14 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
});
