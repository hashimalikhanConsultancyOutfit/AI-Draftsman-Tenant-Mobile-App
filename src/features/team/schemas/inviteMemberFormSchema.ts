import * as yup from 'yup';

/** `email` and `roleName` required per `InviteTeamMemberRequestDto`
 * (`apps/gateway-b2b/src/app/team/dto/team-request.dto.ts`, confirmed
 * 2026-09-04). `name` is `@IsOptional()` on that DTO, but web's own dialog
 * (`buildInviteFields`, `Team.data.ts`) requires it anyway — its field
 * config carries no `optional: true`, so `useFormModal` treats it as
 * required non-blank. Matching web here, not the looser backend: the
 * whole point of asking for a name on invite is so the roster shows one
 * before the person accepts, and web never lets that be skipped.
 * `customerScope` has no field in this form — same as web's dialog, which
 * dropped its two checkboxes at product-owner request and defaults every
 * invite to the whole workspace. */
export const inviteMemberFormSchema = yup.object({
  name: yup.string().trim().max(120, 'Keep it under 120 characters.').required('Enter their full name.'),
  email: yup.string().trim().email('That does not look like an email address.').required('Enter an email address.'),
  roleName: yup.string().required('Choose a role.'),
});

export type InviteMemberFormValues = yup.InferType<typeof inviteMemberFormSchema>;
