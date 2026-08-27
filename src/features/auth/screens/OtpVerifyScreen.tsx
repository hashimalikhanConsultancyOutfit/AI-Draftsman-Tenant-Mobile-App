import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Linking, Platform, Text, TouchableOpacity, View } from 'react-native';

import { Button, OtpInput } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { otpFlowReset } from '@/store/authSlice';
import { useVerifyOtpMutation } from '@/store/authApi';
import { useAppTheme } from '@/theme/ThemeContext';

import { AuthScreenLayout } from '../components/AuthScreenLayout';

const AUTHENTICATOR_SCHEME = 'googleauthenticator://';
const AUTHENTICATOR_STORE_URL = Platform.select({
  ios: 'https://apps.apple.com/app/google-authenticator/id388497605',
  android: 'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2',
  default: 'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2',
});

/**
 * At LOGIN (an already-enrolled account) there is no `otpauthUri` to
 * deeplink into — the server just wants the 6-digit code (see
 * TotpEnrolmentScreen for the ENROLMENT case, which does have a real
 * deeplink). This screen's "Open Authenticator" is a best-effort app-switch
 * convenience only, plus a clipboard-paste shortcut, since Google
 * Authenticator supports tap-to-copy on its own codes.
 */
export function OtpVerifyScreen() {
  const { theme } = useAppTheme();
  const dispatch = useAppDispatch();
  const pendingOtp = useAppSelector((state) => state.auth.pendingOtp);
  const [code, setCode] = useState('');
  const [verifyOtp, { isLoading, error }] = useVerifyOtpMutation();

  const otpLength = pendingOtp?.otpLength ?? 6;

  const handleOpenAuthenticator = async () => {
    try {
      const canOpen = await Linking.canOpenURL(AUTHENTICATOR_SCHEME);
      await Linking.openURL(canOpen ? AUTHENTICATOR_SCHEME : AUTHENTICATOR_STORE_URL);
    } catch {
      await Linking.openURL(AUTHENTICATOR_STORE_URL).catch(() => undefined);
    }
  };

  const handlePasteCode = async () => {
    const text = await Clipboard.getStringAsync();
    const digits = text.replace(/[^0-9]/g, '');
    if (digits.length === otpLength) {
      setCode(digits);
    }
  };

  const handleVerify = async (submittedCode: string) => {
    if (submittedCode.length !== otpLength) return;
    const result = await verifyOtp({ code: submittedCode }).unwrap().catch(() => undefined);
    if (!result) setCode('');
  };

  const handleBackToSignIn = () => {
    dispatch(otpFlowReset());
  };

  if (!pendingOtp) {
    // Defensive — RootNavigator only mounts this screen while phase is
    // 'awaitingOtp', which always carries pendingOtp, but a fast back
    // navigation could theoretically race the phase change.
    return null;
  }

  return (
    <AuthScreenLayout
      eyebrow="Two-factor verification"
      title="Enter your code"
      subtitle={`Open ${pendingOtp.deliveredTo} and enter the ${otpLength}-digit code for ${pendingOtp.email}.`}
    >
      <OtpInput length={otpLength} value={code} onChange={setCode} editable={!isLoading} />

      {error && (
        <Text
          style={{
            color: theme.colors.error,
            fontFamily: theme.fontFamilies.body.regular,
            fontSize: theme.fontSizes.sm,
            textAlign: 'center',
          }}
        >
          {getErrorMessage(error, 'That code is not correct.')}
        </Text>
      )}

      <View style={{ gap: theme.space('sm'), marginTop: theme.space('sm') }}>
        <Button label="Verify" onPress={() => handleVerify(code)} loading={isLoading} disabled={code.length !== otpLength} fullWidth />
        <Button label="Open Authenticator app" onPress={handleOpenAuthenticator} variant="outline" icon="open-in-new" iconPosition="right" fullWidth />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: theme.space('md') }}>
        <TouchableOpacity onPress={handlePasteCode} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
            Paste code
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleBackToSignIn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
            Back to sign in
          </Text>
        </TouchableOpacity>
      </View>
    </AuthScreenLayout>
  );
}
