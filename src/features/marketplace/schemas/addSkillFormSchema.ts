import * as yup from 'yup';

/** "Add skill" form — publish-then-clone. Mirrors the gateway's own
 * field caps (name/description) so the client fails fast rather than
 * round-tripping a 400. The prompt has no cap, matching web. */
export const addSkillFormSchema = yup.object({
  skillCategoryId: yup.string().required('Choose a category'),
  name: yup.string().trim().required('Give the skill a name').max(150, 'Keep the name under 150 characters'),
  description: yup.string().trim().required('Describe what this skill does').max(1000, 'Keep the description under 1000 characters'),
  prompt: yup.string().trim().required('Give the skill a system prompt'),
});

export type AddSkillFormValues = yup.InferType<typeof addSkillFormSchema>;
