/**
 * The single-field edit form shared by Full name, Username and Job
 * title. One `value` key rather than three schemas, since the field
 * being edited is a route param, not three separate screens — mirrors
 * `UpdateAccountDto`'s rules exactly (confirmed 2026-09-04). Username and
 * job title are clearable (an empty submission clears the field
 * server-side); full name is not, since it isn't nullable in the DTO.
 *
 * The server also refuses a short reserved-word list for `username`
 * (`RESERVED_USERNAMES`, b2b-core-only) that has no client-side mirror on
 * either platform — that one can only ever surface as the submit-time
 * 400, never as a form error here.
 */

import * as yup from 'yup';

import type { AccountEditableField } from '../account.types';
import { FULL_NAME_MAX_LENGTH, JOB_TITLE_MAX_LENGTH, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, USERNAME_PATTERN, USERNAME_PATTERN_MESSAGE } from '../accountRules';

export function buildAccountFieldSchema(field: AccountEditableField) {
  switch (field) {
    case 'fullName':
      return yup.object({
        value: yup.string().trim().required('Enter a full name.').max(FULL_NAME_MAX_LENGTH, `Full name cannot be longer than ${FULL_NAME_MAX_LENGTH} characters.`),
      });
    case 'username':
      return yup.object({
        value: yup
          .string()
          .trim()
          .test('min', `Username must be at least ${USERNAME_MIN_LENGTH} characters.`, (value) => !value || value.length >= USERNAME_MIN_LENGTH)
          .max(USERNAME_MAX_LENGTH, `Username cannot be longer than ${USERNAME_MAX_LENGTH} characters.`)
          .test('pattern', USERNAME_PATTERN_MESSAGE, (value) => !value || USERNAME_PATTERN.test(value)),
      });
    case 'jobTitle':
      return yup.object({
        value: yup.string().trim().max(JOB_TITLE_MAX_LENGTH, `Job title cannot be longer than ${JOB_TITLE_MAX_LENGTH} characters.`),
      });
    default:
      return yup.object({ value: yup.string() });
  }
}

export interface AccountFieldFormValues {
  value: string;
}
