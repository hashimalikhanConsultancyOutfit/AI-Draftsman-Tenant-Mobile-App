/**
 * Create + Edit role — one shared screen, ported from web's `useRoleForm`
 * (`RoleFormModal`, confirmed against that source 2026-09-04): name,
 * description, a Full Access switch, and the permission tree below it.
 *
 * Full Access and the permission tree are mutually exclusive on web (the
 * tree disables while Full Access is on) and that carries over here; the
 * cross-field "at least one permission unless Full Access" rule lives in
 * `roleFormSchema`'s own `.test`, read off `this.parent` rather than
 * duplicated in this screen.
 *
 * `selected` (the checked permission slugs) is plain component state rather
 * than something typed through RHF's `Controller` — there's no single input
 * for a 25-module checkbox tree to control. It is pushed into the form's
 * own `permissions` field via `setValue` on every change instead, purely so
 * `roleFormSchema`'s cross-field test can see it at submit time.
 *
 * The permission-picker fetches the catalogue live (`getPermissionCatalogue`
 * -> `GET /permissions`) rather than reading mobile's bundled reference copy
 * in `permissions/catalogue.ts` — see `rolesApi.ts`'s doc comment for why:
 * web deliberately never bundles this list, to avoid offering a checkbox
 * the deployed backend would refuse, or hiding one it allows.
 */

import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Loader, Switch, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { RolesPermissionsStackParamList } from '@/navigation/types';
import { PermissionModuleGroup } from './components/PermissionModuleGroup';
import { hydrateSelection, toPermissionPayload, togglePermission, toggleModule } from './permissionSelection';
import { useCreateRoleMutation, useGetPermissionCatalogueQuery, useGetRoleQuery, useUpdateRoleMutation } from './rolesApi';
import {
  CATALOGUE_BLOCKED_MESSAGE,
  CATALOGUE_EMPTY_MESSAGE,
  CREATE_SUBMIT_LABEL,
  CREATE_TITLE,
  EDIT_SUBMIT_LABEL,
  EDIT_TITLE,
  FULL_ACCESS_LABEL,
  FULL_ACCESS_NOTE,
  OWNER_PERMISSIONS_LOCKED_NOTE,
  PERMISSIONS_SECTION_LABEL,
  ROLE_DESCRIPTION_HINT,
  ROLE_DESCRIPTION_LABEL,
  ROLE_NAME_HINT,
  ROLE_NAME_LABEL,
  SYSTEM_ROLE_EDIT_NOTE,
  SYSTEM_ROLE_NAME_LOCKED_HINT,
  buildDroppedPermissionsNote,
  isOwnerRoleRow,
  roleEditLocks,
  rolesErrorFallback,
} from './rolesRules';
import { roleFormSchema, type RoleFormValues } from './schemas/roleFormSchema';

type Nav = NativeStackNavigationProp<RolesPermissionsStackParamList>;
type Rt = RouteProp<RolesPermissionsStackParamList, 'RoleForm'>;

function SectionHeading({ children }: { children: string }) {
  const { theme } = useAppTheme();
  return <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md, marginBottom: 4 }}>{children}</Text>;
}

function FieldError({ message }: { message?: string }) {
  const { theme } = useAppTheme();
  if (!message) return null;
  return <Text style={{ color: theme.colors.error, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 8 }}>{message}</Text>;
}

export function RoleFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();
  const isEdit = Boolean(params?.id);

  const { data: editingRole, isLoading: isLoadingRole, error: loadError } = useGetRoleQuery(params?.id ?? '', { skip: !isEdit });
  const { data: modules, isLoading: isLoadingCatalogue, error: catalogueError } = useGetPermissionCatalogueQuery();

  const locks = useMemo(() => (editingRole ? roleEditLocks({ isSystem: editingRole.isSystem, isOwner: isOwnerRoleRow(editingRole) }) : { isNameLocked: false, isPermissionsLocked: false }), [editingRole]);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RoleFormValues>({
    resolver: yupResolver(roleFormSchema) as never,
    defaultValues: { name: '', description: '', fullAccess: false, permissions: [] },
  });

  const fullAccess = watch('fullAccess');
  const [selected, setSelected] = useState<string[]>([]);
  const [dropped, setDropped] = useState<string[]>([]);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated) return;
    if (isEdit) {
      if (!editingRole || !modules) return;
      const hydration = hydrateSelection(editingRole, modules);
      reset({ name: editingRole.name, description: editingRole.description ?? '', fullAccess: hydration.fullAccess, permissions: hydration.selected });
      setSelected(hydration.selected);
      setDropped(hydration.dropped);
      setHydrated(true);
    } else {
      if (!modules) return;
      setHydrated(true);
    }
  }, [editingRole, hydrated, isEdit, modules, reset]);

  const [createRole, { isLoading: isCreating }] = useCreateRoleMutation();
  const [updateRole, { isLoading: isUpdating }] = useUpdateRoleMutation();
  const isSubmitting = isCreating || isUpdating;
  const permissionsLocked = fullAccess || locks.isPermissionsLocked;

  const handleTogglePermission = (slug: string, checked: boolean) => {
    if (permissionsLocked) return;
    const next = togglePermission(selected, slug, checked);
    setSelected(next);
    setValue('permissions', next, { shouldValidate: true });
  };

  const handleToggleModule = (slugs: string[], checked: boolean) => {
    if (permissionsLocked) return;
    const next = toggleModule(selected, slugs, checked);
    setSelected(next);
    setValue('permissions', next, { shouldValidate: true });
  };

  const onSubmit = async (values: RoleFormValues) => {
    const name = values.name.trim();
    const description = values.description?.trim() || undefined;
    const permissions = toPermissionPayload(values.fullAccess, selected);
    try {
      if (isEdit && editingRole) {
        await updateRole({ id: editingRole.id, body: { name, description: description ?? null, permissions } }).unwrap();
        toast.show(`${name} saved.`, { tone: 'success' });
      } else {
        await createRole({ name, description, permissions }).unwrap();
        toast.show(`${name} created.`, { tone: 'success' });
      }
      navigation.goBack();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      toast.show(getErrorMessage(err as never, rolesErrorFallback(status, isEdit ? 'save that role' : 'create that role')), { tone: 'error' });
    }
  };

  const title = isEdit ? EDIT_TITLE : CREATE_TITLE;
  const submitLabel = isEdit ? EDIT_SUBMIT_LABEL : CREATE_SUBMIT_LABEL;
  const isLoadingShell = (isEdit && isLoadingRole) || isLoadingCatalogue || !hydrated;

  if (isLoadingShell && !catalogueError && !loadError) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={title} mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (isEdit && (loadError || !editingRole)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={title} mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message="This role no longer exists." />
      </View>
    );
  }

  if (catalogueError || !modules) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={title} mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message={CATALOGUE_BLOCKED_MESSAGE} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={title} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        {isEdit && editingRole?.isSystem ? (
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 18 }}>
            {locks.isPermissionsLocked ? OWNER_PERMISSIONS_LOCKED_NOTE : SYSTEM_ROLE_EDIT_NOTE}
          </Text>
        ) : null}

        <Card style={styles.section}>
          <SectionHeading>Role</SectionHeading>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField label={ROLE_NAME_LABEL} value={value} onChangeText={onChange} onBlur={onBlur} editable={!locks.isNameLocked} hint={locks.isNameLocked ? SYSTEM_ROLE_NAME_LOCKED_HINT : ROLE_NAME_HINT} error={errors.name?.message} />
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField label={ROLE_DESCRIPTION_LABEL} value={value} onChangeText={onChange} onBlur={onBlur} multiline hint={ROLE_DESCRIPTION_HINT} error={errors.description?.message} />
            )}
          />
        </Card>

        <Card style={styles.section}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{FULL_ACCESS_LABEL}</Text>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 2 }}>{FULL_ACCESS_NOTE}</Text>
            </View>
            <Controller
              control={control}
              name="fullAccess"
              render={({ field: { value, onChange } }) => <Switch value={value} onValueChange={onChange} disabled={locks.isPermissionsLocked} accessibilityLabel={FULL_ACCESS_LABEL} />}
            />
          </View>
        </Card>

        {dropped.length > 0 ? (
          <Card style={styles.section}>
            <Text style={{ color: theme.colors.statusWarningFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 18 }}>{buildDroppedPermissionsNote(dropped)}</Text>
          </Card>
        ) : null}

        <Card style={styles.section}>
          <SectionHeading>{PERMISSIONS_SECTION_LABEL}</SectionHeading>
          {modules.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>{CATALOGUE_EMPTY_MESSAGE}</Text>
          ) : (
            modules.map((group) => (
              <PermissionModuleGroup
                key={group.key}
                group={group}
                selected={selected}
                disabled={permissionsLocked}
                onToggleModule={handleToggleModule}
                onTogglePermission={handleTogglePermission}
                defaultExpanded={group.permissions.some((p) => selected.includes(p.slug))}
              />
            ))
          )}
          <FieldError message={(errors.permissions as { message?: string } | undefined)?.message} />
        </Card>

        <Button label={submitLabel} onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { gap: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
