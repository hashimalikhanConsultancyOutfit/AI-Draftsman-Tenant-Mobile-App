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
 *
 * Alongside `phase`, two plain booleans record how far through the two-step
 * sign-in the user actually is:
 *
 *   isLoggedIn     — the PASSWORD step passed (POST /auth/credentials 200,
 *                    or a restored session cookie).
 *   isOtpVerified  — the SECOND FACTOR passed (POST /auth/verify-otp 200,
 *                    or a restored session cookie, which by definition
 *                    already cleared OTP when it was minted).
 *
 * The app stack is gated on `isLoggedIn && isOtpVerified` (see
 * selectIsFullyAuthenticated). They are derivable from `phase`, but keeping
 * them explicit is what makes the reset on sign-out unambiguous: one place
 * sets them both back to false, and no stale half-authenticated state can
 * survive into the next sign-in attempt.
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

export interface AuthState {
  phase: AuthPhase;
  /** Password step cleared. Never true on the Login screen. */
  isLoggedIn: boolean;
  /** Second factor cleared. Only ever true while `isLoggedIn` is true. */
  isOtpVerified: boolean;
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
  isLoggedIn: false,
  isOtpVerified: false,
  pendingOtp: null,
  pendingEnrolment: null,
  freshRecoveryCodes: null,
  session: null,
  refusalMessage: null,
};

/**
 * Phases where a sign-in attempt is already underway on this device. A
 * `GET /auth/session` that resolves `authenticated:false` while one of
 * these is active is STALE by definition — it was in flight from before the
 * attempt started (bootstrap, or the refetch that follows a cache reset on
 * sign-out) and knows nothing about the OTP ticket that has since been
 * issued. Letting it through is what used to bounce a second sign-in
 * straight back to a blank Login screen instead of opening the OTP screen.
 */
const IN_FLIGHT_SIGN_IN_PHASES: readonly AuthPhase[] = ['awaitingOtp', 'awaitingTotpEnrolment'];

/** Wipes every trace of a sign-in. The single place sign-out, an expired
 * session and "start again from the sign-in screen" all funnel through, so
 * the next attempt always begins from exactly the same state as a cold
 * install. */
function resetToSignedOut(state: AuthState) {
  state.phase = 'signedOut';
  state.isLoggedIn = false;
  state.isOtpVerified = false;
  state.session = null;
  state.pendingOtp = null;
  state.pendingEnrolment = null;
  state.freshRecoveryCodes = null;
  state.refusalMessage = null;
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** GET /auth/session came back — cold start or resume. */
    sessionBootstrapped(
      state,
      action: PayloadAction<{ authenticated: boolean; session: SessionUser | null }>,
    ) {
      if (action.payload.authenticated && action.payload.session) {
        state.pendingOtp = null;
        state.pendingEnrolment = null;
        state.session = action.payload.session;
        state.isLoggedIn = true;
        // A live session cookie can only exist on the far side of a
        // completed OTP verification, so restoring one restores both steps.
        state.isOtpVerified = true;
        state.phase =
          action.payload.session.onboardingStep === 'COMPLETE' ? 'authenticated' : 'onboardingIncomplete';
        state.refusalMessage = null;
        return;
      }

      // Not authenticated. Ignore it if a sign-in is mid-flight — see
      // IN_FLIGHT_SIGN_IN_PHASES.
      if (IN_FLIGHT_SIGN_IN_PHASES.includes(state.phase)) return;

      resetToSignedOut(state);
    },

    /** POST /auth/credentials succeeded, normal branch — OTP ticket issued. */
    credentialsAccepted(state, action: PayloadAction<PendingOtp>) {
      state.pendingOtp = action.payload;
      state.pendingEnrolment = null;
      state.isLoggedIn = true;
      state.isOtpVerified = false;
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
      state.isLoggedIn = true;
      state.isOtpVerified = false;
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
      state.isLoggedIn = true;
      state.isOtpVerified = true;
      state.phase = action.payload.onboardingStep === 'COMPLETE' ? 'authenticated' : 'onboardingIncomplete';
      state.refusalMessage = null;
    },

    /** 423 from /auth/credentials or /auth/session — user status !== ACTIVE. */
    accountRefused(state, action: PayloadAction<{ message: string }>) {
      resetToSignedOut(state);
      state.phase = 'accountDisabled';
      state.refusalMessage = action.payload.message;
    },

    /** 403 from /auth/verify-otp — removed from the workspace mid-ticket. */
    workspaceAccessRevoked(state, action: PayloadAction<{ message: string }>) {
      resetToSignedOut(state);
      state.phase = 'noWorkspaceAccess';
      state.refusalMessage = action.payload.message;
    },

    /** A 401 arrived on an authenticated-only route — the baseQuery's
     * one-shot latch dispatches this instead of storming the login screen
     * with one dispatch per failed in-flight request. */
    sessionExpired(state) {
      if (state.phase === 'authenticated') {
        resetToSignedOut(state);
      }
    },

    /** Explicit logout. */
    signedOut(state) {
      resetToSignedOut(state);
    },

    /** "Start again from the sign-in screen" — an expired/invalid OTP
     * ticket, the user backing out of the OTP screen, or leaving a refusal
     * screen. A half-finished sign-in must not survive this. */
    otpFlowReset(state) {
      resetToSignedOut(state);
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

/* Typed structurally rather than against RootState so this module stays
   free of an import cycle with store/index.ts (which imports this
   reducer). */
type AuthRootState = { auth: AuthState };

export const selectAuthPhase = (state: AuthRootState) => state.auth.phase;
export const selectIsLoggedIn = (state: AuthRootState) => state.auth.isLoggedIn;
export const selectIsOtpVerified = (state: AuthRootState) => state.auth.isOtpVerified;

/**
 * The one gate between the auth stack and the app stack: BOTH steps done,
 * and the account actually cleared to enter the portal (`authenticated`
 * rather than `onboardingIncomplete`, which is a signed-in-but-refused
 * state that still belongs to the auth stack).
 */
export const selectIsFullyAuthenticated = (state: AuthRootState) =>
  state.auth.isLoggedIn && state.auth.isOtpVerified && state.auth.phase === 'authenticated';

export default authSlice.reducer;
