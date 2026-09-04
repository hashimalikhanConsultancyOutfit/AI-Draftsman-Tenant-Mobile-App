import * as yup from 'yup';

/** Mirrors `UpdateTeamMemberRequestDto` — `roleName` is the only writable
 * field. `name`/`email` shown alongside it in the form are read-only
 * display, never submitted. */
export const changeRoleFormSchema = yup.object({
  roleName: yup.string().required('Choose a role.'),
});

export type ChangeRoleFormValues = yup.InferType<typeof changeRoleFormSchema>;
