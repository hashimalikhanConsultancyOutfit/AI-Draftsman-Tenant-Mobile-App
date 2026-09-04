/**
 * Change password. Mirrors web's `ChangePasswordDialog`'s schema
 * (confirmed against that source and `ChangePasswordDto` on 2026-09-04):
 * `currentPassword` gets a presence check only — it's measured against
 * the stored hash, not today's policy, and a password set years ago
 * under a weaker rule is still the right answer to "what is your current
 * password". `newPassword` must meet the same four-rule policy every
 * other password-setting screen in this app uses (imported from
 * `@/features/auth/passwordPolicy`, not restated), plus a same-as-current
 * check the server also makes (against the hash, not the string —
 * this one only catches the narrower case of both boxes holding the same
 * text). `confirmPassword` never leaves the form.
 */

import * as yup from 'yup';

import { meetsPolicy, PASSWORD_POLICY_MESSAGE } from '@/features/auth/passwordPolicy';

export const UNCHANGED_PASSWORD_MESSAGE = 'Your new password must be different from your current one.';

export const changePasswordSchema = yup.object({
  currentPassword: yup.string().required('Enter your current password.'),
  newPassword: yup
    .string()
    .required('Enter a new password.')
    .test('policy', PASSWORD_POLICY_MESSAGE, (value) => meetsPolicy(value ?? ''))
    .test('changed', UNCHANGED_PASSWORD_MESSAGE, function test(value) {
      const current = (this.parent as { currentPassword?: string }).currentPassword;
      return !value || !current || value !== current;
    }),
  confirmPassword: yup
    .string()
    .required('Confirm your new password.')
    .oneOf([yup.ref('newPassword')], 'Both new passwords must match.'),
});

export type ChangePasswordFormValues = yup.InferType<typeof changePasswordSchema>;
