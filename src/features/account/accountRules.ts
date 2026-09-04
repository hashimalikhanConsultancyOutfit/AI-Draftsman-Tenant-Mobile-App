/**
 * Account — copy constants and pure helpers. Ported from web's
 * `MySettings.data.ts` (the `account` tab's slice of it — the
 * personalization/notifications/plan/credential sections there belong to
 * other tabs and are out of scope here), confirmed against
 * `UpdateAccountDto`/the avatar upload route on 2026-09-04.
 */

import type { AccountEditableField } from './account.types';

export const PAGE_DESCRIPTION = 'Your profile, sign-in details and account security.';

/** Shown in place of a value the account has not set yet. */
export const NOT_SET_LABEL = 'Not set';

export const FULL_NAME_MAX_LENGTH = 120;
export const JOB_TITLE_MAX_LENGTH = 120;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;

/** Lower-case letters, digits, and `.`/`_`/`-` inside — never at either
 * end. Case-insensitive because the backend lower-cases before storing,
 * so refusing "Adil" here would refuse something the API accepts. */
export const USERNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;
export const USERNAME_PATTERN_MESSAGE =
  'Use letters, numbers, dots, underscores or hyphens, starting and ending with a letter or number.';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_AVATAR_MIME: readonly string[] = ['image/png', 'image/jpeg', 'image/webp'];
export const AVATAR_TOO_LARGE_MESSAGE = `That image is larger than ${MAX_AVATAR_BYTES / (1024 * 1024)} MB. Choose a smaller one.`;
export const AVATAR_WRONG_TYPE_MESSAGE = 'Choose a PNG, JPEG or WebP image for your avatar.';
export const AVATAR_UPDATED_MESSAGE = 'Avatar updated.';
export const AVATAR_REMOVED_MESSAGE = 'Avatar removed.';
export const AVATAR_UPLOAD_ERROR = 'Could not update your avatar.';
export const AVATAR_REMOVE_ERROR = 'Could not remove your avatar.';
export const AVATAR_UNAVAILABLE_CAPTION = 'Avatar upload is not configured on this deployment.';

export interface AccountEditConfig {
  field: AccountEditableField;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  hint?: string;
  /** Empty submission clears the field (sent as `null`) rather than being
   * refused — `fullName` is the one exception, since it isn't nullable
   * server-side. */
  clearable: boolean;
  maxLength: number;
  minLength?: number;
  submitLabel: string;
  successMessage: string;
  errorMessage: string;
}

/** One entry per editable row on the Account screen. `defaultValue` isn't
 * here — the form screen seeds itself from the loaded account, same as
 * web's `useMySettings.editConfig`. */
export const ACCOUNT_EDIT_CONFIG: Record<AccountEditableField, AccountEditConfig> = {
  fullName: {
    field: 'fullName',
    title: 'Change full name',
    description: 'The name the app greets you by and shows to your team.',
    label: 'Full name',
    placeholder: 'e.g. Adil Khan',
    clearable: false,
    maxLength: FULL_NAME_MAX_LENGTH,
    submitLabel: 'Save name',
    successMessage: 'Full name updated.',
    errorMessage: 'Could not update your full name.',
  },
  username: {
    field: 'username',
    title: 'Change username',
    description: 'Your handle within this workspace. Letters, numbers, dots, underscores and hyphens.',
    label: 'Username',
    placeholder: 'e.g. adilkhan',
    hint: 'Stored in lower case. Must be unique within your workspace.',
    clearable: true,
    minLength: USERNAME_MIN_LENGTH,
    maxLength: USERNAME_MAX_LENGTH,
    submitLabel: 'Save username',
    successMessage: 'Username updated.',
    errorMessage: 'Could not update your username.',
  },
  jobTitle: {
    field: 'jobTitle',
    title: 'Change job title',
    description: 'What you do here. This is never used to decide what you can access — that comes from your workspace role.',
    label: 'Job title',
    placeholder: 'e.g. Head of Engineering',
    clearable: true,
    maxLength: JOB_TITLE_MAX_LENGTH,
    submitLabel: 'Save job title',
    successMessage: 'Job title updated.',
    errorMessage: 'Could not update your job title.',
  },
};

/** Initials for the avatar fallback: first letter of the first and last
 * word ("Adil Khan" -> "AK"), or the first letter alone when that's all
 * there is. Matches web's `toInitials`. */
export function accountInitials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return '';
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return (first.charAt(0) + (last?.charAt(0) ?? '')).toUpperCase();
}

/** "4 Sept 2026, 14:32", or the fallback when null/unparsable. Matches
 * web's `formatMoment`. */
export function formatAccountMoment(iso: string | null, fallback = NOT_SET_LABEL): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Date-only variant, for "Member since". Matches web's `formatDay`. */
export function formatAccountDay(iso: string | null, fallback = NOT_SET_LABEL): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
