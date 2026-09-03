import * as yup from 'yup';

/** "Edit prompt" — two fields, mirrors web's `EDIT_PROMPT_FIELDS`. */
export const editPromptSchema = yup.object({
  prompt: yup.string().trim().required('Enter a system prompt'),
  note: yup.string().default(''),
});

export type EditPromptFormValues = yup.InferType<typeof editPromptSchema>;
