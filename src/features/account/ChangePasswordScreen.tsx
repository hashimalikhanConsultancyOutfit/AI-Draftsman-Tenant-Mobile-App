/**
 * Change password. Ported from web's `ChangePasswordDialog`/
 * `useChangePassword.tsx` (confirmed against that source and the
 * gateway's `POST /auth/my-settings/account/password` 2026-09-04): three
 * fields in, two sent, and the session ends.
 *
 * ── WHY IT SIGNS OUT ON SUCCESS ───────────────────────────────────────────
 * The backend moves `tokenValidFrom` forward on a successful change, same
 * as a password reset — every session opened with the old password
 * should stop counting. Verification doesn't enforce that column yet, so
 * this client honours it itself: `useLogoutMutation` clears cookies,
 * flips auth state to signed-out (remounting the app onto the Login
 * screen) and resets the whole query cache, exactly as the drawer's own
 * "Sign out" row does.
 *
 * Unlike other forms in this app, a failure here is shown as a toast
 * rather than staying on the field — matching this codebase's own
 * established convention for every other mutation's catch block (see
 * `BrandFormScreen`, `RaiseTicketFormScreen`, etc.), rather than web's
 * one-off inline-error banner for this particular dialog.
 */

import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useLogoutMutation } from '@/store/authApi';
import { useAppTheme } from '@/theme/ThemeContext';

import type { SettingsStackParamList } from '@/navigation/types';
import { useChangePasswordMutation } from './accountApi';
import { changePasswordSchema, type ChangePasswordFormValues } from './schemas/changePasswordSchema';

type Nav = NativeStackNavigationProp<SettingsStackParamList>;

const SUCCESS_MESSAGE = 'Your password is updated. Sign in again with your new password.';

export function ChangePasswordScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const [changePassword, { isLoading: isSubmitting }] = useChangePasswordMutation();
  const [logout] = useLogoutMutation();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: yupResolver(changePasswordSchema) as never,
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: ChangePasswordFormValues) => {
    try {
      await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }).unwrap();
      toast.show(SUCCESS_MESSAGE, { tone: 'success' });
      setIsSigningOut(true);
      await logout();
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not change your password.'), { tone: 'error' });
    }
  };

  const busy = isSubmitting || isSigningOut;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Change password" mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
          Choose a new password for signing in to this workspace. You will be signed out and asked to sign in again with it.
        </Text>

        <Controller
          control={control}
          name="currentPassword"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label="Current password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              hint="The password you signed in with."
              error={errors.currentPassword?.message}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
        />

        <Controller
          control={control}
          name="newPassword"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label="New password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.newPassword?.message}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
        />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label="Confirm new password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.confirmPassword?.message}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
        />

        <Button label={isSigningOut ? 'Signing out…' : 'Update password'} onPress={handleSubmit(onSubmit)} loading={busy} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
});
