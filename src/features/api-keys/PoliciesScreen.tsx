/**
 * PoliciesScreen — the key-policy registry. Ported from web's policies
 * table on `ApiKeys.tsx` (confirmed against that source 2026-09-03):
 * server-side search + scope + training filters, no pagination (same as
 * keys — `GET /key-policies` returns every row). `key_policy.view` gates
 * the whole screen — reachable independently of `key.view` because "a
 * viewer-only role is the one that most needs to see what the limits are".
 */

import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Loader, TextField, useToast } from '@/components/ui';
import { useDebouncedValue } from '@/features/marketplace/useDebouncedValue';
import { KEY_POLICY_PERMISSIONS, USAGE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { ApiKeysStackParamList } from '@/navigation/types';
import { PolicyCard } from './components/PolicyCard';
import { StatusTabs } from './components/StatusTabs';
import { useDeleteKeyPolicyMutation, useGetKeyPoliciesQuery } from './apiKeysApi';
import { ANY_VALUE, NO_CREATE_POLICY_DESCRIPTION, NO_PERMISSION_MESSAGE, POLICY_SCOPE_TABS, POLICY_TRAINING_TABS, SEARCH_DEBOUNCE_MS, buildDeletePolicyWarning, buildLimitsLabel } from './apiKeysRules';
import type { KeyPolicy, KeyScopeType } from './apiKeys.types';

type Nav = NativeStackNavigationProp<ApiKeysStackParamList>;

export function PoliciesScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const canView = usePermission(KEY_POLICY_PERMISSIONS.VIEW);
  const canManage = usePermission(KEY_POLICY_PERMISSIONS.MANAGE);
  const canDelete = usePermission(KEY_POLICY_PERMISSIONS.DELETE);
  const canViewSpend = usePermission(USAGE_PERMISSIONS.VIEW);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [scopeTab, setScopeTab] = useState<string>(ANY_VALUE);
  const [trainingTab, setTrainingTab] = useState<string>(ANY_VALUE);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const params: { search?: string; scopeType?: KeyScopeType; allowTraining?: boolean } = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (scopeTab !== ANY_VALUE) params.scopeType = scopeTab as KeyScopeType;
    if (trainingTab !== ANY_VALUE) params.allowTraining = trainingTab === 'true';
    return params;
  }, [debouncedSearch, scopeTab, trainingTab]);

  const { data, isLoading, isFetching, error, refetch } = useGetKeyPoliciesQuery(queryParams, { skip: !canView });
  const [deletePolicy] = useDeleteKeyPolicyMutation();

  const policies = data ?? [];
  const isFiltered = Boolean(debouncedSearch) || scopeTab !== ANY_VALUE || trainingTab !== ANY_VALUE;

  const handleCreate = useCallback(() => {
    if (!canManage) {
      toast.show(NO_PERMISSION_MESSAGE.policy, { tone: 'warning' });
      return;
    }
    navigation.navigate('PolicyForm', {});
  }, [canManage, navigation, toast]);

  const handleEdit = useCallback(
    (policy: KeyPolicy) => {
      if (!canManage) {
        toast.show(NO_PERMISSION_MESSAGE.editPolicy, { tone: 'warning' });
        return;
      }
      navigation.navigate('PolicyForm', { id: policy.id });
    },
    [canManage, navigation, toast],
  );

  const handleDelete = useCallback(
    (policy: KeyPolicy) => {
      if (!canDelete) {
        toast.show(NO_PERMISSION_MESSAGE.deletePolicy, { tone: 'warning' });
        return;
      }
      Alert.alert('Delete policy?', buildDeletePolicyWarning(policy.name, buildLimitsLabel(policy)), [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(policy.id);
            try {
              await deletePolicy(policy.id).unwrap();
              toast.show(`${policy.name} deleted.`, { tone: 'neutral' });
            } catch (err) {
              toast.show(getErrorMessage(err as never, 'Could not delete that policy.'), { tone: 'error' });
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]);
    },
    [canDelete, deletePolicy, toast],
  );

  if (!canView) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Key policies" mode="stack" onBack={() => navigation.goBack()} />
        <View style={{ padding: 16 }}>
          <EmptyState icon="lock" title="You cannot view key policies" description={'Each key is issued against a policy carrying its spend cap, rate limits and IP rules. Reading them needs the "View key policies" permission.'} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Key policies" mode="stack" onBack={() => navigation.goBack()} />

      <FlatList
        data={policies}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
              Shared rules keys are issued against — a spend cap, rate limits and IP rules a tenant with a hundred keys changes in one place.
            </Text>

            {canManage ? <Button label="New policy" icon="add" onPress={handleCreate} fullWidth /> : null}

            <TextField placeholder="Policy name, e.g. Production" leftIcon="search" value={search} onChangeText={setSearch} autoCapitalize="none" />
            <StatusTabs tabs={POLICY_SCOPE_TABS} value={scopeTab} onChange={setScopeTab} />
            <StatusTabs tabs={POLICY_TRAINING_TABS} value={trainingTab} onChange={setTrainingTab} />

            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
              {!isLoading && !error ? `${policies.length} polic${policies.length === 1 ? 'y' : 'ies'}` : 'Key policies'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <PolicyCard
            policy={item}
            canViewSpend={canViewSpend}
            canManage={canManage}
            canDelete={canDelete}
            isDeleting={deletingId === item.id}
            onView={() => navigation.navigate('PolicyView', { id: item.id })}
            onEdit={() => handleEdit(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loader />
          ) : error ? (
            <ErrorState title="Could not load policies" message={getErrorMessage(error as never, 'Something went wrong.')} onRetry={refetch} />
          ) : isFiltered ? (
            <EmptyState icon="search-off" title="No policies match these filters" description="Nothing here matches what you searched for. Clear the filters to see every policy again." />
          ) : (
            <EmptyState
              icon="rule"
              title="No policies yet"
              description={canManage ? 'Create a policy to set the spend cap, rate limits and IP rules keys are issued against.' : NO_CREATE_POLICY_DESCRIPTION}
              actionLabel={canManage ? 'New policy' : undefined}
              onAction={canManage ? handleCreate : undefined}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  headerBlock: { gap: 12, marginBottom: 12 },
});
