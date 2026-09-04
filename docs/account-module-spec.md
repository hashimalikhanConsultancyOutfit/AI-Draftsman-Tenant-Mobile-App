# Account module — spec

## Scope

The signed-in user's own profile, sign-in details and account security —
mobile's equivalent of web's `MySettings` dialog's `account` tab
(`AccountPanel` + `ChangePasswordDialog`). Reached as a sub-screen of the
Settings tab (`SettingsStack`'s `Account` route), not its own drawer item —
this matches the existing stub it replaces.

Backed entirely by `GET/PATCH /auth/my-settings/account`,
`POST`/`DELETE /auth/my-settings/account/avatar`, and
`POST /auth/my-settings/account/password` — confirmed against
`apps/gateway-b2b/src/app/auth/my-settings/my-settings.controller.ts` and
its DTOs directly (both agreed with their own Swagger doc-comments this
time — no stale-documentation drift found, unlike several earlier
modules).

In scope, all real and backend-backed:
- Read the account (identity, profile, security, avatar).
- Edit full name, username, job title — one field per edit screen.
- Avatar: pick, upload, remove (gated on `avatarUploadAvailable`).
- Change password (3-field form, forces sign-out on success).
- Sign out (reuses the existing `useLogoutMutation`).

Explicitly out of scope, confirmed non-existent or deliberately dead on
web:
- Account/self-deletion — no endpoint, no web UI.
- Sessions/connected-devices list or remote revoke — no endpoint.
- Email change — by design; email is the sign-in identity and is
  read-only everywhere, with no verify-the-new-address flow in this
  workspace.
- 2FA setup/disable from settings — enrolment is sign-in-flow-only
  (already covered by `TotpEnrolmentScreen`/`OtpVerifyScreen`); this
  screen only shows enrolment status.
- Notification preferences, Plan, Customer portal — separate tabs/modules
  on web with their own backend surfaces, not part of "Account".
- Personalization / Memory panels — removed from web's own nav with an
  explicit note that they persisted data nothing ever read back; not
  ported here either.

## Data layer

- `account.types.ts` — `AccountSettings`, `UpdateAccountRequest`,
  `ChangePasswordRequest`, confirmed field-for-field against the
  controller/DTOs and web's `mySettings.api.ts`. Documents one
  server-only rule with no client-side mirror on either platform: a
  `RESERVED_USERNAMES` check in b2b-core's `my-settings.service.ts` that
  can only ever surface as a submit-time 400, never as a form error.
- `accountRules.ts` — field length/pattern constants (kept in step with
  `UpdateAccountDto`), avatar MIME/size limits, `ACCOUNT_EDIT_CONFIG`
  (title/description/label/hint/clearable/submit+success+error copy per
  editable field, ported from web's `MySettings.data.ts`), initials and
  date-formatting helpers (`formatAccountMoment`/`formatAccountDay`,
  matching web's `formatMoment`/`formatDay`).
- `accountApi.ts` — `getAccount`, `updateAccount`, `uploadAvatar` (multipart
  `FormData`, the app's second multipart write after Branding's logo
  upload — same `httpClient.ts` behaviour), `removeAvatar`, `changePassword`
  (204/no-body on success, no cache tags — nothing rendered depends on a
  password, and the caller signs out afterwards which resets the whole
  cache anyway). New `'Account'` tag registered in `src/store/api.ts`.
- `schemas/accountFieldSchema.ts` — one schema builder shared by the three
  single-field edits (full name required/non-clearable; username and job
  title clearable with their own length/pattern rules), keyed by the
  `AccountFieldForm` route's `field` param.
- `schemas/changePasswordSchema.ts` — mirrors web's `ChangePasswordDialog`
  schema: current password is presence-only (checked against the stored
  hash, not today's policy), new password reuses this app's existing
  `meetsPolicy`/`PASSWORD_POLICY_MESSAGE` from `@/features/auth/passwordPolicy`
  plus a same-as-current client check, confirm password never leaves the
  form.

## Screens

- **`AccountScreen.tsx`** — the main screen. Four sections mirroring
  web's `AccountPanel` grouping (Identity, Profile, Security, System):
  avatar (pick/upload/remove via `expo-image-picker`, already installed),
  full name/username/job title as tappable rows with a chevron (mobile's
  established list-navigation pattern, replacing web's per-row "Change
  X" button), email with a Verified/Unverified chip, workspace role and
  access level read-only, password as a tappable row into
  `ChangePasswordScreen`, two-factor status (On/Off chip, read-only, no
  action), account status/last sign-in/member since read-only, and a
  Sign out button reusing `useLogoutMutation`. **Ungated** — no
  `usePermission` check anywhere on this screen, matching web's explicit
  documented design ("every other tab here is the person's own account
  and is not gated").
- **`AccountFieldFormScreen.tsx`** — one shared screen for editing full
  name, username or job title, selected by the `AccountFieldForm` route's
  `field` param. Seeds from the loaded account, sends exactly one field
  per submit (`null` for a cleared clearable field), matching web's
  `handleSubmitEdit`.
- **`ChangePasswordScreen.tsx`** — the 3-field form. On success: toast,
  then `useLogoutMutation()` (clears cookies, flips to signed-out,
  resets the whole query cache) — same mechanism the drawer's own
  "Sign out" row uses, honouring the backend's `tokenValidFrom` bump the
  same way web's `useSignOut` does.

### Deliberate deviation: inline error vs. toast

Web's `ChangePasswordDialog` renders a submit failure inline under the
form rather than as a toast, with a documented reason (the message is
about the form still on screen). This mobile screen uses a toast instead,
matching every other mutation's catch block in this codebase
(`BrandFormScreen`, `RaiseTicketFormScreen`, etc.) — consistency with the
app's own established convention was judged to matter more than
replicating that one web-specific choice. The server's specific message
("Your current password is not correct.") still comes through via
`getErrorMessage`, which prefers the server's own message over the
fallback.

### Navigation

`SettingsStackParamList` gained two routes: `AccountFieldForm: { field:
'fullName' | 'username' | 'jobTitle' }` and `ChangePassword: undefined`.
`SettingsScreen.tsx`'s home-list `Row` type was narrowed from `keyof
SettingsStackParamList` to a `SettingsHomeRoute` union of the four routes
actually reachable from that list (a `tsc` fix forced by adding a
params-requiring route to the stack — `AccountFieldForm` is reached only
from inside `AccountScreen`, never from the home list).

The old placeholder at `src/features/settings/AccountScreen.tsx` was
deleted; the module now lives at `src/features/account/` like every
other completed module, rather than as a flat file under
`src/features/settings/` (which remains home only to the still-unbuilt
Appearance/Analytics/UsageCredits stubs).

## Permissions

None. Confirmed deliberate — see Screens above.

## Definition of Done

- [x] Data layer: types, rules, API, both schemas
- [x] Account screen (identity, profile, security, system sections)
- [x] Avatar pick/upload/remove
- [x] Edit full name / username / job title (shared form screen)
- [x] Change password (forces sign-out on success)
- [x] Navigation wired (`SettingsStackParamList`, `SettingsStack.tsx`)
- [x] Old placeholder removed
- [x] `tsc --noEmit` clean
- [x] `expo export --platform ios` clean
- [x] This spec
