import type { SerializedError } from '@reduxjs/toolkit';

import type { ApiQueryError } from '@/store/baseQuery';

/**
 * Turns an RTK Query error into one user-facing line. Every auth screen
 * needs this — form-level failures (wrong credentials, wrong OTP,
 * throttling) are shown inline rather than as a toast, since they're the
 * direct answer to "why didn't that work" for the field the user just
 * submitted.
 *
 * A mutation's `error` is typed `ApiQueryError | SerializedError` by RTK
 * Query — SerializedError is what a THROWN (not returned) error inside the
 * query pipeline serializes to, distinct from our baseQuery's own
 * ApiQueryError shape. Both are handled so a call site never has to
 * narrow the union itself.
 */
export function getErrorMessage(
  error: ApiQueryError | SerializedError | undefined,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!error) return fallback;
  if (!('status' in error)) {
    // SerializedError — no `status`/`messages`, just RTK's own serialized
    // Error fields.
    return error.message ?? fallback;
  }
  if (error.status === 'NETWORK_ERROR') {
    return error.messages[0] ?? 'Unable to reach the server. Check your connection and try again.';
  }
  if (error.status === 429) {
    const wait = error.retryAfterSeconds;
    return wait
      ? `Too many attempts. Try again in ${wait} second${wait === 1 ? '' : 's'}.`
      : (error.messages[0] ?? 'Too many attempts. Please wait and try again.');
  }
  return error.messages[0] ?? fallback;
}
