import { View } from 'react-native';

import { Button, Icon } from '@/components/ui';
import { clearAllCookies } from '@/services/cookieAuth';
import { otpFlowReset } from '@/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useAppTheme } from '@/theme/ThemeContext';

import { AuthScreenLayout } from '../components/AuthScreenLayout';

/** Covers both refusal phases: `accountDisabled` (423 — user status isn't
 * ACTIVE) and `noWorkspaceAccess` (403 at verify-otp — removed from the
 * tenant mid-ticket). Same screen, different copy, because both are
 * dead-end states the user can only resolve by contacting their workspace
 * owner — there's nothing actionable to differentiate in the UI. */
export function AccountRefusedScreen() {
  const { theme } = useAppTheme();
  const dispatch = useAppDispatch();
  const phase = useAppSelector((state) => state.auth.phase);
  const refusalMessage = useAppSelector((state) => state.auth.refusalMessage);

  const isWorkspaceAccess = phase === 'noWorkspaceAccess';

  const handleBackToSignIn = async () => {
    await clearAllCookies();
    dispatch(otpFlowReset());
  };

  return (
    <AuthScreenLayout
      eyebrow={isWorkspaceAccess ? 'Access removed' : 'Account not active'}
      title={isWorkspaceAccess ? "You've lost access to this workspace" : 'Your account is not active'}
      subtitle={refusalMessage ?? 'Ask an owner in your workspace to re-enable it.'}
    >
      <View style={{ alignItems: 'center', gap: theme.space('lg'), paddingVertical: theme.space('lg') }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: theme.radii.full,
            backgroundColor: theme.colors.statusWarningBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="lock" size={32} color={theme.colors.statusWarningFg} />
        </View>
        <Button label="Back to sign in" onPress={handleBackToSignIn} variant="outline" />
      </View>
    </AuthScreenLayout>
  );
}
