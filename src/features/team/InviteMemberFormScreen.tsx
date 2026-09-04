/**
 * Invite member — ported field-for-field from web's `buildInviteFields`
 * (`Team.data.ts`, confirmed against that source and
 * `InviteTeamMemberRequestDto` on 2026-09-04): name (required — web's own
 * field config has no `optional: true`, even though the backend DTO itself
 * marks `name` optional), email (required), role (required, every tenant
 * role except Owner — ownership is transferred, not handed out through an
 * invite form).
 *
 * The pre-submit duplicate-email check (`GET /team/check-email`) is a
 * courtesy exactly as on web: it saves a doomed round trip for the common
 * case, but `POST /team` still re-validates and 409s independently, so
 * nothing here is the actual guarantee.
 *
 * On success, `InviteLinkModal` opens with the accept link before this
 * screen closes — mirrors web's `InviteLinkDialog`, shown on every
 * successful invite, not only a failed-email one.
 */

import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, PickerField, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { TeamStackParamList } from '@/navigation/types';
import { InviteLinkModal, type InviteLinkInfo } from './components/InviteLinkModal';
import { useCheckTeamEmailMutation, useGetTeamRolesQuery, useInviteTeamMemberMutation } from './teamApi';
import { INVITE_MODAL_COPY, buildInviteSuccessNote, toAssignableRoles, toRoleLabel } from './teamRules';
import { inviteMemberFormSchema, type InviteMemberFormValues } from './schemas/inviteMemberFormSchema';

type Nav = NativeStackNavigationProp<TeamStackParamList>;

export function InviteMemberFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const { data: roles } = useGetTeamRolesQuery();
  const assignableRoles = useMemo(() => toAssignableRoles(roles ?? []), [roles]);
  const roleOptions = useMemo(() => assignableRoles.map((r) => ({ label: toRoleLabel(r.name), value: r.name })), [assignableRoles]);
  /** "The least-privileged role present" per web's `defaultRoleLabel` —
   * `member` when the tenant has it (every seeded tenant does), else
   * whatever assignable role sorts last. */
  const defaultRole = useMemo(() => assignableRoles.find((r) => r.name === 'member')?.name ?? assignableRoles[assignableRoles.length - 1]?.name ?? '', [assignableRoles]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteMemberFormValues>({
    resolver: yupResolver(inviteMemberFormSchema) as never,
    defaultValues: { name: '', email: '', roleName: '' },
  });

  const [hydratedRole, setHydratedRole] = useState(false);
  useEffect(() => {
    if (hydratedRole || !defaultRole) return;
    reset({ name: '', email: '', roleName: defaultRole });
    setHydratedRole(true);
  }, [defaultRole, hydratedRole, reset]);

  const [checkTeamEmail] = useCheckTeamEmailMutation();
  const [inviteTeamMember, { isLoading: isSubmitting }] = useInviteTeamMemberMutation();
  const [linkInfo, setLinkInfo] = useState<InviteLinkInfo | null>(null);

  const onSubmit = async (values: InviteMemberFormValues) => {
    const email = values.email.trim();
    try {
      const exists = await checkTeamEmail(email).unwrap();
      if (exists) {
        toast.show(`${email} already has an account in this workspace. Invite a different address, or check the Team list for it.`, { tone: 'warning' });
        return;
      }
    } catch {
      // Courtesy check only — if it fails to answer, fall through to the
      // real submit, which re-validates regardless.
    }

    try {
      const name = values.name?.trim() || undefined;
      const result = await inviteTeamMember({ email, roleName: values.roleName, name }).unwrap();
      const who = name || result.name || result.email;
      toast.show(buildInviteSuccessNote(who, result.role, result.email, result.emailSent), { tone: 'success' });
      setLinkInfo({ email: result.email, acceptUrl: result.acceptUrl, expiresAt: result.expiresAt, emailSent: result.emailSent });
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not invite that person.'), { tone: 'error' });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={INVITE_MODAL_COPY.title} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{INVITE_MODAL_COPY.description}</Text>

        <Card style={styles.section}>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange, onBlur } }) => <TextField label="Full name" value={value} onChangeText={onChange} onBlur={onBlur} placeholder="Jane Doe" error={errors.name?.message} />}
          />
          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField label="Email" value={value} onChangeText={onChange} onBlur={onBlur} autoCapitalize="none" keyboardType="email-address" placeholder="jane@company.com" error={errors.email?.message} />
            )}
          />
          <Controller control={control} name="roleName" render={({ field: { value, onChange } }) => <PickerField label="Role" value={value} options={roleOptions} onChange={onChange} error={errors.roleName?.message} />} />
        </Card>

        <Button label={INVITE_MODAL_COPY.submitLabel} onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth />
      </ScrollView>

      <InviteLinkModal
        info={linkInfo}
        onDismiss={() => {
          setLinkInfo(null);
          navigation.goBack();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { gap: 14 },
});
