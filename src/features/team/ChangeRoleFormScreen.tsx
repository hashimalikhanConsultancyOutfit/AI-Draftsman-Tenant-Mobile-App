/**
 * Change role — ported from web's `buildRoleFields` / role-change dialog
 * (`Team.data.ts` / `useTeam.tsx`, confirmed against that source
 * 2026-09-04). Name/email are read-only display, seeded from the row that
 * opened this screen (no extra `GET /team/:id` — the registry's own row
 * already has everything this form needs). Role is a picker over every
 * assignable role, defaulted to the member's current one.
 *
 * Owner is defense-in-depth blocked here too, even though `MemberCard`
 * never renders the "Change role" button for an Owner row in the first
 * place — mirrors web's own belt-and-braces re-check in its modal-open
 * handler.
 */

import { yupResolver } from '@hookform/resolvers/yup';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, EmptyState, PickerField, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { TeamStackParamList } from '@/navigation/types';
import { useGetTeamRolesQuery, useUpdateTeamMemberRoleMutation } from './teamApi';
import { CHANGE_ROLE_MODAL_COPY, OWNER_ROLE_LOCKED_MESSAGE, ROLE_CHANGE_NOTE, isOwnerRole, toAssignableRoles, toRoleLabel } from './teamRules';
import { changeRoleFormSchema, type ChangeRoleFormValues } from './schemas/changeRoleFormSchema';

type Nav = NativeStackNavigationProp<TeamStackParamList>;
type Rt = RouteProp<TeamStackParamList, 'ChangeRole'>;

export function ChangeRoleFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const { data: roles } = useGetTeamRolesQuery();
  const roleOptions = useMemo(() => toAssignableRoles(roles ?? []).map((r) => ({ label: toRoleLabel(r.name), value: r.name })), [roles]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangeRoleFormValues>({
    resolver: yupResolver(changeRoleFormSchema) as never,
    defaultValues: { roleName: params.roleName },
  });

  const [updateTeamMemberRole, { isLoading: isSubmitting }] = useUpdateTeamMemberRoleMutation();
  const who = params.name || params.email;

  const onSubmit = async (values: ChangeRoleFormValues) => {
    if (values.roleName === params.roleName) {
      navigation.goBack();
      return;
    }
    try {
      await updateTeamMemberRole({ id: params.id, roleName: values.roleName }).unwrap();
      toast.show(`${who} is now ${toRoleLabel(values.roleName)}.`, { tone: 'success' });
      toast.show(ROLE_CHANGE_NOTE, { tone: 'neutral' });
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as never, "Could not change that member's role."), { tone: 'error' });
    }
  };

  if (isOwnerRole(params.roleName)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={CHANGE_ROLE_MODAL_COPY.title} mode="stack" onBack={() => navigation.goBack()} />
        <View style={{ padding: 16 }}>
          <EmptyState icon="lock" title="An Owner's role can't be changed here" description={OWNER_ROLE_LOCKED_MESSAGE} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={CHANGE_ROLE_MODAL_COPY.title} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{CHANGE_ROLE_MODAL_COPY.description}</Text>

        <Card style={styles.section}>
          <TextField label="Member" value={`${who} · ${params.email}`} editable={false} />
          <Controller control={control} name="roleName" render={({ field: { value, onChange } }) => <PickerField label="Role" value={value} options={roleOptions} onChange={onChange} error={errors.roleName?.message} />} />
        </Card>

        <Button label={CHANGE_ROLE_MODAL_COPY.submitLabel} onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { gap: 14 },
});
