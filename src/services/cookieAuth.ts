import CookieManager from '@preeternal/react-native-cookie-manager';

import { env } from '@/config/env';

/**
 * Option C — native cookie jar.
 *
 * The backend issues the session as an httpOnly `Set-Cookie: b2b_session`
 * header and never returns a token in a response body (confirmed against
 * both the backend source and the live OpenAPI spec — see
 * conflicts-and-risks.md R-1). `httpOnly` blocks a browser's
 * `document.cookie`, but it does NOT block native OS cookie-store APIs
 * (NSHTTPCookieStorage / Android CookieManager) — those operate below the
 * browser-JS layer entirely, which is what makes this approach viable.
 *
 * We do not rely on RN's networking layer to attach cookies to outgoing
 * requests implicitly (behaviour that varies across RN/OkHttp versions and
 * was flagged as a reliability risk during planning). Instead this module
 * is the single explicit source of truth: httpClient reads the cookie
 * here and sets the `Cookie` header itself on every request. RN's fetch,
 * unlike a browser's, does not forbid manually setting the `Cookie`
 * header — that restriction is browser-only.
 */

const OTP_COOKIE_NAME = 'b2b_otp';
const SESSION_COOKIE_NAME = 'b2b_session';

async function getCookieValue(name: string): Promise<string | undefined> {
  const cookies = await CookieManager.get(env.apiOrigin, true);
  return cookies[name]?.value;
}

export async function getSessionCookie(): Promise<string | undefined> {
  return getCookieValue(SESSION_COOKIE_NAME);
}

export async function getOtpTicketCookie(): Promise<string | undefined> {
  return getCookieValue(OTP_COOKIE_NAME);
}

/**
 * Builds the `Cookie` header for an outgoing request, using the native
 * module's own header builder so Path/Domain matching against
 * `env.apiOrigin` (e.g. the `b2b_otp` cookie's `Path=/api/v1/auth`
 * scoping) is resolved by the same logic a real cookie store uses,
 * rather than reimplemented here.
 */
export async function buildCookieHeader(): Promise<string | undefined> {
  const header = await CookieManager.getCookieHeader(env.apiOrigin, true);
  return header.length > 0 ? header : undefined;
}

export async function hasSessionCookie(): Promise<boolean> {
  const value = await getSessionCookie();
  return Boolean(value);
}

/**
 * Clears every cookie for the API origin. Called on logout and on a
 * hard sign-out (e.g. 423 account-disabled) — native cookie stores are
 * not cleared automatically by the app being "logged out" in JS state,
 * so skipping this would leave a valid session cookie sitting on a
 * shared or reset device.
 */
export async function clearAllCookies(): Promise<void> {
  await CookieManager.clearAll(true);
}
