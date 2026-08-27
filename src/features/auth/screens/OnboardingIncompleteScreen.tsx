import { View } from 'react-native';

import { Button, Icon } from '@/components/ui';
import { clearAllCookies } from '@/services/cookieAuth';
import { otpFlowReset } from '@/store/authSlice';
import { useAppDispatch } from '@/store/hooks';
import { useAppTheme } from '@/theme/ThemeContext';

import { AuthScreenLayout } from '../components/AuthScreenLayout';

/** `onboardingStep !== 'COMPLETE'` — this account still has steps left in
 * the web signup wizard (KYB, plan selection, team invites, etc.), which is
 * explicitly out of scope for this app (the module list excludes signup).
 * Rather than letting a half-provisioned tenant into a portal that assumes
 * a complete workspace, we send the user back to the web to finish. */
export function OnboardingIncompleteScreen() {
  const { theme } = useAppTheme();
  const dispatch = useAppDispatch();

  const handleBackToSignIn = async () => {
    await clearAllCookies();
    dispatch(otpFlowReset());
  };

  return (
    <AuthScreenLayout
      eyebrow="Almost there"
      title="Finish setting up your workspace"
      subtitle="Your workspace still has setup steps to complete. Please finish onboarding on the web, then come back and sign in here."
    >
      <View style={{ alignItems: 'center', gap: theme.space('lg'), paddingVertical: theme.space('lg') }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: theme.radii.full,
            backgroundColor: theme.colors.statusInfoBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="rocket-launch" size={32} color={theme.colors.statusInfoFg} />
        </View>
        <Button label="Back to sign in" onPress={handleBackToSignIn} variant="outline" />
      </View>
    </AuthScreenLayout>
  );
}
