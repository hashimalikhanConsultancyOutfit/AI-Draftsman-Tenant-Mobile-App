/**
 * Idempotency keys — ported from the web app's `src/lib/ids.ts`. A retry
 * of the same user action (a double-tap on Register, a flaky-network
 * resubmit) should land once server-side, not twice — the gateway's
 * `Idempotency-Key` header is what makes a resend of the same write a
 * no-op 200 rather than a second row. A RETRY of a distinct failed
 * attempt needs a NEW key each time — never reuse one across attempts
 * that are meant to be different writes.
 *
 * `crypto.randomUUID` needs a secure context; Hermes on recent Expo SDKs
 * has it, but the fallback below keeps this safe even if that ever isn't
 * true. It doesn't need to be cryptographically strong — uniqueness
 * within one session is the whole requirement.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const random = Math.random().toString(16).slice(2);
  return `idem-${Date.now().toString(16)}-${random}`;
}
