import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AccountRefusedScreen } from '@/features/auth/screens/AccountRefusedScreen';
import { ForgotPasswordScreen } from '@/features/auth/screens/ForgotPasswordScreen';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { OnboardingIncompleteScreen } from '@/features/auth/screens/OnboardingIncompleteScreen';
import { OtpVerifyScreen } from '@/features/auth/screens/OtpVerifyScreen';
import { RecoveryCodesScreen } from '@/features/auth/screens/RecoveryCodesScreen';
import { ResetPasswordScreen } from '@/features/auth/screens/ResetPasswordScreen';
import { TotpEnrolmentScreen } from '@/features/auth/screens/TotpEnrolmentScreen';
import { useAppSelector } from '@/store/hooks';

import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * Every screen is always registered — which one is reachable is decided by
 * `initialRouteName`, driven by the auth phase (see RootNavigator).
 *
 * `initialRouteName` is only read on mount, not reactive to later prop
 * changes — React Navigation's own documented behaviour. Screens reached by
 * an explicit user tap (Login -> ForgotPassword -> ResetPassword) use
 * `navigation.navigate` and don't need the phase to change. Screens reached
 * by a PHASE change (Login -> OtpVerify -> TotpEnrolment -> RecoveryCodes,
 * or any of these -> a refusal screen) need the navigator to remount with a
 * new initial route — done here by keying the Stack.Navigator on the
 * derived route name, so a phase transition forces a fresh mount instead of
 * silently no-op'ing.
 */
export function AuthNavigator() {
  const phase = useAppSelector((state) => state.auth.phase);
  const hasFreshRecoveryCodes = useAppSelector((state) => state.auth.freshRecoveryCodes !== null);

  const initialRouteName: keyof AuthStackParamList =
    phase === 'awaitingOtp'
      ? 'OtpVerify'
      : phase === 'awaitingTotpEnrolment'
        ? hasFreshRecoveryCodes
          ? 'RecoveryCodes'
          : 'TotpEnrolment'
        : phase === 'accountDisabled' || phase === 'noWorkspaceAccess'
          ? 'AccountRefused'
          : phase === 'onboardingIncomplete'
            ? 'OnboardingIncomplete'
            : 'Login';

  return (
    <Stack.Navigator key={initialRouteName} initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
      <Stack.Screen name="TotpEnrolment" component={TotpEnrolmentScreen} />
      <Stack.Screen name="RecoveryCodes" component={RecoveryCodesScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="AccountRefused" component={AccountRefusedScreen} />
      <Stack.Screen name="OnboardingIncomplete" component={OnboardingIncompleteScreen} />
    </Stack.Navigator>
  );
}
