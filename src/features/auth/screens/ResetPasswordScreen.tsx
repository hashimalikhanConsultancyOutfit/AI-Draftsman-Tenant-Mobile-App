import { yupResolver } from '@hookform/resolvers/yup';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text } from 'react-native';

import { Button, TextField, useToast } from '@/components/ui';
import type { AuthStackParamList } from '@/navigation/types';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useResetPasswordMutation } from '@/store/authApi';
import { useAppTheme } from '@/theme/ThemeContext';

import { AuthScreenLayout } from '../components/AuthScreenLayout';
import { resetPasswordSchema, type ResetPasswordFormValues } from '../schemas/authSchemas';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

/** Reached via the emailed deep link `aidraftsmantenant://reset-password/:token`
 * (1h HMAC-signed token). Success is a 204 with no session — per the backend,
 * resetting a password invalidates existing sessions but does NOT sign the
 * user in, so this screen returns to Login on success rather than the app. */
export function ResetPasswordScreen({ route, navigation }: Props) {
  const { theme } = useAppTheme();
  const toast = useToast();
  const { token } = route.params;
  const [showPassword, setShowPassword] = useState(false);
  const [resetPassword, { isLoading, error }] = useResetPasswordMutation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: yupResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    const result = await resetPassword({ token, password: values.password }).unwrap().catch(() => undefined);
    if (result !== undefined) {
      toast.show('Password reset. Sign in with your new password.', { tone: 'success' });
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  };

  return (
    <AuthScreenLayout eyebrow="Reset password" title="Choose a new password" subtitle="Your new password must be at least 8 characters.">
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="New password"
            leftIcon="lock"
            rightIcon={showPassword ? 'visibility-off' : 'visibility'}
            onRightIconPress={() => setShowPassword((v) => !v)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            textContentType="newPassword"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.password?.message}
            returnKeyType="next"
          />
        )}
      />

      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Confirm new password"
            leftIcon="lock"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            textContentType="newPassword"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.confirmPassword?.message}
            returnKeyType="go"
            onSubmitEditing={handleSubmit(onSubmit)}
          />
        )}
      />

      {error && (
        <Text style={{ color: theme.colors.error, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
          {getErrorMessage(error, 'That reset link is invalid or has expired.')}
        </Text>
      )}

      <Button label="Reset password" onPress={handleSubmit(onSubmit)} loading={isLoading} fullWidth />
    </AuthScreenLayout>
  );
}
