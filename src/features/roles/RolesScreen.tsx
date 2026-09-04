/**
 * RolesScreen — the roles roster. Ported from web's `Roles.tsx` (confirmed
 * against that source 2026-09-04): client-side search only, no pagination
 * (`GET /roles?limit=100` returns effectively the whole catalogue in one
 * call — a workspace rarely holds more than the five seeded plus a
 * handful, same reasoning as Team and API Keys). `role.view` gates the
 * whole screen; Add rides on `role.create`+`permission.view` (the picker
 * needs the catalogue), Edit/Delete on `role.update`/`role.delete` as
 * narrowed per-row by `canEditRoleRow`/`canDeleteRoleRow`.
 */

import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Loader, TextField, useToast } from '@/components/ui';
import { isOwnerRole } from '@/permissions/systemRoles';
import { ROLE_PERMISSIONS } from '@/permissions/slugs';
import { useEveryPermission, usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppSelector } from '@/store/hooks';
import { useAppTheme } from '@/theme/ThemeContext';

import type { RolesPermissionsStackParamList } from '@/navigation/types';
import { RoleCard } from './components/RoleCard';
import { useDeleteRoleMutation, useGetRolesQuery } from './rolesApi';
import { EMPTY_DESCRIPTION, EMPTY_TITLE, LIST_ERROR_TITLE, NO_CREATE_MESSAGE, NO_VIEW_DESCRIPTION, ROLES_DESCRIPTION, SEARCH_EMPTY_DESCRIPTION, SEARCH_EMPTY_TITLE, SEARCH_PLACEHOLDER, buildDeleteWarning, rolesErrorFallback } from './rolesRules';
import type { RoleSummary } from './roles.types';

type Nav = NativeStackNavigationProp<RolesPermissionsStackParamList>;

export function RolesScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const canView = usePermission(ROLE_PERMISSIONS.VIEW);
  const canUpdate = usePermission(ROLE_PERMISSIONS.UPDATE);
  const canDelete = usePermission(ROLE_PERMISSIONS.DELETE);
  const canCreate = useEveryPermission([ROLE_PERMISSIONS.CREATE, ROLE_PERMISSIONS.PERMISSION_VIEW]);
  const viewerIsOwner = isOwnerRole(useAppSelector((state) => state.auth.session?.role?.name ?? ''));

  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useGetRolesQuery({ limit: 100 }, { skip: !canView });
  const [deleteRole] = useDeleteRoleMutation();

  const roles = data?.items ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) => r.name.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q));
  }, [roles, search]);

  const isFiltered = Boolean(search.trim());

  const handleAdd = useCallback(() => {
    if (!canCreate) {
      toast.show(NO_CREATE_MESSAGE, { tone: 'warning' });
      return;
    }
    navigation.navigate('RoleForm', {});
  }, [canCreate, navigation, toast]);

  const handleEdit = useCallback(
    (role: RoleSummary) => {
      navigation.navigate('RoleForm', { id: role.id });
    },
    [navigation],
  );

  const handleDelete = useCallback(
    (role: RoleSummary) => {
      Alert.alert('Delete role?', buildDeleteWarning(role.name, role.memberCount), [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(role.id);
            try {
              await deleteRole(role.id).unwrap();
              toast.show(`${role.name} deleted.`, { tone: 'neutral' });
            } catch (err) {
              const status = (err as { status?: number })?.status;
              toast.show(getErrorMessage(err as never, rolesErrorFallback(status, 'delete that role')), { tone: 'error' });
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]);
    },
    [deleteRole, toast],
  );

  if (!canView) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Roles & permissions" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />
        <View style={{ padding: 16 }}>
          <EmptyState icon="lock" title="You cannot view roles" description={NO_VIEW_DESCRIPTION} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Roles & permissions" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />

      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{ROLES_DESCRIPTION}</Text>

            {canCreate ? <Button label="Add role" icon="add" onPress={handleAdd} fullWidth /> : null}

            <TextField placeholder={SEARCH_PLACEHOLDER} leftIcon="search" value={search} onChangeText={setSearch} autoCapitalize="none" />

            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
              {!isLoading && !error ? `${filtered.length} role${filtered.length === 1 ? '' : 's'}` : 'Roles'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <RoleCard role={item} canUpdate={canUpdate} canDelete={canDelete} viewerIsOwner={viewerIsOwner} isDeleting={deletingId === item.id} onEdit={() => handleEdit(item)} onDelete={() => handleDelete(item)} />
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loader />
          ) : error ? (
            <ErrorState title={LIST_ERROR_TITLE} message={getErrorMessage(error as never, 'Something went wrong.')} onRetry={refetch} />
          ) : isFiltered ? (
            <EmptyState icon="search-off" title={SEARCH_EMPTY_TITLE} description={SEARCH_EMPTY_DESCRIPTION} />
          ) : (
            <EmptyState icon="rolesAndPermissions" title={EMPTY_TITLE} description={EMPTY_DESCRIPTION} actionLabel={canCreate ? 'Add role' : undefined} onAction={canCreate ? handleAdd : undefined} />
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
