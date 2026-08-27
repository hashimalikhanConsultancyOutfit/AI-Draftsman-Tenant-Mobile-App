import { yupResolver } from '@hookform/resolvers/yup';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, TouchableOpacity, View } from 'react-native';

import { Button, TextField } from '@/components/ui';
import type { AuthStackParamList } from '@/navigation/types';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useSubmitCredentialsMutation } from '@/store/authApi';
import { useAppTheme } from '@/theme/ThemeContext';

import { AuthScreenLayout } from '../components/AuthScreenLayout';
import { loginSchema, type LoginFormValues } from '../schemas/authSchemas';

export function LoginScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [showPassword, setShowPassword] = useState(false);
  const [submitCredentials, { isLoading, error }] = useSubmitCredentialsMutation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: yupResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    // Navigation on success is driven entirely by the auth phase change in
    // RootNavigator (submitCredentials's onQueryStarted dispatches
    // credentialsAccepted / credentialsRequireEnrolment / accountRefused,
    // which flips `state.auth.phase`) — this screen doesn't navigate itself.
    await submitCredentials({ email: values.email, password: values.password }).unwrap().catch(() => undefined);
  };

  return (
    <AuthScreenLayout
      eyebrow="AI Draftsman"
      title="Welcome back"
      subtitle="Sign in to your workspace's tenant portal."
      footer={
        <TouchableOpacity
          onPress={() => navigation.navigate('ForgotPassword')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text
            style={{
              color: theme.colors.accent,
              fontFamily: theme.fontFamilies.body.semibold,
              fontSize: theme.fontSizes.sm,
              textAlign: 'center',
            }}
          >
            Forgot your password?
          </Text>
        </TouchableOpacity>
      }
    >
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Email"
            leftIcon="email"
            placeholder="you@company.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.email?.message}
            returnKeyType="next"
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Password"
            leftIcon="lock"
            rightIcon={showPassword ? 'visibility-off' : 'visibility'}
            onRightIconPress={() => setShowPassword((v) => !v)}
            rightIconAccessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            placeholder="••••••••"
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            secureTextEntry={!showPassword}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.password?.message}
            returnKeyType="go"
            onSubmitEditing={handleSubmit(onSubmit)}
          />
        )}
      />

      {error && (
        <Text
          style={{
            color: theme.colors.error,
            fontFamily: theme.fontFamilies.body.regular,
            fontSize: theme.fontSizes.sm,
          }}
        >
          {getErrorMessage(error, 'That email and password do not match.')}
        </Text>
      )}

      <View style={{ marginTop: theme.space('sm') }}>
        <Button label="Sign in" onPress={handleSubmit(onSubmit)} loading={isLoading} fullWidth />
      </View>
    </AuthScreenLayout>
  );
}
