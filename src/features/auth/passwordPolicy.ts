/**
 * Password policy — the rules a new/reset password must satisfy.
 *
 * Ported from web's `src/features/Signup/passwordPolicy.ts`. Web's reset-password
 * form gates on this full four-rule policy (length, uppercase, digit, special
 * character) via `meetsPolicy`, not just the backend's bare 8-character floor —
 * the DTO's own comment explains why: "the portal's own meter is stricter, and
 * letting the weaker of the two doors decide the policy is how the stronger one
 * stops meaning anything." This app only has a reset-password screen today (no
 * signup/accept-invite flow), so only `meetsPolicy` is ported — the strength
 * meter and requirement checklist that also live in web's version are UI web
 * happens to render alongside the same gate, not part of the validation itself.
 */

export const MIN_PASSWORD_LENGTH = 8;

/** Anything that is not a letter, a digit or whitespace — deliberately broad
 * rather than a hand-picked list like `!@#$%`, so a symbol the user's keyboard
 * can actually produce (`£`, `€`, `—`) is never wrongly refused. */
const SPECIAL_CHARACTER = /[^A-Za-z0-9\s]/;

export const meetsPolicy = (value: string): boolean =>
  value.length >= MIN_PASSWORD_LENGTH && /[A-Z]/.test(value) && /[0-9]/.test(value) && SPECIAL_CHARACTER.test(value);

/** Matches web's `PASSWORD_POLICY_MESSAGE` (`ResetPassword.data.ts`) exactly. */
export const PASSWORD_POLICY_MESSAGE = 'Your password does not meet all four requirements yet.';
