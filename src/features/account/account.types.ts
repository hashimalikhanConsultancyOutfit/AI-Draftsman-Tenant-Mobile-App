/**
 * Account settings — wire types for the signed-in user's own account.
 * Confirmed against the real backend source, not just its Swagger
 * doc-comments (both agreed this time — no drift found), 2026-09-04:
 *
 *   apps/gateway-b2b/src/app/auth/my-settings/my-settings.controller.ts
 *   apps/gateway-b2b/src/app/auth/my-settings/dto/my-settings.dto.ts
 *
 * and web's own `src/store/api/mySettings.api.ts`, which this mirrors
 * field-for-field.
 *
 * ── THIS IS "MY ACCOUNT", NOT "A USER" ───────────────────────────────────
 * Every endpoint behind these types addresses the caller and only the
 * caller — the identity is resolved from the verified session token, and
 * no request carries an id. There is no `/users/:id/account` and none is
 * planned; see the controller's own note on why that is a deliberate
 * absence rather than a gap.
 *
 * ── SERVER-ONLY RULE NOT VISIBLE IN ANY TYPE HERE ────────────────────────
 * `PATCH .../account`'s username check also rejects a small reserved-word
 * list server-side (`RESERVED_USERNAMES`, in b2b-core's
 * `my-settings.service.ts`) — there is no client-side list to mirror it
 * with, on web or here, so a reserved handle can only ever be caught by
 * the submit-time 400 ("That username is reserved."), never by the form
 * itself.
 */

export interface AccountSettings {
  id: string;
  /** Read-only everywhere — there is no email-change flow in this
   * workspace (no verify-the-new-address route exists), so this is never
   * sent back in an update. */
  email: string;
  /** Display name. Null when never set. */
  fullName: string | null;
  /** Handle, unique per workspace, stored lower-cased. Null when never
   * chosen. */
  username: string | null;
  jobTitle: string | null;
  /** Short-lived SAS read link, minted fresh on every `GET`. Never
   * persist this past the query's own lifetime — see `accountApi.ts`. */
  avatarUrl: string | null;
  hasAvatar: boolean;
  /** False when this deployment has no blob storage configured — hide
   * every avatar action rather than offering one that answers 503. */
  avatarUploadAvailable: boolean;
  status: string;
  /** Role name off the membership. Display only — never an input to a
   * permission check. */
  role: string | null;
  level: string | null;
  emailVerifiedAt: string | null;
  /** When a code from the enrolled authenticator was first proven. Set
   * only by the sign-in flow's TOTP enrolment — there is no setting here
   * that writes it. */
  twoFactorEnrolledAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

/** The three editable fields, each sent one at a time — see
 * `AccountFieldFormScreen`. */
export type AccountEditableField = 'fullName' | 'username' | 'jobTitle';

/**
 * A partial edit. Send only the field being changed — an absent field is
 * left alone server-side, and an empty body is a 400 ("nothing to
 * update"), not a no-op success. `null` on `username`/`jobTitle` clears
 * it; `fullName` has no clearing form since it isn't nullable in the DTO.
 */
export interface UpdateAccountRequest {
  fullName?: string;
  username?: string | null;
  jobTitle?: string | null;
}

/**
 * `POST /auth/my-settings/account/password`. Two fields, not three — the
 * confirm box is a property of the form (catching a typo nobody could
 * otherwise see) and is never put on the wire; see
 * `schemas/changePasswordSchema.ts`. Answers 204 with no body on success.
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
