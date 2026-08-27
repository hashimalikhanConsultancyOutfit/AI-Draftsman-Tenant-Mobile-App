export type AuthStackParamList = {
  Login: undefined;
  OtpVerify: undefined;
  TotpEnrolment: undefined;
  RecoveryCodes: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
  AccountRefused: undefined;
  OnboardingIncomplete: undefined;
};

/** Placeholder until Phase 4+ builds the real Drawer/Tabs shell — see
 * PlaceholderHomeScreen.tsx. Extended as each module phase lands. */
export type AppStackParamList = {
  PlaceholderHome: undefined;
};
