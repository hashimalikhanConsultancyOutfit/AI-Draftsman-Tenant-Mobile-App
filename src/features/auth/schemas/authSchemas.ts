import * as yup from 'yup';

import { meetsPolicy, PASSWORD_POLICY_MESSAGE } from '../passwordPolicy';

/** Mirrors the backend DTOs' validation shape (email format, required
 * password) — see submit-credentials.dto.ts. The backend is still the real
 * enforcement; this only avoids a round-trip for the obviously-empty case. */
export const loginSchema = yup.object({
  email: yup.string().trim().email('Enter a valid email address').required('Email is required'),
  password: yup.string().required('Password is required'),
});

export type LoginFormValues = yup.InferType<typeof loginSchema>;

export const forgotPasswordSchema = yup.object({
  email: yup.string().trim().email('Enter a valid email address').required('Email is required'),
});

export type ForgotPasswordFormValues = yup.InferType<typeof forgotPasswordSchema>;

/** Backend enforces only an 8-char floor on POST /auth/reset-password/:token,
 * but web's own reset form gates on the full four-rule policy (length,
 * uppercase, digit, special character) and deliberately does not let the
 * server's weaker floor decide — see `passwordPolicy.ts`. Matching that here
 * so the same account can't end up with a weaker password depending on
 * which client reset it. */
export const resetPasswordSchema = yup.object({
  password: yup
    .string()
    .required('Password is required')
    .test('policy', PASSWORD_POLICY_MESSAGE, (value) => meetsPolicy(value ?? '')),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords do not match')
    .required('Confirm your password'),
});

export type ResetPasswordFormValues = yup.InferType<typeof resetPasswordSchema>;

/** Exactly 6 digits — matches both the OTP and TOTP-confirm endpoints'
 * `^\d{6}$` validation. */
export const sixDigitCodeSchema = yup.object({
  code: yup
    .string()
    .matches(/^\d{6}$/, 'Enter the 6-digit code')
    .required('Enter the 6-digit code'),
});

export type SixDigitCodeFormValues = yup.InferType<typeof sixDigitCodeSchema>;
