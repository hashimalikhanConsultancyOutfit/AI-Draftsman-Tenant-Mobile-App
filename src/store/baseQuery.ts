import type { BaseQueryFn } from '@reduxjs/toolkit/query';

import { apiRequest, ApiError, NetworkError, type RequestOptions } from '@/services/httpClient';
import { clearAllCookies } from '@/services/cookieAuth';

import { sessionExpired } from './authSlice';

export interface ApiRequestArgs {
  url: string;
  method?: RequestOptions['method'];
  body?: unknown;
  query?: RequestOptions['query'];
  /** Auth endpoints that must NOT send the session cookie (none currently —
   * every auth route relies on either no cookie or the OTP ticket cookie,
   * both handled by httpClient's own cookie-jar read), kept for parity with
   * apiRequest's own option. */
  skipAuthHeader?: boolean;
  /** Extra request headers — currently just `Idempotency-Key` on a couple
   * of write endpoints (customer register, import apply) that need
   * double-tap/retry safety on a flaky mobile connection. Merged under
   * the Content-Type/Cookie headers httpClient sets itself, so this can't
   * override either. */
  headers?: Record<string, string>;
}

export interface ApiQueryError {
  status: number | 'NETWORK_ERROR';
  messages: string[];
  details: unknown;
  code: string | undefined;
  retryAfterSeconds: number | undefined;
}

/**
 * RTK Query baseQuery wrapping the low-level apiRequest — see httpClient.ts
 * for the shared cookie-attachment and error-normalisation logic. This layer
 * adds exactly one thing: the 401 latch. A 401 on an authenticated route
 * means the session cookie is gone or expired (natural 7-day expiry, or a
 * revoked session) — dispatched once as `sessionExpired`, not once per
 * in-flight request, by checking current phase before dispatching rather
 * than a module-level mutable flag (which would leak across store
 * instances, e.g. in tests).
 */
export const baseQuery: BaseQueryFn<ApiRequestArgs, unknown, ApiQueryError> = async (args, api) => {
  try {
    const data = await apiRequest(args.url, {
      method: args.method,
      body: args.body,
      query: args.query,
      skipAuthHeader: args.skipAuthHeader,
      headers: args.headers,
    });
    // A success response with no JSON body (e.g. logout's 204) resolves
    // `data` to `undefined`. RTK Query's dev-mode result validation treats
    // `{ data: undefined }` as invalid — indistinguishable from "neither
    // data nor error set" — and logs an "Error encountered handling the
    // endpoint ..." console.error, which React Native's LogBox then
    // surfaces as an on-screen banner (seen on sign-out, whose endpoint
    // returns no body). `null` is a real, present value, so every
    // bodiless-but-successful endpoint stays a normal, silent success.
    return { data: data ?? null };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.isUnauthorized) {
        const state = api.getState() as { auth?: { phase?: string } };
        if (state.auth?.phase === 'authenticated') {
          api.dispatch(sessionExpired());
          // Stale/expired cookie hygiene — a dead session cookie left in the
          // native jar would otherwise keep being sent (and keep 401ing) on
          // every request until the user explicitly logs out.
          void clearAllCookies();
        }
      }
      return {
        error: {
          status: err.statusCode,
          messages: err.messages,
          details: err.details,
          code: err.code,
          retryAfterSeconds: err.retryAfterSeconds,
        },
      };
    }
    if (err instanceof NetworkError) {
      return {
        error: {
          status: 'NETWORK_ERROR',
          messages: [err.message],
          details: undefined,
          code: undefined,
          retryAfterSeconds: undefined,
        },
      };
    }
    throw err;
  }
};
