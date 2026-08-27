import { yupResolver } from '@hookform/resolvers/yup';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';

import { Button, Icon, TextField } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useForgotPasswordMutation } from '@/store/authApi';
import { useAppTheme } from '@/theme/ThemeContext';

import { AuthScreenLayout } from '../components/AuthScreenLayout';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../schemas/authSchemas';

export function ForgotPasswordScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation();
  const [submitted, setSubmitted] = useState(false);
  const [forgotPassword, { isLoading, error }] = useForgotPasswordMutation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: yupResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    // 202 always, regardless of whether the email exists — anti-enumeration
    // on the backend. We mirror that: a 400 (malformed) still shows inline,
    // but any success (or a 429 we choose to treat the same way) reaches
    // the same confirmation state, since revealing "that email isn't
    // throttled but doesn't exist either" would leak account existence.
    const result = await forgotPassword({ email: values.email }).unwrap().catch(() => undefined);
    if (result !== undefined || !error) setSubmitted(true);
  };

  if (submitted) {
    return (
      <AuthScreenLayout eyebrow="Check your email" title="Reset link sent" subtitle="If an account exists for that email, we've sent a link to reset your password.">
        <View style={{ alignItems: 'center', gap: theme.space('md'), paddingVertical: theme.space('lg') }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: theme.radii.full,
              backgroundColor: theme.colors.statusSuccessBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="check-circle" size={30} color={theme.colors.statusSuccessFg} />
          </View>
          <Button label="Back to sign in" onPress={() => navigation.goBack()} variant="outline" />
        </View>
      </AuthScreenLayout>
    );
  }

  return (
    <AuthScreenLayout
      eyebrow="Reset password"
      title="Forgot your password?"
      subtitle="Enter the email you sign in with and we'll send you a link to reset it."
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
            returnKeyType="go"
            onSubmitEditing={handleSubmit(onSubmit)}
          />
        )}
      />

      {error && (
        <Text style={{ color: theme.colors.error, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
          {getErrorMessage(error)}
        </Text>
      )}

      <Button label="Send reset link" onPress={handleSubmit(onSubmit)} loading={isLoading} fullWidth />
    </AuthScreenLayout>
  );
}
