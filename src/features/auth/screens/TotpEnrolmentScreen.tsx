import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';

import { Button, Card, OtpInput, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useConfirmTotpMutation, useEnrolTotpMutation } from '@/store/authApi';
import { useAppSelector } from '@/store/hooks';
import { useAppTheme } from '@/theme/ThemeContext';

import { AuthScreenLayout } from '../components/AuthScreenLayout';

/**
 * The `enrolmentRequired: true` branch of POST /auth/credentials — rare: an
 * account whose signup was interrupted before TOTP setup finished. Unlike
 * OtpVerifyScreen, this DOES have a real `otpauthUri` to deeplink into
 * (from POST /auth/enrol-totp), since it's a genuine enrolment, not a login.
 */
export function TotpEnrolmentScreen() {
  const { theme } = useAppTheme();
  const toast = useToast();
  const pendingEnrolment = useAppSelector((state) => state.auth.pendingEnrolment);
  const [enrolTotp, { isLoading: isEnrolling, error: enrolError }] = useEnrolTotpMutation();
  const [confirmTotp, { isLoading: isConfirming, error: confirmError }] = useConfirmTotpMutation();
  const [code, setCode] = useState('');

  const hasStarted = Boolean(pendingEnrolment?.otpauthUri);

  useEffect(() => {
    if (!hasStarted) {
      void enrolTotp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount
  }, []);

  const handleOpenAuthenticator = async () => {
    if (!pendingEnrolment?.otpauthUri) return;
    try {
      await Linking.openURL(pendingEnrolment.otpauthUri);
    } catch {
      toast.show('Could not open Authenticator automatically — copy the secret below instead.', { tone: 'warning' });
    }
  };

  const handleCopySecret = async () => {
    if (!pendingEnrolment?.secret) return;
    await Clipboard.setStringAsync(pendingEnrolment.secret);
    toast.show('Secret copied', { tone: 'success' });
  };

  const handleConfirm = async () => {
    if (code.length !== 6) return;
    const result = await confirmTotp({ code }).unwrap().catch(() => undefined);
    if (!result) setCode('');
    // On success, RootNavigator transitions to RecoveryCodesScreen via
    // freshRecoveryCodes being set in the auth slice.
  };

  return (
    <AuthScreenLayout
      eyebrow="One-time setup"
      title="Set up your authenticator"
      subtitle={`Finish protecting ${pendingEnrolment?.email ?? 'your account'} with a 6-digit code from your authenticator app.`}
    >
      <Card>
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.fontFamilies.body.semibold,
            fontSize: theme.fontSizes.sm,
            marginBottom: theme.space('sm'),
          }}
        >
          1. Add this account to your authenticator app
        </Text>
        <Button
          label="Add to Authenticator"
          onPress={handleOpenAuthenticator}
          variant="outline"
          icon="open-in-new"
          iconPosition="right"
          disabled={!hasStarted || isEnrolling}
          loading={isEnrolling && !hasStarted}
          fullWidth
        />

        {pendingEnrolment?.secret ? (
          <TouchableOpacity onPress={handleCopySecret} style={{ marginTop: theme.space('md') }}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
              Can't open the app automatically? Tap to copy the setup key instead:
            </Text>
            <Text
              style={{
                color: theme.colors.text,
                fontFamily: theme.fontFamilies.mono.regular,
                fontSize: theme.fontSizes.sm,
                marginTop: 4,
                letterSpacing: 1,
              }}
              selectable
            >
              {pendingEnrolment.secret}
            </Text>
          </TouchableOpacity>
        ) : null}

        {enrolError && (
          <Text style={{ color: theme.colors.error, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: theme.space('sm') }}>
            {getErrorMessage(enrolError, 'Could not start two-factor setup.')}
          </Text>
        )}
      </Card>

      <View>
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.fontFamilies.body.semibold,
            fontSize: theme.fontSizes.sm,
            marginBottom: theme.space('sm'),
          }}
        >
          2. Enter the 6-digit code it shows
        </Text>
        <OtpInput length={6} value={code} onChange={setCode} autoFocus={false} editable={!isConfirming} />
      </View>

      {confirmError && (
        <Text style={{ color: theme.colors.error, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, textAlign: 'center' }}>
          {getErrorMessage(confirmError, 'That code is not correct.')}
        </Text>
      )}

      <Button label="Confirm and continue" onPress={handleConfirm} loading={isConfirming} disabled={code.length !== 6} fullWidth />
    </AuthScreenLayout>
  );
}
