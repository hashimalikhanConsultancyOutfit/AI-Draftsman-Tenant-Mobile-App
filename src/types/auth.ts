/**
 * Shared auth types — response shapes confirmed against backend source
 * directly (apps/gateway-b2b/src/app/auth/sign-in.controller.ts,
 * password-reset.controller.ts; apps/gateway-b2b/src/app/onboarding
 * /onboarding.controller.ts) plus the real POST /auth/verify-otp payload
 * the user captured from a live login. Where the two disagreed (verify-otp's
 * response includes `status` in the real capture but the controller's
 * documented shape did not list it), fields are optional rather than
 * assumed absent — better to read a field that's sometimes there than to
 * silently drop it.
 */

/** `OnboardingStep` — Prisma enum, schema-core.prisma. Only COMPLETE means
 * "into the portal"; every other value belongs to the web signup wizard,
 * which is out of scope for this app (see module list — signup excluded). */
export type OnboardingStep =
  | 'REGISTERED'
  | 'EMAIL_VERIFIED'
  | 'KYB_SUBMITTED'
  | 'PLAN_SELECTED'
  | 'PROVISIONED'
  | 'TEAM_INVITED'
  | 'CUSTOMERS_REGISTERED'
  | 'PAYMENT_CONFIGURED'
  | 'COMPLETE';

/** `UserStatus` — Prisma enum. Non-ACTIVE produces a 423 at login/session. */
export type UserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

/** `TenantStatus` — Prisma enum. Not enforced at login; travels as a claim
 * and is enforced per-route by TenantActiveGuard once inside the portal. */
export type TenantStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ON_HOLD' | 'TERMINATED';

export interface SessionRole {
  id: string;
  name: string;
  description: string | null;
}

/** POST /auth/credentials — normal path (account already has a TOTP secret). */
export interface SubmitCredentialsResponse {
  email: string;
  otpLength: number;
  deliveredTo: string;
  /** Present and `true` only on the enrolment-required branch. */
  enrolmentRequired?: boolean;
}

/** POST /auth/verify-otp response. `status` is included defensively — the
 * live capture had it, the controller's documented shape didn't list it. */
export interface VerifyOtpResponse {
  email: string;
  name: string;
  status?: UserStatus;
  onboardingStep: OnboardingStep;
  role: SessionRole | null;
  rolePermissions: string[];
}

/** GET /auth/session — always 200. `authenticated:false` means every other
 * field is the Prisma default empty value, not absent. */
export interface GetSessionResponse {
  email: string;
  name: string;
  onboardingStep: OnboardingStep | '';
  status: UserStatus | '';
  authenticated: boolean;
  amr: string[];
  role: SessionRole | null;
  rolePermissions: string[];
}

/** POST /auth/enrol-totp */
export interface EnrolTotpResponse {
  otpauthUri: string;
  secret: string;
  issuer: string;
  accountName: string;
}

/** POST /auth/confirm-totp */
export interface ConfirmTotpResponse {
  totpEnrolledAt: string;
  recoveryCodes: string[];
}

/** The portal-shell-relevant slice of a signed-in session, independent of
 * which endpoint produced it (verify-otp, confirm-totp+session, or the
 * cold-start session bootstrap) — this is what the rest of the app reads. */
export interface SessionUser {
  email: string;
  name: string;
  status: UserStatus | null;
  onboardingStep: OnboardingStep;
  role: SessionRole | null;
  rolePermissions: string[];
}
