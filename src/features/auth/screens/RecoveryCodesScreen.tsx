import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, Icon, useToast } from '@/components/ui';
import { useLazyGetSessionQuery } from '@/store/authApi';
import { recoveryCodesAcknowledged } from '@/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useAppTheme } from '@/theme/ThemeContext';

import { AuthScreenLayout } from '../components/AuthScreenLayout';

/**
 * Shown exactly once, immediately after POST /auth/confirm-totp — the
 * backend never returns these codes again (they're bcrypt-hashed server
 * side after this response). confirm-totp's own response doesn't carry the
 * full session snapshot (email/role/rolePermissions), so acknowledging here
 * triggers GET /auth/session to fetch it and complete the transition into
 * the authenticated app.
 */
export function RecoveryCodesScreen() {
  const { theme } = useAppTheme();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const codes = useAppSelector((state) => state.auth.freshRecoveryCodes) ?? [];
  const [triggerGetSession, { isLoading }] = useLazyGetSessionQuery();
  const [copied, setCopied] = useState(false);

  const handleCopyAll = async () => {
    await Clipboard.setStringAsync(codes.join('\n'));
    setCopied(true);
    toast.show('Recovery codes copied', { tone: 'success' });
  };

  const handleContinue = async () => {
    dispatch(recoveryCodesAcknowledged());
    await triggerGetSession().unwrap().catch(() => undefined);
  };

  return (
    <AuthScreenLayout
      eyebrow="Save these now"
      title="Your recovery codes"
      subtitle="Each code can be used once to sign in if you lose access to your authenticator app. This is the only time they'll be shown."
    >
      <Card>
        <View style={{ gap: theme.space('sm') }}>
          {codes.map((code) => (
            <Text
              key={code}
              style={{
                color: theme.colors.text,
                fontFamily: theme.fontFamilies.mono.regular,
                fontSize: theme.fontSizes.md,
                letterSpacing: 1,
              }}
              selectable
            >
              {code}
            </Text>
          ))}
        </View>
      </Card>

      <Button
        label={copied ? 'Copied' : 'Copy all codes'}
        onPress={handleCopyAll}
        variant="outline"
        icon={copied ? 'check' : 'content-copy'}
        fullWidth
      />

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <Icon name="warning-amber" size={16} color={theme.colors.warning} />
        <Text style={{ flex: 1, color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
          Store these somewhere safe outside this device — a password manager is a good place. They will not be shown again.
        </Text>
      </View>

      <Button label="I've saved my codes" onPress={handleContinue} loading={isLoading} fullWidth />
    </AuthScreenLayout>
  );
}
