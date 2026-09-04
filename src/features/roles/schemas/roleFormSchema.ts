import * as yup from 'yup';

import { PERMISSIONS_REQUIRED_MESSAGE, ROLE_DESCRIPTION_MAX_LENGTH, ROLE_NAME_LABEL, ROLE_NAME_MAX_LENGTH } from '../rolesRules';

/**
 * Add/Edit role form. Mirrors `useRoleForm`'s schema on web exactly
 * (confirmed against that source 2026-09-04), which itself mirrors
 * `CreateRoleRequestDto`/`UpdateRoleRequestDto`: name required, max 64;
 * description optional, max 200; permissions required unless Full Access
 * is on — a rule ACROSS the two fields, read off `this.parent`.
 */
export const roleFormSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required(`${ROLE_NAME_LABEL} is required`)
    .max(ROLE_NAME_MAX_LENGTH, `${ROLE_NAME_LABEL} cannot be longer than ${ROLE_NAME_MAX_LENGTH} characters`),
  description: yup.string().trim().max(ROLE_DESCRIPTION_MAX_LENGTH, `Description cannot be longer than ${ROLE_DESCRIPTION_MAX_LENGTH} characters`).default(''),
  fullAccess: yup.boolean().default(false),
  permissions: yup
    .array()
    .of(yup.string().required())
    .default([])
    .test('at-least-one', PERMISSIONS_REQUIRED_MESSAGE, function (value) {
      const fullAccess = this.parent.fullAccess as boolean;
      return fullAccess || (value?.length ?? 0) > 0;
    }),
});

export type RoleFormValues = yup.InferType<typeof roleFormSchema>;
