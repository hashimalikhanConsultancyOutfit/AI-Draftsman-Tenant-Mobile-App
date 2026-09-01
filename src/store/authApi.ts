import { createApi } from '@reduxjs/toolkit/query/react';

import type {
  ConfirmTotpResponse,
  EnrolTotpResponse,
  GetSessionResponse,
  SessionUser,
  SubmitCredentialsResponse,
  VerifyOtpResponse,
} from '@/types/auth';

import { clearAllCookies } from '@/services/cookieAuth';

import { api } from './api';
import type { ApiQueryError } from './baseQuery';
import { baseQuery } from './baseQuery';
import {
  accountRefused,
  credentialsAccepted,
  credentialsRequireEnrolment,
  otpVerified,
  sessionBootstrapped,
  signedOut as signedOutAction,
  totpConfirmed,
  totpEnrolmentStarted,
  workspaceAccessRevoked,
} from './authSlice';

const REFUSED_MESSAGE = 'This account is not active. Ask an owner in your workspace to re-enable it.';
const NO_ACCESS_MESSAGE = 'You no longer have access to this workspace.';

function toSessionUser(
  data: VerifyOtpResponse | GetSessionResponse,
): SessionUser {
  return {
    email: data.email,
    name: data.name,
    status: 'status' in data && data.status ? data.status : null,
    onboardingStep: 'onboardingStep' in data && data.onboardingStep ? (data.onboardingStep as SessionUser['onboardingStep']) : 'COMPLETE',
    role: data.role,
    rolePermissions: data.rolePermissions,
  };
}

/**
 * Auth endpoints. See src/types/auth.ts for the exact response shapes, all
 * confirmed against backend source (apps/gateway-b2b/src/app/auth/
 * sign-in.controller.ts + password-reset.controller.ts, apps/gateway-b2b
 * /src/app/onboarding/onboarding.controller.ts).
 *
 * None of these use RTK Query's normal cache-tag invalidation — auth state
 * lives in the authSlice (via onQueryStarted below), not the query cache,
 * because the rest of the app reads `state.auth`, not
 * `authApi.endpoints.getSession.select()`.
 */
export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery,
  endpoints: (builder) => ({
    submitCredentials: builder.mutation<SubmitCredentialsResponse, { email: string; password: string }>({
      query: (body) => ({ url: '/auth/credentials', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // A 200 with no usable body should never happen for this
          // endpoint, but baseQuery now resolves a bodiless success to
          // `data: null` (see baseQuery.ts) rather than `undefined` — guard
          // here so that shape can never throw and get silently absorbed
          // by the catch below, which would otherwise leave the user
          // stuck on the Login screen with no error and no OTP screen.
          if (!data) return;
          if (data.enrolmentRequired) {
            dispatch(credentialsRequireEnrolment({ email: data.email }));
          } else {
            dispatch(
              credentialsAccepted({ email: data.email, otpLength: data.otpLength, deliveredTo: data.deliveredTo }),
            );
          }
        } catch (err) {
          const error = (err as { error?: ApiQueryError }).error;
          if (error?.status === 423) {
            dispatch(accountRefused({ message: error.messages[0] ?? REFUSED_MESSAGE }));
          }
        }
      },
    }),

    verifyOtp: builder.mutation<VerifyOtpResponse, { code: string }>({
      query: (body) => ({ url: '/auth/verify-otp', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (!data) return;
          dispatch(otpVerified(toSessionUser(data)));
        } catch (err) {
          const error = (err as { error?: ApiQueryError }).error;
          if (error?.status === 403) {
            dispatch(workspaceAccessRevoked({ message: error.messages[0] ?? NO_ACCESS_MESSAGE }));
          }
          // 400/401/429 (bad code, expired ticket, throttled) are left for
          // the OTP screen itself to show inline — they don't change phase.
        }
      },
    }),

    enrolTotp: builder.mutation<EnrolTotpResponse, void>({
      query: () => ({ url: '/auth/enrol-totp', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        if (!data) return;
        dispatch(totpEnrolmentStarted(data));
      },
    }),

    confirmTotp: builder.mutation<ConfirmTotpResponse, { code: string }>({
      query: (body) => ({ url: '/auth/confirm-totp', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        if (!data) return;
        dispatch(totpConfirmed({ recoveryCodes: data.recoveryCodes }));
      },
    }),

    forgotPassword: builder.mutation<void, { email: string }>({
      query: (body) => ({ url: '/auth/forgot-password', method: 'POST', body }),
    }),

    resetPassword: builder.mutation<void, { token: string; password: string }>({
      query: ({ token, password }) => ({
        url: `/auth/reset-password/${encodeURIComponent(token)}`,
        method: 'POST',
        body: { password },
      }),
    }),

    /** Cold-start / resume bootstrap. Always 200 — `authenticated` decides
     * the branch. Also called after confirm-totp, since that endpoint's own
     * response doesn't carry the full session snapshot. */
    getSession: builder.query<GetSessionResponse, void>({
      query: () => ({ url: '/auth/session', method: 'GET' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            sessionBootstrapped({
              authenticated: data.authenticated,
              session: data.authenticated ? toSessionUser(data) : null,
            }),
          );
        } catch (err) {
          const error = (err as { error?: ApiQueryError }).error;
          if (error?.status === 423) {
            dispatch(accountRefused({ message: error.messages[0] ?? REFUSED_MESSAGE }));
          } else {
            // Network error or unexpected status on bootstrap — treat as
            // signed out rather than stranding the splash screen forever.
            dispatch(sessionBootstrapped({ authenticated: false, session: null }));
          }
        }
      },
    }),

    logout: builder.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        // Fires even if the request itself fails — logout must always leave
        // the client in a signed-out state, since the whole point is that
        // the user asked to be signed out.
        try {
          await queryFulfilled;
        } finally {
          dispatch(signedOutAction());
          // Purge every cached query result from the portal api slice —
          // without this, a fast logout -> log back in (as a different
          // account, or the same one) can briefly render the PREVIOUS
          // session's cached dashboard/customers/agents/knowledge-bases
          // data before the authenticated screens refetch.
          dispatch(api.util.resetApiState());
          // Awaited (not fire-and-forget) so the native cookie jar is
          // fully clear before this mutation resolves — otherwise a
          // logout clear that finishes late can race a following login
          // and wipe the fresh session/OTP cookies it just set.
          await clearAllCookies();
        }
      },
    }),
  }),
});

export const {
  useSubmitCredentialsMutation,
  useVerifyOtpMutation,
  useEnrolTotpMutation,
  useConfirmTotpMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useLazyGetSessionQuery,
  useGetSessionQuery,
  useLogoutMutation,
} = authApi;
