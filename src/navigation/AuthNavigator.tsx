import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AccountRefusedScreen } from '@/features/auth/screens/AccountRefusedScreen';
import { ForgotPasswordScreen } from '@/features/auth/screens/ForgotPasswordScreen';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { OnboardingIncompleteScreen } from '@/features/auth/screens/OnboardingIncompleteScreen';
import { OtpVerifyScreen } from '@/features/auth/screens/OtpVerifyScreen';
import { RecoveryCodesScreen } from '@/features/auth/screens/RecoveryCodesScreen';
import { ResetPasswordScreen } from '@/features/auth/screens/ResetPasswordScreen';
import { TotpEnrolmentScreen } from '@/features/auth/screens/TotpEnrolmentScreen';
import { selectAuthPhase } from '@/store/authSlice';
import { useAppSelector } from '@/store/hooks';

import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * Which screens EXIST is decided by the auth phase — React Navigation's own
 * documented pattern for auth flows. Only the group valid for the current
 * phase is registered, so a phase change (signedOut -> awaitingOtp ->
 * authenticated, and every way back) is just a re-render: the navigator
 * transitions to the newly-registered screen on its own.
 *
 * This replaces an earlier `initialRouteName` + `key`-remount arrangement.
 * `initialRouteName` is read once on mount and is not reactive, so every
 * phase change had to force a full remount of the navigator by changing its
 * `key` — which meant the sign-in flow depended on a remount landing at
 * exactly the right moment, and lost the transition animation. Registering
 * screens conditionally needs neither: there is no initial route to go
 * stale, and nothing to remount.
 *
 * The signed-out group keeps Login/ForgotPassword/ResetPassword together
 * because those three are reached by explicit taps (and the emailed
 * `aidraftsmantenant://reset-password/:token` deep link), not by a phase
 * change — they need to be pushable onto the same stack.
 */
export function AuthNavigator() {
  const phase = useAppSelector(selectAuthPhase);
  const hasFreshRecoveryCodes = useAppSelector((state) => state.auth.freshRecoveryCodes !== null);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {phase === 'awaitingOtp' ? (
        <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
      ) : phase === 'awaitingTotpEnrolment' ? (
        hasFreshRecoveryCodes ? (
          <Stack.Screen name="RecoveryCodes" component={RecoveryCodesScreen} />
        ) : (
          <Stack.Screen name="TotpEnrolment" component={TotpEnrolmentScreen} />
        )
      ) : phase === 'accountDisabled' || phase === 'noWorkspaceAccess' ? (
        <Stack.Screen name="AccountRefused" component={AccountRefusedScreen} />
      ) : phase === 'onboardingIncomplete' ? (
        <Stack.Screen name="OnboardingIncomplete" component={OnboardingIncompleteScreen} />
      ) : (
        <Stack.Group>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}
