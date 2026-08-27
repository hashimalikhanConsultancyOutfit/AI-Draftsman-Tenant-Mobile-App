import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { SessionUser } from '@/types/auth';

/**
 * The auth state machine. Every phase maps to exactly one place in the
 * navigation tree (see navigation/RootNavigator.tsx, built alongside the
 * auth screens):
 *
 *   bootstrapping         -> SplashGate (native splash still showing / GET
 *                            /auth/session in flight)
 *   signedOut             -> AuthStack, Login screen
 *   awaitingOtp           -> AuthStack, OTP verify screen
 *   awaitingTotpEnrolment -> AuthStack, TOTP enrolment screen (the
 *                            `enrolmentRequired:true` branch of
 *                            /auth/credentials — rare: an account that
 *                            never finished signup's TOTP step)
 *   accountDisabled       -> AuthStack, refusal screen (423 — user status
 *                            not ACTIVE)
 *   noWorkspaceAccess     -> AuthStack, refusal screen (403 at verify-otp —
 *                            removed from the tenant)
 *   onboardingIncomplete  -> AuthStack, refusal screen (onboardingStep !==
 *                            COMPLETE — the account still has steps left in
 *                            the web signup wizard, which this app doesn't
 *                            implement; out of scope per the module list)
 *   authenticated         -> AppDrawer (the portal itself)
 */
export type AuthPhase =
  | 'bootstrapping'
  | 'signedOut'
  | 'awaitingOtp'
  | 'awaitingTotpEnrolment'
  | 'accountDisabled'
  | 'noWorkspaceAccess'
  | 'onboardingIncomplete'
  | 'authenticated';

interface PendingOtp {
  email: string;
  otpLength: number;
  deliveredTo: string;
}

interface PendingTotpEnrolment {
  email: string;
  otpauthUri: string;
  secret: string;
  issuer: string;
  accountName: string;
}

interface AuthState {
  phase: AuthPhase;
  pendingOtp: PendingOtp | null;
  pendingEnrolment: PendingTotpEnrolment | null;
  /** Shown once, right after confirm-totp — never persisted or refetchable. */
  freshRecoveryCodes: string[] | null;
  session: SessionUser | null;
  /** The refusal message from a 423/403 at login, for the refusal screen. */
  refusalMessage: string | null;
}

const initialState: AuthState = {
  phase: 'bootstrapping',
  pendingOtp: null,
  pendingEnrolment: null,
  freshRecoveryCodes: null,
  session: null,
  refusalMessage: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** GET /auth/session came back — cold start or resume. */
    sessionBootstrapped(
      state,
      action: PayloadAction<{ authenticated: boolean; session: SessionUser | null }>,
    ) {
      state.pendingOtp = null;
      state.pendingEnrolment = null;
      if (action.payload.authenticated && action.payload.session) {
        state.session = action.payload.session;
        state.phase = action.payload.session.onboardingStep === 'COMPLETE' ? 'authenticated' : 'onboardingIncomplete';
        state.refusalMessage = null;
      } else {
        state.session = null;
        state.phase = 'signedOut';
      }
    },

    /** POST /auth/credentials succeeded, normal branch — OTP ticket issued. */
    credentialsAccepted(state, action: PayloadAction<PendingOtp>) {
      state.pendingOtp = action.payload;
      state.pendingEnrolment = null;
      state.phase = 'awaitingOtp';
      state.refusalMessage = null;
    },

    /** POST /auth/credentials succeeded, enrolmentRequired branch — a
     * password-only session cookie is now set, but there's nothing to
     * verify yet. The enrol-totp call happens next, from the enrolment
     * screen itself. */
    credentialsRequireEnrolment(state, action: PayloadAction<{ email: string }>) {
      state.pendingOtp = null;
      state.pendingEnrolment = {
        email: action.payload.email,
        otpauthUri: '',
        secret: '',
        issuer: '',
        accountName: '',
      };
      state.phase = 'awaitingTotpEnrolment';
      state.refusalMessage = null;
    },

    /** POST /auth/enrol-totp succeeded — the deeplink payload arrived. */
    totpEnrolmentStarted(
      state,
      action: PayloadAction<{ otpauthUri: string; secret: string; issuer: string; accountName: string }>,
    ) {
      if (!state.pendingEnrolment) {
        state.pendingEnrolment = { email: action.payload.accountName, ...action.payload };
      } else {
        state.pendingEnrolment = { ...state.pendingEnrolment, ...action.payload };
      }
    },

    /** POST /auth/confirm-totp succeeded — recovery codes shown once, then
     * the screen triggers a session fetch to get the full session snapshot
     * (confirm-totp's own response doesn't carry rolePermissions etc). */
    totpConfirmed(state, action: PayloadAction<{ recoveryCodes: string[] }>) {
      state.freshRecoveryCodes = action.payload.recoveryCodes;
      state.pendingEnrolment = null;
    },

    recoveryCodesAcknowledged(state) {
      state.freshRecoveryCodes = null;
    },

    /** POST /auth/verify-otp succeeded. */
    otpVerified(state, action: PayloadAction<SessionUser>) {
      state.session = action.payload;
      state.pendingOtp = null;
      state.phase = action.payload.onboardingStep === 'COMPLETE' ? 'authenticated' : 'onboardingIncomplete';
      state.refusalMessage = null;
    },

    /** 423 from /auth/credentials or /auth/session — user status !== ACTIVE. */
    accountRefused(state, action: PayloadAction<{ message: string }>) {
      state.phase = 'accountDisabled';
      state.refusalMessage = action.payload.message;
      state.pendingOtp = null;
      state.pendingEnrolment = null;
      state.session = null;
    },

    /** 403 from /auth/verify-otp — removed from the workspace mid-ticket. */
    workspaceAccessRevoked(state, action: PayloadAction<{ message: string }>) {
      state.phase = 'noWorkspaceAccess';
      state.refusalMessage = action.payload.message;
      state.pendingOtp = null;
      state.pendingEnrolment = null;
      state.session = null;
    },

    /** A 401 arrived on an authenticated-only route — the baseQuery's
     * one-shot latch dispatches this instead of storming the login screen
     * with one dispatch per failed in-flight request. */
    sessionExpired(state) {
      if (state.phase === 'authenticated') {
        state.phase = 'signedOut';
        state.session = null;
      }
    },

    /** Explicit logout. */
    signedOut(state) {
      state.phase = 'signedOut';
      state.session = null;
      state.pendingOtp = null;
      state.pendingEnrolment = null;
      state.freshRecoveryCodes = null;
      state.refusalMessage = null;
    },

    /** "Start again from the sign-in screen" — an expired/invalid OTP
     * ticket, or the user backing out of the OTP screen. */
    otpFlowReset(state) {
      state.pendingOtp = null;
      state.phase = 'signedOut';
    },
  },
});

export const {
  sessionBootstrapped,
  credentialsAccepted,
  credentialsRequireEnrolment,
  totpEnrolmentStarted,
  totpConfirmed,
  recoveryCodesAcknowledged,
  otpVerified,
  accountRefused,
  workspaceAccessRevoked,
  sessionExpired,
  signedOut,
  otpFlowReset,
} = authSlice.actions;

export default authSlice.reducer;
