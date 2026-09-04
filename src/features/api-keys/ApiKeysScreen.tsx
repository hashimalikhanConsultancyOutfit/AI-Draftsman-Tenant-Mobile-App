/**
 * ApiKeysScreen — the key registry. Ported from web's `ApiKeys.tsx` /
 * `useApiKeys.tsx` (confirmed against that source 2026-09-03): server-side
 * search + status filter (no pagination — `GET /keys` returns every row
 * the tenant owns), each row an `ApiKeyCard` with Usage always available,
 * Edit / Rotate / Revoke gated on `key.update` / `key.rotate` /
 * `key.revoke` respectively, `key.view` gating the whole screen.
 *
 * ── THE TICKING CLOCK ────────────────────────────────────────────────────
 * A key's server-reported `status: 'ROTATING'` can go stale while this
 * screen sits open — the one-hour overlap window closes on the server's
 * own clock, not on a fetch. `displayStatus` re-derives the badge (and the
 * rotation banner's count) against `now`, and `now` only ticks once a
 * second while at least one row has an open window — torn down the
 * instant none do, the same perf choice web's rotation drawer makes with
 * its own interval.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Loader, StatusTabs, TextField, useToast } from '@/components/ui';
import { useDebouncedValue } from '@/features/marketplace/useDebouncedValue';
import { KEY_PERMISSIONS, KEY_POLICY_PERMISSIONS, USAGE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { ApiKeysStackParamList } from '@/navigation/types';
import { ApiKeyCard } from './components/ApiKeyCard';
import { SecretRevealModal, type RevealedSecret } from './components/SecretRevealModal';
import { useGetApiKeysQuery, useRevokeApiKeyMutation, useRotateApiKeyMutation } from './apiKeysApi';
import {
  ANY_VALUE,
  KEY_STATUS_ALL,
  KEY_STATUS_TABS,
  NO_CREATE_KEY_DESCRIPTION,
  NO_PERMISSION_MESSAGE,
  SEARCH_DEBOUNCE_MS,
  buildRevokeWarning,
  buildRotateWarning,
  buildRotationTriggerLabel,
  isRotationOpen,
} from './apiKeysRules';
import type { ApiKey } from './apiKeys.types';

type Nav = NativeStackNavigationProp<ApiKeysStackParamList>;

export function ApiKeysScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const canView = usePermission(KEY_PERMISSIONS.VIEW);
  const canCreate = usePermission(KEY_PERMISSIONS.CREATE);
  const canEdit = usePermission(KEY_PERMISSIONS.UPDATE);
  const canRotate = usePermission(KEY_PERMISSIONS.ROTATE);
  const canRevoke = usePermission(KEY_PERMISSIONS.REVOKE);
  const canViewPolicies = usePermission(KEY_POLICY_PERMISSIONS.VIEW);
  const canViewSpend = usePermission(USAGE_PERMISSIONS.VIEW);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [statusTab, setStatusTab] = useState<string>(ANY_VALUE);
  const [now, setNow] = useState(() => Date.now());
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<RevealedSecret | null>(null);

  const queryParams = useMemo(() => {
    const params: { search?: string; status?: ApiKey['status']; includeRevoked?: boolean } = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusTab === KEY_STATUS_ALL) params.includeRevoked = true;
    else if (statusTab !== ANY_VALUE) params.status = statusTab as ApiKey['status'];
    return params;
  }, [debouncedSearch, statusTab]);

  const { data, isLoading, isFetching, error, refetch } = useGetApiKeysQuery(queryParams, { skip: !canView });
  const [rotateApiKey] = useRotateApiKeyMutation();
  const [revokeApiKey] = useRevokeApiKeyMutation();

  const keys = data ?? [];
  const isFiltered = Boolean(debouncedSearch) || statusTab !== ANY_VALUE;

  const hasOpenRotation = useMemo(() => keys.some((k) => k.status === 'ROTATING' && isRotationOpen(k.previousValidUntil, now)), [keys, now]);

  useEffect(() => {
    if (!hasOpenRotation) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasOpenRotation]);

  const rotatingCount = useMemo(() => keys.filter((k) => k.status === 'ROTATING' && isRotationOpen(k.previousValidUntil, now)).length, [keys, now]);

  const handleCreate = useCallback(() => {
    if (!canCreate) {
      toast.show(NO_PERMISSION_MESSAGE.create, { tone: 'warning' });
      return;
    }
    navigation.navigate('ApiKeyForm', {});
  }, [canCreate, navigation, toast]);

  const handleEdit = useCallback(
    (key: ApiKey) => {
      if (!canEdit) {
        toast.show(NO_PERMISSION_MESSAGE.edit, { tone: 'warning' });
        return;
      }
      navigation.navigate('ApiKeyForm', { id: key.id });
    },
    [canEdit, navigation, toast],
  );

  const handleOpenUsage = useCallback((key: ApiKey) => navigation.navigate('KeyUsage', { id: key.id, name: key.name }), [navigation]);

  const handleRotate = useCallback(
    (key: ApiKey) => {
      if (!canRotate) {
        toast.show(NO_PERMISSION_MESSAGE.rotate, { tone: 'warning' });
        return;
      }
      Alert.alert('Rotate key?', buildRotateWarning(key.name), [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rotate',
          onPress: async () => {
            setRotatingId(key.id);
            try {
              const result = await rotateApiKey(key.id).unwrap();
              setRevealedSecret({
                keyName: key.name,
                secret: result.key,
                previousValidUntil: result.previousValidUntil,
                previousPrefix: result.apiKey.previousPrefix,
                newPrefix: result.apiKey.prefix,
              });
            } catch (err) {
              toast.show(getErrorMessage(err as never, 'Could not rotate that key.'), { tone: 'error' });
            } finally {
              setRotatingId(null);
            }
          },
        },
      ]);
    },
    [canRotate, rotateApiKey, toast],
  );

  const handleRevoke = useCallback(
    (key: ApiKey) => {
      if (!canRevoke) {
        toast.show(NO_PERMISSION_MESSAGE.revoke, { tone: 'warning' });
        return;
      }
      Alert.alert('Revoke key?', buildRevokeWarning(key.name, key.prefix), [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setRevokingId(key.id);
            try {
              await revokeApiKey(key.id).unwrap();
              toast.show(`${key.name} revoked.`, { tone: 'neutral' });
            } catch (err) {
              toast.show(getErrorMessage(err as never, 'Could not revoke that key.'), { tone: 'error' });
            } finally {
              setRevokingId(null);
            }
          },
        },
      ]);
    },
    [canRevoke, revokeApiKey, toast],
  );

  if (!canView) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="API keys" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />
        <View style={{ padding: 16 }}>
          <EmptyState icon="lock" title="You cannot view API keys" description={'Viewing API keys needs the "View API keys" permission. Ask an owner or an admin to grant it.'} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="API keys" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />

      <FlatList
        data={keys}
        keyExtractor={(k) => k.id}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
              Programmatic access to the platform, each key issued against a policy.
            </Text>

            {canRotate && rotatingCount > 0 ? (
              <Button label={buildRotationTriggerLabel(rotatingCount)} icon="autorenew" variant="secondary" onPress={() => navigation.navigate('RotatingKeys')} fullWidth />
            ) : null}

            {canCreate ? <Button label="New key" icon="add" onPress={handleCreate} fullWidth /> : null}
            {canViewPolicies ? <Button label="Manage policies" icon="rule" variant="outline" onPress={() => navigation.navigate('Policies')} fullWidth /> : null}

            <TextField placeholder="Name or prefix, e.g. ad_live_9f2a" leftIcon="search" value={search} onChangeText={setSearch} autoCapitalize="none" />
            <StatusTabs tabs={KEY_STATUS_TABS} value={statusTab} onChange={setStatusTab} />

            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
              {!isLoading && !error ? `${keys.length} key${keys.length === 1 ? '' : 's'}` : 'API keys'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ApiKeyCard
            apiKey={item}
            nowMs={now}
            canViewSpend={canViewSpend}
            canEdit={canEdit}
            canRotate={canRotate}
            canRevoke={canRevoke}
            isRotating={rotatingId === item.id}
            isRevoking={revokingId === item.id}
            onOpenUsage={() => handleOpenUsage(item)}
            onEdit={() => handleEdit(item)}
            onRotate={() => handleRotate(item)}
            onRevoke={() => handleRevoke(item)}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loader />
          ) : error ? (
            <ErrorState title="Could not load API keys" message={getErrorMessage(error as never, 'Something went wrong.')} onRetry={refetch} />
          ) : isFiltered ? (
            <EmptyState icon="search-off" title="No keys match these filters" description="Nothing here matches what you searched for. Clear the filters to see every key again." />
          ) : (
            <EmptyState
              icon="key"
              title="No API keys yet"
              description={canCreate ? 'Issue a key to give a service, a portal, or a scheduled job programmatic access.' : NO_CREATE_KEY_DESCRIPTION}
              actionLabel={canCreate ? 'New key' : undefined}
              onAction={canCreate ? handleCreate : undefined}
            />
          )
        }
      />

      <SecretRevealModal secret={revealedSecret} onDismiss={() => setRevealedSecret(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  headerBlock: { gap: 12, marginBottom: 12 },
});
