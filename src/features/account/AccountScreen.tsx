/**
 * Account — the signed-in user's own profile, sign-in details and
 * account security. Ported from web's `AccountPanel` (confirmed against
 * that source and `GET /auth/my-settings/account` 2026-09-04).
 *
 * Everything here is real data from that one read — nothing is derived
 * from the session slice, which only carries what the sign-in response
 * happened to include (see `account.types.ts`'s module doc).
 *
 * ── UNGATED, ON PURPOSE ────────────────────────────────────────────────────
 * Unlike every other Settings sub-screen, this one carries no permission
 * check. Every field here is the signed-in person's own — web's own
 * `MySettings.data.ts` states outright that "every other tab here is the
 * person's own account and is not gated" — so there is no `usePermission`
 * call and no `ACCOUNT_PERMISSIONS` constant; a member can always read
 * and edit their own profile.
 *
 * ── ROWS WITH NO ACTION ────────────────────────────────────────────────────
 * Email, two-factor, verification, status and last sign-in are read-only
 * facts the flows that prove them own — a settings screen that could
 * write `emailVerifiedAt` would be a screen that could assert an address
 * nobody confirmed. Two-factor enrolment in particular belongs to the
 * sign-in flow (`TotpEnrolmentScreen`), not to a setting.
 */

import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Icon, Loader, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useLogoutMutation } from '@/store/authApi';
import { useAppTheme, type AppTheme } from '@/theme/ThemeContext';

import type { SettingsStackParamList } from '@/navigation/types';
import { useGetAccountQuery, useRemoveAvatarMutation, useUploadAvatarMutation } from './accountApi';
import {
  ACCEPTED_AVATAR_MIME,
  accountInitials,
  AVATAR_REMOVE_ERROR,
  AVATAR_REMOVED_MESSAGE,
  AVATAR_TOO_LARGE_MESSAGE,
  AVATAR_UNAVAILABLE_CAPTION,
  AVATAR_UPDATED_MESSAGE,
  AVATAR_UPLOAD_ERROR,
  AVATAR_WRONG_TYPE_MESSAGE,
  formatAccountDay,
  formatAccountMoment,
  MAX_AVATAR_BYTES,
  NOT_SET_LABEL,
  PAGE_DESCRIPTION,
} from './accountRules';

type Nav = NativeStackNavigationProp<SettingsStackParamList>;

export function AccountScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const { data: account, isLoading, isError, error, refetch } = useGetAccountQuery();
  const [uploadAvatar, { isLoading: isUploading }] = useUploadAvatarMutation();
  const [removeAvatar, { isLoading: isRemoving }] = useRemoveAvatarMutation();
  const [logout, { isLoading: isSigningOut }] = useLogoutMutation();
  const isAvatarBusy = isUploading || isRemoving;

  const [pickedUri, setPickedUri] = useState<string | null>(null);

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    if (!asset) return;
    const mimeType = asset.mimeType ?? 'image/jpeg';
    if (!ACCEPTED_AVATAR_MIME.includes(mimeType)) {
      toast.show(AVATAR_WRONG_TYPE_MESSAGE, { tone: 'warning' });
      return;
    }
    if (asset.fileSize && asset.fileSize > MAX_AVATAR_BYTES) {
      toast.show(AVATAR_TOO_LARGE_MESSAGE, { tone: 'warning' });
      return;
    }

    const form = new FormData();
    form.append('file', { uri: asset.uri, name: asset.fileName ?? `avatar-${Date.now()}.jpg`, type: mimeType } as unknown as Blob);
    setPickedUri(asset.uri);
    try {
      await uploadAvatar(form).unwrap();
      toast.show(AVATAR_UPDATED_MESSAGE, { tone: 'success' });
    } catch (err) {
      setPickedUri(null);
      toast.show(getErrorMessage(err as never, AVATAR_UPLOAD_ERROR), { tone: 'error' });
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await removeAvatar().unwrap();
      setPickedUri(null);
      toast.show(AVATAR_REMOVED_MESSAGE, { tone: 'success' });
    } catch (err) {
      toast.show(getErrorMessage(err as never, AVATAR_REMOVE_ERROR), { tone: 'error' });
    }
  };

  // No backend endpoint for this yet — confirming just surfaces that,
  // rather than silently doing nothing or pretending to delete anything.
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This will permanently delete your account and all of its data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            toast.show('Account deletion is not available yet. Contact support to delete your account.', { tone: 'warning' });
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Account" mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen label="Loading your account…" />
      </View>
    );
  }

  if (isError || !account) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Account" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message={getErrorMessage(error as never, 'Could not load your account.')} onRetry={refetch} />
      </View>
    );
  }

  const emailVerified = Boolean(account.emailVerifiedAt);
  const twoFactorEnabled = Boolean(account.twoFactorEnrolledAt);
  const displayName = account.username ?? account.fullName ?? account.email;
  const avatarUri = pickedUri ?? account.avatarUrl ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Account" mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{PAGE_DESCRIPTION}</Text>

        {/* --- Identity --------------------------------------------------- */}
        <Card style={styles.section}>
          <View style={styles.avatarRow}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={[styles.avatar, { borderColor: theme.colors.border }]} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.colors.accent }]}>
                <Text style={styles.avatarInitials}>{accountInitials(displayName)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.md }} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }} numberOfLines={1}>
                {account.email}
              </Text>
            </View>
          </View>
          {account.avatarUploadAvailable ? (
            <View style={styles.avatarActions}>
              <Button label={account.hasAvatar || pickedUri ? 'Change avatar' : 'Add avatar'} size="sm" variant="outline" icon="photo-camera" onPress={handlePickAvatar} loading={isAvatarBusy} />
              {account.hasAvatar && <Button label="Remove" size="sm" variant="ghost" onPress={handleRemoveAvatar} disabled={isAvatarBusy} />}
            </View>
          ) : (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{AVATAR_UNAVAILABLE_CAPTION}</Text>
          )}

          <EditableRow theme={theme} label="Full Name" value={account.fullName ?? NOT_SET_LABEL} onPress={() => navigation.navigate('AccountFieldForm', { field: 'fullName' })} />
          <EditableRow theme={theme} label="Username" value={account.username ?? NOT_SET_LABEL} onPress={() => navigation.navigate('AccountFieldForm', { field: 'username' })} />

          <View style={styles.readOnlyRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12 }}>Email</Text>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, marginTop: 2 }}>{account.email}</Text>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 2 }}>
                Your email is how you sign in and cannot be changed here. Contact support to move your account to a different address.
              </Text>
            </View>
            <Chip theme={theme} label={emailVerified ? 'Verified' : 'Unverified'} tone={emailVerified ? 'success' : 'warning'} />
          </View>
        </Card>

        {/* --- Profile ------------------------------------------------------ */}
        <SectionTitle theme={theme} title="Profile" />
        <Card style={styles.section}>
          <EditableRow theme={theme} label="Job title" value={account.jobTitle ?? NOT_SET_LABEL} onPress={() => navigation.navigate('AccountFieldForm', { field: 'jobTitle' })} />
          <ReadOnlyRow theme={theme} label="Workspace role" value={account.role ?? NOT_SET_LABEL} hint="Set by a workspace administrator. This is what decides what you can access." />
          <ReadOnlyRow theme={theme} label="Access level" value={account.level ?? NOT_SET_LABEL} last />
        </Card>

        {/* --- Security ------------------------------------------------------ */}
        <SectionTitle theme={theme} title="Security" />
        <Card style={styles.section}>
          <TouchableOpacity onPress={() => navigation.navigate('ChangePassword')} style={styles.editableRow} accessibilityRole="button" accessibilityLabel="Change password">
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12 }}>Password</Text>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, marginTop: 2 }}>Set by you</Text>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 2 }}>
                Changing it signs you out of this workspace everywhere. You will need your current password to change it.
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <View style={[styles.readOnlyRow, { borderTopWidth: theme.borders.hairline, borderTopColor: theme.colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12 }}>Two-factor authentication</Text>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, marginTop: 2 }}>
                {twoFactorEnabled ? `Enrolled ${formatAccountDay(account.twoFactorEnrolledAt)}` : 'Not enrolled'}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 2 }}>
                Required to sign in to this app. Enrolment is part of the sign-in flow, not a setting.
              </Text>
            </View>
            <Chip theme={theme} label={twoFactorEnabled ? 'On' : 'Off'} tone={twoFactorEnabled ? 'success' : 'error'} />
          </View>

          <ReadOnlyRow theme={theme} label="Account status" value={account.status} hint="Changed by a workspace administrator." />
          <ReadOnlyRow theme={theme} label="Last sign-in" value={formatAccountMoment(account.lastLoginAt, 'This session')} />
          <ReadOnlyRow theme={theme} label="Member since" value={formatAccountDay(account.createdAt)} last />
        </Card>

        {/* --- System ------------------------------------------------------ */}
        <SectionTitle theme={theme} title="System" />
        <Card style={styles.section}>
          <View style={styles.readOnlyRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12 }}>Signed in as</Text>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, marginTop: 2 }}>{displayName}</Text>
            </View>
            <Button label="Sign out" size="sm" variant="outline" icon="logout" onPress={() => logout()} loading={isSigningOut} />
          </View>
        </Card>

        {/* --- Danger zone ---------------------------------------------------
            UI only for now, per request — no delete-account endpoint exists
            yet, so confirming tells the person that rather than calling
            anything or pretending to have deleted the account. */}
        <SectionTitle theme={theme} title="Danger zone" />
        <Card style={[styles.section, { borderWidth: theme.borders.hairline, borderColor: theme.colors.error }]}>
          <View style={{ gap: 4, paddingBottom: 12 }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>Delete account</Text>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12 }}>
              Permanently delete your account and all of its data. This cannot be undone.
            </Text>
          </View>
          <Button label="Delete account" variant="danger" icon="delete" onPress={handleDeleteAccount} />
        </Card>
      </ScrollView>
    </View>
  );
}

function SectionTitle({ theme, title }: { theme: AppTheme; title: string }) {
  return (
    <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 }}>{title}</Text>
  );
}

function EditableRow({ theme, label, value, onPress }: { theme: AppTheme; label: string; value: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.editableRow, { borderTopWidth: theme.borders.hairline, borderTopColor: theme.colors.border }]} accessibilityRole="button" accessibilityLabel={label}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, marginTop: 2 }} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Icon name="chevron-right" size={20} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
}

function ReadOnlyRow({ theme, label, value, hint, last = false }: { theme: AppTheme; label: string; value: string; hint?: string; last?: boolean }) {
  return (
    <View style={[styles.readOnlyRow, { borderTopWidth: theme.borders.hairline, borderTopColor: theme.colors.border }, last && { marginBottom: 0 }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, marginTop: 2 }}>{value}</Text>
        {hint && <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 2 }}>{hint}</Text>}
      </View>
    </View>
  );
}

/** The same small inline pill shape `StatusChip`/`DomainCard` draw
 * locally elsewhere in this app — kept local here too rather than a
 * shared import, since only two rows on this one screen need it. */
function Chip({ theme, label, tone }: { theme: AppTheme; label: string; tone: 'success' | 'warning' | 'error' }) {
  const pair = {
    success: { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg },
    warning: { bg: theme.colors.statusWarningBg, fg: theme.colors.statusWarningFg },
    error: { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg },
  }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: pair.bg, borderRadius: theme.radii.full }]}>
      <Text style={{ color: pair.fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  section: { gap: 0 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontFamily: 'Syne_700Bold', fontSize: 18, color: '#FFFFFF' },
  avatarActions: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  editableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
  readOnlyRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, gap: 8 },
  chip: { paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
});
